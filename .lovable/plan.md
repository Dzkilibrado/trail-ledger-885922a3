# TrailBook — Plano de Construção

Prontuário digital para motos off-road com histórico permanente tipo "Carfax". Dado o escopo grande, vou entregar em fases incrementais, começando por uma base sólida (design system + auth + cadastro de moto + timeline) e evoluindo até certificado público e financeiro.

## Stack
- React + TypeScript + Vite + TanStack Start (já configurado no template)
- Tailwind v4 + Shadcn UI
- Lovable Cloud (Supabase) — Auth, Postgres, Storage, Realtime

## Design System
- Tema escuro premium (sem toggle light)
- Tokens em `src/styles.css` (oklch):
  - `--background` preto grafite (~oklch(0.18 0.01 250))
  - `--card` cinza escuro elevado
  - `--primary` laranja vibrante (~oklch(0.72 0.19 50))
  - `--foreground` branco quente
  - Gradientes e sombras laranja para CTAs e cards de destaque
- Tipografia: Inter (corpo) + Space Grotesk (display) via `<link>` no `__root.tsx`
- Componentes shadcn customizados com variantes `premium`, `hero`, `metric`

## Arquitetura de Dados (Supabase)

Tabelas principais:
- `profiles` (id, full_name, avatar_url, phone)
- `user_roles` (id, user_id, role enum: owner|mechanic|admin) — RLS segura
- `motorcycles` (id, owner_id, brand, model, year_make, year_model, displacement, control_type, chassis, engine_number, plate, renavam, main_photo_url, hours_total, km_total, conservation_score)
- `motorcycle_photos` (id, motorcycle_id, url, caption)
- `workshops` (id, name, cnpj, city, owner_user_id, verified)
- `events` (id, motorcycle_id, type enum, occurred_at, title, description, hours_at_event, km_at_event, cost, workshop_id, signed_by, signature_data, metadata jsonb)
- `event_attachments` (id, event_id, url, kind: photo|video|document|invoice)
- `maintenance_items` (id, event_id, category, service, product, brand, qty, unit_value)
- `maintenance_schedules` (id, motorcycle_id, name, category, interval_hours, interval_km, interval_days, last_done_hours, last_done_km, last_done_at)
- `certificates` (id, motorcycle_id, public_token, expires_at, allowed_sections)

Todas com RLS: owner vê só suas motos; eventos visíveis ao dono; oficinas só leem motos onde foram convidadas (junção via evento). `certificates.public_token` permite leitura pública via RPC.

Storage buckets:
- `motorcycle-photos` (público)
- `event-media` (público)
- `documents` (privado, signed URLs)

## Tipos de Evento (Timeline)
Enum único: `usage | maintenance | revision | accessory | photo | video | document | purchase | sale | ownership_transfer | recall | warranty | note`

Cada tipo renderiza um card específico na timeline vertical com ícone, cor, métricas (h/km), anexos e custo.

## Fases de Entrega

### Fase 1 — Fundação (este turno)
1. Ativar Lovable Cloud
2. Design system completo (tokens, fontes, variantes shadcn)
3. Schema do banco + RLS + storage buckets + trigger profile
4. Auth (email/senha + Google) com rota `/auth` pública e layout `_authenticated`
5. Shell autenticado com sidebar (Dashboard, Motos, Agenda, Financeiro, Oficinas, Certificados)
6. Listagem + cadastro de motos com upload de foto principal
7. Página da moto com Dashboard básico (foto, h/km, índice placeholder, próximas) e Timeline vazia
8. Registro rápido de eventos: uso, manutenção, foto, observação
9. Landing page pública premium em `/`

### Fase 2 (próximas iterações)
- Catálogo estruturado de manutenções por categoria com formulário rico
- Agenda Inteligente: cálculo automático de alertas (primeiro limite atingido entre h/km/dias)
- Cálculo do Índice de Conservação 0–100 com explicação dos fatores
- Upload de notas fiscais, vídeos e documentos
- Eventos de compra/venda/transferência de proprietário

### Fase 3
- Certificado Digital com QR Code e página pública `/c/:token` (SSR para SEO/compartilhamento)
- Exportação PDF do histórico
- Módulo Oficina: cadastro, convite, assinatura digital de serviços
- Financeiro: gráficos (Recharts) por período/categoria/moto, relatórios CSV

### Fase 4
- Realtime nos eventos (Supabase channels)
- Preparação para Premium, marketplace e integrações

## Detalhes Técnicos
- Server functions com `createServerFn` + `requireSupabaseAuth` para mutações sensíveis (criar moto, registrar evento)
- Reads autenticados direto pelo cliente browser (RLS protege)
- Rota pública do certificado usa server fn pública lendo via cliente publishable + policy `TO anon` filtrada por token
- Validação com Zod em todos os formulários
- Componentes reutilizáveis: `MetricCard`, `TimelineEvent`, `MotorcycleCard`, `EventTypeIcon`, `FileUpload`, `ConservationGauge`

## Confirmações antes de começar
Vou seguir com:
- Auth: **email/senha + Google** (defaults Lovable Cloud)
- Tabela **profiles** sim (nome, avatar, telefone)
- Idioma da interface: **Português (BR)**
- Sem modo claro
- Começo pela **Fase 1** completa neste turno; demais fases em turnos seguintes conforme você priorizar.

Se quiser ajustar prioridade (ex: já incluir Certificado ou Financeiro na Fase 1), me avise. Caso contrário, aprovo e parto para implementação.