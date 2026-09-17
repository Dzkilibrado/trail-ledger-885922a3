-- ============================================================
-- MIGRATION 1 — ASSISTENTE TRAILBOOK: SCHEMA
-- TrailBook v1.x — Knowledge Base, Permissions, RPC seguras
--
-- Tabelas:
--   user_permissions, help_articles, help_intents,
--   help_intent_phrases, help_unanswered
--
-- Funções:
--   has_permission, set_updated_by, set_granted_by,
--   record_help_unanswered, resolve_help_unanswered,
--   link_ticket_to_unanswered
-- ============================================================

-- ── Extensão necessária para SHA256 ──────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. USER_PERMISSIONS ──────────────────────────────────────
-- Permissões granulares delegáveis a usuários não-admin.
-- ADMIN tem todas as permissões implicitamente (via has_permission).
-- UPDATE bloqueado: para trocar permission, revogar + conceder novamente.

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT        NOT NULL
    CHECK (permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  granted_by     UUID        REFERENCES auth.users(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

COMMENT ON TABLE public.user_permissions IS
  'Permissões granulares delegáveis a usuários não-admin do TrailBook.
   Admin tem todas as permissões implicitamente via has_permission().
   Formato de permission_key: dominio.acao (ex: assistant.manage_content).
   UPDATE bloqueado por RLS: para alterar, revogar (DELETE) e conceder (INSERT).
   granted_by é preenchido automaticamente pelo trigger set_granted_by().';

GRANT SELECT, INSERT, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

-- ── 2. HELP_ARTICLES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.help_articles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT        NOT NULL UNIQUE
    CHECK (char_length(trim(slug)) >= 1
           AND slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  title            TEXT        NOT NULL CHECK (char_length(trim(title)) >= 1),
  summary          TEXT        NOT NULL CHECK (char_length(trim(summary)) >= 1),
  body_md          TEXT,
  module_key       TEXT,
  route_template   TEXT,
  cta_label        TEXT,
  context_tags     TEXT[]      DEFAULT '{}',
  needs_motorcycle BOOLEAN     NOT NULL DEFAULT false,
  status           TEXT        NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  sort_order       INT         NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID        REFERENCES auth.users(id)
);

COMMENT ON TABLE public.help_articles IS
  'Base de conhecimento do Assistente TrailBook.
   Alimenta o Assistente (busca) e a página /faq (status=published).
   updated_by é preenchido automaticamente pelo trigger set_updated_by().
   DELETE físico não exposto na UI normal — usar status=archived.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;

-- ── 3. HELP_INTENTS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.help_intents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key  TEXT        NOT NULL UNIQUE
    CHECK (intent_key ~ '^[a-z][a-z0-9_]*$'),
  article_id  UUID        NOT NULL REFERENCES public.help_articles(id),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.help_intents IS
  'Intenções do Assistente — cada intent aponta para um artigo principal.
   description é nota interna do admin, não exposta ao usuário comum.
   Um artigo pode ter múltiplos intents apontando para ele.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_intents TO authenticated;
GRANT ALL ON public.help_intents TO service_role;

-- ── 4. HELP_INTENT_PHRASES ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.help_intent_phrases (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id  UUID        NOT NULL REFERENCES public.help_intents(id) ON DELETE CASCADE,
  phrase     TEXT        NOT NULL CHECK (char_length(trim(phrase)) >= 2),
  weight     INT         NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.help_intent_phrases IS
  'Frases e sinônimos que disparam um intent do Assistente.
   weight 1=genérico, 3=direto, 5=exato.
   DELETE físico permitido (sem referências externas).
   ON DELETE CASCADE: remover intent remove suas phrases.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_intent_phrases TO authenticated;
GRANT ALL ON public.help_intent_phrases TO service_role;

-- ── 5. HELP_UNANSWERED ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.help_unanswered (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text    TEXT        NOT NULL CHECK (char_length(trim(query_text)) >= 1),
  query_hash    TEXT        NOT NULL UNIQUE CHECK (char_length(query_hash) = 64),
  frequency     INT         NOT NULL DEFAULT 1 CHECK (frequency >= 1),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  route         TEXT,
  module_key    TEXT,
  resolved      BOOLEAN     NOT NULL DEFAULT false,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID        REFERENCES auth.users(id),
  article_id    UUID        REFERENCES public.help_articles(id),
  ticket_id     UUID        REFERENCES public.tickets(id)
  -- SEM user_id: privacidade por padrão. Ticket tem user_id via RLS normal.
);

COMMENT ON TABLE public.help_unanswered IS
  'Dúvidas do Assistente que não produziram resultado (score=ZERO).
   Sem user_id: privacidade por padrão.
   INSERT e UPDATE somente via RPC (record_help_unanswered, resolve_help_unanswered).
   query_hash = SHA256(normalized_query) gerado server-side.
   Deduplicação por query_hash: ON CONFLICT incrementa frequency.';

GRANT SELECT ON public.help_unanswered TO authenticated;
-- INSERT e UPDATE via RPC SECURITY DEFINER — sem GRANT direto
GRANT ALL ON public.help_unanswered TO service_role;

-- ── ÍNDICES ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_help_articles_status_sort
  ON public.help_articles(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_help_articles_module
  ON public.help_articles(module_key);
CREATE INDEX IF NOT EXISTS idx_help_intents_article
  ON public.help_intents(article_id);
CREATE INDEX IF NOT EXISTS idx_help_intent_phrases_intent
  ON public.help_intent_phrases(intent_id);
CREATE INDEX IF NOT EXISTS idx_help_unanswered_hash
  ON public.help_unanswered(query_hash);
CREATE INDEX IF NOT EXISTS idx_help_unanswered_unresolved
  ON public.help_unanswered(frequency DESC)
  WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_user_permissions_lookup
  ON public.user_permissions(user_id, permission_key);

-- ── FUNÇÕES ───────────────────────────────────────────────────

-- F1. set_updated_by — trigger para help_articles
--     Frontend não controla updated_by: trigger sempre sobrescreve com auth.uid().
CREATE OR REPLACE FUNCTION public.set_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- F2. set_granted_by — trigger para user_permissions
--     Frontend não controla granted_by: trigger sempre sobrescreve com auth.uid().
CREATE OR REPLACE FUNCTION public.set_granted_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.granted_by := auth.uid();
  RETURN NEW;
END;
$$;

-- F3. has_permission — verificação centralizada de capacidades
--     Não aceita user_id como parâmetro: usa auth.uid() internamente.
--     Admin tem todas as permissions implicitamente (sem linhas em user_permissions).
CREATE OR REPLACE FUNCTION public.has_permission(_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid() AND permission_key = _key
      )
    );
$$;

-- F4. record_help_unanswered
--     Único ponto de escrita em help_unanswered para usuários autenticados.
--     Normaliza e faz hash server-side — cliente nunca envia hash.
--     ON CONFLICT: incrementa apenas frequency e last_seen_at.
--     Não toca campos administrativos (resolved, resolved_by, article_id, ticket_id).
CREATE OR REPLACE FUNCTION public.record_help_unanswered(
  _query_text TEXT,
  _route      TEXT DEFAULT NULL,
  _module_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT;
  v_hash       TEXT;
  v_id         UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Normalização server-side: lowercase, remover acentos básicos PT, pontuação, trim
  v_normalized := lower(trim(
    regexp_replace(
      translate(
        _query_text,
        'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9 ]', '', 'g'
    )
  ));

  IF char_length(v_normalized) < 1 THEN
    RAISE EXCEPTION 'query_too_short';
  END IF;

  -- Hash SHA256 server-side
  v_hash := encode(digest(v_normalized, 'sha256'), 'hex');

  INSERT INTO public.help_unanswered (query_text, query_hash, route, module_key)
  VALUES (_query_text, v_hash, _route, _module_key)
  ON CONFLICT (query_hash) DO UPDATE
    SET frequency    = public.help_unanswered.frequency + 1,
        last_seen_at = now()
    -- NÃO altera: resolved, resolved_at, resolved_by, article_id, ticket_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- F5. resolve_help_unanswered
--     Altera APENAS: resolved, resolved_at, resolved_by, article_id.
--     Requer permission assistant.resolve_unanswered (ou admin implícito).
CREATE OR REPLACE FUNCTION public.resolve_help_unanswered(
  _id         UUID,
  _article_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.has_permission('assistant.resolve_unanswered') THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE public.help_unanswered
  SET
    resolved    = true,
    resolved_at = now(),
    resolved_by = auth.uid(),
    article_id  = COALESCE(_article_id, article_id)
  WHERE id      = _id
    AND resolved = false;   -- idempotência: já resolvida não é alterada

  RETURN FOUND;
END;
$$;

-- F6. link_ticket_to_unanswered
--     Vincula um ticket existente a uma ocorrência de dúvida não respondida.
--     Usuário comum: somente ticket próprio (ticket.user_id = auth.uid()).
--     Admin / assistant.handle_support: qualquer ticket.
--     Valida: ticket existe, unanswered existe, ticket_id IS NULL antes de vincular.
CREATE OR REPLACE FUNCTION public.link_ticket_to_unanswered(
  _unanswered_id UUID,
  _ticket_id     UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verificar que o ticket existe e obter seu dono
  SELECT user_id INTO v_ticket_owner
  FROM public.tickets
  WHERE id = _ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  -- Verificar que unanswered existe
  IF NOT EXISTS (
    SELECT 1 FROM public.help_unanswered WHERE id = _unanswered_id
  ) THEN
    RAISE EXCEPTION 'unanswered_not_found';
  END IF;

  -- Autorização: dono do ticket OU permission administrativa
  IF v_ticket_owner <> auth.uid()
     AND NOT public.has_permission('assistant.handle_support') THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Vincular apenas se ticket_id ainda não foi definido (idempotência segura)
  UPDATE public.help_unanswered
  SET ticket_id = _ticket_id
  WHERE id        = _unanswered_id
    AND ticket_id IS NULL;

  RETURN FOUND;
END;
$$;

-- ── REVOKE/GRANT das funções ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.set_updated_by()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_granted_by()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(TEXT)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_help_unanswered(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_help_unanswered(UUID, UUID)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_ticket_to_unanswered(UUID, UUID)    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_help_unanswered(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_help_unanswered(UUID, UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_ticket_to_unanswered(UUID, UUID)    TO authenticated;

-- ── TRIGGERS ─────────────────────────────────────────────────

CREATE TRIGGER help_articles_set_updated_by
  BEFORE INSERT OR UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

CREATE TRIGGER user_permissions_set_granted_by
  BEFORE INSERT ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_granted_by();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.user_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_intents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_intent_phrases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_unanswered      ENABLE ROW LEVEL SECURITY;

-- ── RLS: user_permissions ────────────────────────────────────

-- SELECT próprio
CREATE POLICY "up_select_own" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- SELECT todos (admin)
CREATE POLICY "up_select_admin" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- INSERT apenas admin
CREATE POLICY "up_insert_admin" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- UPDATE bloqueado — sem policy de UPDATE

-- DELETE apenas admin
CREATE POLICY "up_delete_admin" ON public.user_permissions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── RLS: help_articles ───────────────────────────────────────

-- Usuário comum: somente published
CREATE POLICY "ha_select_published" ON public.help_articles
  FOR SELECT TO authenticated
  USING (status = 'published');

-- Admin ou capability: todos os status
CREATE POLICY "ha_select_admin" ON public.help_articles
  FOR SELECT TO authenticated
  USING (public.has_permission('assistant.view_admin'));

-- INSERT/UPDATE: manage_content
CREATE POLICY "ha_insert" ON public.help_articles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('assistant.manage_content'));

CREATE POLICY "ha_update" ON public.help_articles
  FOR UPDATE TO authenticated
  USING  (public.has_permission('assistant.manage_content'))
  WITH CHECK (public.has_permission('assistant.manage_content'));

-- DELETE: somente admin (não exposto na UI normal)
CREATE POLICY "ha_delete_admin" ON public.help_articles
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── RLS: help_intents ────────────────────────────────────────

-- Usuário comum: somente intents de artigo published
CREATE POLICY "hi_select_published" ON public.help_intents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.help_articles ha
      WHERE ha.id = help_intents.article_id
        AND ha.status = 'published'
    )
  );

-- Admin ou capability: todos
CREATE POLICY "hi_select_admin" ON public.help_intents
  FOR SELECT TO authenticated
  USING (public.has_permission('assistant.view_admin'));

-- INSERT/UPDATE: manage_intents
CREATE POLICY "hi_insert" ON public.help_intents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('assistant.manage_intents'));

CREATE POLICY "hi_update" ON public.help_intents
  FOR UPDATE TO authenticated
  USING  (public.has_permission('assistant.manage_intents'))
  WITH CHECK (public.has_permission('assistant.manage_intents'));

-- DELETE: somente admin
CREATE POLICY "hi_delete_admin" ON public.help_intents
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── RLS: help_intent_phrases ─────────────────────────────────

-- Usuário comum: somente phrases de intent com artigo published
CREATE POLICY "hip_select_published" ON public.help_intent_phrases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.help_intents hi
      JOIN public.help_articles ha ON ha.id = hi.article_id
      WHERE hi.id = help_intent_phrases.intent_id
        AND ha.status = 'published'
    )
  );

-- Admin ou capability: todos
CREATE POLICY "hip_select_admin" ON public.help_intent_phrases
  FOR SELECT TO authenticated
  USING (public.has_permission('assistant.view_admin'));

-- INSERT/UPDATE/DELETE: manage_intents (phrases podem ser deletadas fisicamente)
CREATE POLICY "hip_insert" ON public.help_intent_phrases
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('assistant.manage_intents'));

CREATE POLICY "hip_update" ON public.help_intent_phrases
  FOR UPDATE TO authenticated
  USING  (public.has_permission('assistant.manage_intents'))
  WITH CHECK (public.has_permission('assistant.manage_intents'));

CREATE POLICY "hip_delete" ON public.help_intent_phrases
  FOR DELETE TO authenticated
  USING (public.has_permission('assistant.manage_intents'));

-- ── RLS: help_unanswered ─────────────────────────────────────

-- SELECT: view_unanswered (inclui admin implicitamente via has_permission)
CREATE POLICY "hu_select" ON public.help_unanswered
  FOR SELECT TO authenticated
  USING (public.has_permission('assistant.view_unanswered'));

-- INSERT: bloqueado direto — somente via RPC record_help_unanswered (SECURITY DEFINER)
-- UPDATE: bloqueado direto — somente via RPC resolve_help_unanswered / link_ticket_to_unanswered
-- DELETE: somente admin
CREATE POLICY "hu_delete_admin" ON public.help_unanswered
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ── Reload schema ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
