import { PageLineSkeleton } from "@/components/Skeletons";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { isValidCPF, maskCPF, maskPhone, onlyDigits } from "@/lib/br-validators";
import { CpfConflictDialog } from "@/components/CpfConflictDialog";
import { LocationPicker } from "@/components/LocationPicker";
import { parseLocation } from "@/lib/br-locations";
import { useInvalidateProfileSnapshot } from "@/hooks/useProfileSnapshot";
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, Pencil, Phone, User } from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
import { HELP } from "@/lib/help/texts";
import { PageHeader } from "@/components/PageHeader";

/**
 * Wizard oficial de cadastro do TrailBook.
 * Princípio: "Informar uma vez. Reutilizar sempre." (mem://principles/informar-uma-vez)
 * 4 passos: Dados pessoais → Contato → Localização → Revisão.
 * Salvamento parcial a cada avanço. Barra de progresso baseada em `profile_completeness`.
 */
export const Route = createFileRoute("/_authenticated/complete-profile")({
  head: () => ({ meta: [{ title: "Completar cadastro — TrailBook" }] }),
  component: CompleteProfilePage,
});

type Draft = {
  full_name: string;
  display_name: string;
  cpf: string; // masked
  birth_date: string; // yyyy-mm-dd
  email: string;
  phone: string; // masked
  whatsapp: string; // masked
  whatsapp_same_as_phone: boolean;
  location: string; // "Cidade / UF"
  cep: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
};

const EMPTY: Draft = {
  full_name: "",
  display_name: "",
  cpf: "",
  birth_date: "",
  email: "",
  phone: "",
  whatsapp: "",
  whatsapp_same_as_phone: false,
  location: "",
  cep: "",
  bairro: "",
  logradouro: "",
  numero: "",
  complemento: "",
};

const STEP_LABELS = ["Dados pessoais", "Contato", "Localização", "Conferência final"] as const;

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome completo",
  cpf: "CPF",
  birth_date: "Data de nascimento",
  email: "E-mail",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  uf: "Estado (UF)",
  city: "Cidade",
};

function CompleteProfilePage() {
  const navigate = useNavigate();
  const invalidateProfile = useInvalidateProfileSnapshot();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [cpfLocked, setCpfLocked] = useState(false);
  const [cpfConflict, setCpfConflict] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [pct, setPct] = useState(0);
  const [showAddress, setShowAddress] = useState(false);
  // Guarda o WhatsApp digitado quando o usuário marca "igual ao celular",
  // para restaurar sem apagar caso desmarque em seguida.
  const [whatsappBackup, setWhatsappBackup] = useState<string>("");
  // Quando o usuário clica em "Editar" um bloco na conferência final,
  // navegamos para a etapa correspondente e voltamos automaticamente
  // para a conferência após salvar.
  const [returnToReview, setReturnToReview] = useState(false);

  async function refreshCompleteness(uid: string) {
    const { data } = await supabase.rpc("profile_completeness", { _user: uid });
    const d = (data ?? {}) as { pct?: number; missing?: string[] };
    setPct(d.pct ?? 0);
    setMissing(d.missing ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) {
        navigate({ to: "/auth", search: { tab: "signin" as const, recuperar: undefined } });
        return;
      }
      const user = s.session.user;
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "full_name,display_name,cpf,birth_date,email,phone,whatsapp,whatsapp_same_as_phone,uf,city,cep,bairro,logradouro,numero,complemento,cpf_locked_at",
        )
        .eq("id", user.id)
        .maybeSingle();
      const loc = p?.uf && p?.city ? `${p.city} / ${p.uf}` : "";
      setDraft({
        full_name: p?.full_name ?? (user.user_metadata?.full_name as string) ?? "",
        display_name: p?.display_name ?? "",
        cpf: p?.cpf ? maskCPF(p.cpf) : "",
        birth_date: p?.birth_date ?? "",
        email: p?.email ?? user.email ?? "",
        phone: p?.phone ?? "",
        whatsapp: p?.whatsapp ?? "",
        whatsapp_same_as_phone: !!p?.whatsapp_same_as_phone,
        location: loc,
        cep: p?.cep ?? "",
        bairro: p?.bairro ?? "",
        logradouro: p?.logradouro ?? "",
        numero: p?.numero ?? "",
        complemento: p?.complemento ?? "",
      });
      setCpfLocked(!!p?.cpf_locked_at);
      await refreshCompleteness(user.id);
      // Entrar no primeiro passo com pendências
      const firstStep = pickFirstStep(p);
      setStep(firstStep);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFirstStep(p: any): number {
    if (!p) return 0;
    if (!p.full_name || !p.cpf || !p.birth_date) return 0;
    if (!p.phone || (!p.whatsapp && !p.whatsapp_same_as_phone)) return 1;
    if (!p.uf || !p.city) return 2;
    return 3;
  }

  function update<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  // Sincroniza WhatsApp com celular enquanto a opção estiver marcada.
  // - marcar → whatsapp := phone (normalizado pela máscara)
  // - alterar phone com opção ativa → whatsapp acompanha
  // - desmarcar → restaura o valor anterior (não apaga se já havia)
  useEffect(() => {
    if (draft.whatsapp_same_as_phone) {
      if (draft.whatsapp !== draft.phone) {
        setDraft((d) => ({ ...d, whatsapp: d.phone }));
      }
    }
  }, [draft.whatsapp_same_as_phone, draft.phone]);

  function toggleWhatsappSame(checked: boolean) {
    setDraft((d) => {
      if (checked) {
        // Antes de sobrescrever, preservar o valor atual como backup se houver.
        if (d.whatsapp && d.whatsapp !== d.phone) setWhatsappBackup(d.whatsapp);
        return { ...d, whatsapp_same_as_phone: true, whatsapp: d.phone };
      }
      // Restaura backup somente se o campo estiver espelhando o celular.
      const restore = whatsappBackup || d.whatsapp;
      return { ...d, whatsapp_same_as_phone: false, whatsapp: restore };
    });
  }

  async function persistPartial() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user) return { ok: false, error: "not signed in" };
    const parsedLoc = parseLocation(draft.location);
    const patch = {
      full_name: draft.full_name.trim() || null,
      display_name: draft.display_name.trim() || null,
      birth_date: draft.birth_date || null,
      phone: draft.phone || null,
      // Persistimos o WhatsApp sempre. Quando "igual ao celular", grava o
      // celular normalizado — a coluna precisa estar preenchida para o
      // `profile_completeness` considerar o campo válido.
      whatsapp: (draft.whatsapp_same_as_phone ? draft.phone : draft.whatsapp) || null,
      whatsapp_same_as_phone: draft.whatsapp_same_as_phone,
      uf: parsedLoc.uf || null,
      city: parsedLoc.city || null,
      cep: draft.cep || null,
      bairro: draft.bairro || null,
      logradouro: draft.logradouro || null,
      numero: draft.numero || null,
      complemento: draft.complemento || null,
    } as const;
    // CPF: só entra via RPC quando ainda não foi travado
    if (!cpfLocked && draft.cpf) {
      const digits = onlyDigits(draft.cpf);
      if (!isValidCPF(digits)) return { ok: false, error: "CPF inválido" };
      const { error } = await supabase.rpc("complete_signup_cpf", {
        _cpf: digits,
        _birth_date: draft.birth_date,
        _phone: draft.phone,
        _full_name: draft.full_name.trim(),
      });
      if (error) {
        if (/CPF já cadastrado/i.test(error.message)) {
          setCpfConflict(true);
          return { ok: false, error: "conflict" };
        }
        return { ok: false, error: error.message };
      }
      setCpfLocked(true);
    }
    const { error: eUpd } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", s.session!.user.id);
    if (eUpd) return { ok: false, error: eUpd.message };
    await refreshCompleteness(s.session!.user.id);
    return { ok: true };
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!draft.full_name.trim()) return "Informe seu nome completo";
      if (!cpfLocked && !isValidCPF(onlyDigits(draft.cpf))) return "CPF inválido";
      if (!draft.birth_date) return "Informe a data de nascimento";
    }
    if (step === 1) {
      if (!draft.email.trim()) return "E-mail obrigatório";
      if (onlyDigits(draft.phone).length < 10) return "Celular inválido";
      if (!draft.whatsapp_same_as_phone && onlyDigits(draft.whatsapp).length < 10)
        return "WhatsApp inválido";
    }
    if (step === 2) {
      const p = parseLocation(draft.location);
      if (!p.uf) return "Selecione o estado (UF)";
      if (!p.city) return "Selecione a cidade";
    }
    return null;
  }

  async function next() {
    const err = validateStep();
    if (err) return toast.error(err);
    setSaving(true);
    const r = await persistPartial();
    setSaving(false);
    if (!r.ok) {
      if (r.error !== "conflict") toast.error(r.error ?? "Falha ao salvar");
      return;
    }
    if (returnToReview) {
      setReturnToReview(false);
      setStep(3);
      return;
    }
    if (step < 3) setStep(step + 1);
  }

  function editSection(target: 0 | 1 | 2) {
    setReturnToReview(true);
    setStep(target);
  }

  async function finish() {
    setSaving(true);
    const r = await persistPartial();
    if (!r.ok) {
      setSaving(false);
      if (r.error !== "conflict") toast.error(r.error ?? "Falha ao salvar");
      return;
    }
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.user) {
      setSaving(false);
      return;
    }
    // Revalida completude no servidor — só marca `profile_completed_at`
    // quando `missing` estiver vazio (fonte da verdade é o RPC).
    const { data: comp } = await supabase.rpc("profile_completeness", {
      _user: s.session!.user.id,
    });
    const remaining = (((comp ?? {}) as any).missing as string[] | undefined) ?? [];
    if (remaining.length > 0) {
      setSaving(false);
      setMissing(remaining);
      setPct(((comp ?? {}) as any).pct ?? pct);
      const labels = remaining.map((m) => FIELD_LABELS[m] ?? m).join(", ");
      toast.error(`Ainda faltam: ${labels}`);
      return;
    }
    const { error: completeErr } = await supabase
      .from("profiles")
      .update({ profile_completed_at: new Date().toISOString() })
      .eq("id", s.session!.user.id);
    setSaving(false);
    if (completeErr) {
      toast.error("Não foi possível concluir o cadastro", {
        description: completeErr.message || "Tente novamente em instantes.",
      });
      return;
    }
    // Notifica módulos que consomem o snapshot (Smart Receipt etc.)
    invalidateProfile();
    toast.success("Cadastro concluído!");
    navigate({ to: "/dashboard" as string });
  }

  const missingLabels = useMemo(() => missing.map((m) => FIELD_LABELS[m] ?? m), [missing]);

  if (checking) return <PageLineSkeleton />;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Complete seu cadastro"
        description="Informe uma vez — o TrailBook reaproveita seus dados em todos os módulos."
        backTo="/settings"
        crumbs={[{ label: "Configurações", to: "/settings" }, { label: "Dados de perfil" }]}
      />

      {/* Barra de progresso */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-widest text-muted-foreground">
            Perfil {pct}% completo
          </span>
          <span className="text-muted-foreground">Passo {step + 1} de 4</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        {missingLabels.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Faltam: <span className="text-foreground">{missingLabels.join(", ")}</span>
          </p>
        )}
        {/* Trilha dos passos */}
        <div className="mt-3 flex items-center justify-between gap-1">
          {STEP_LABELS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <div key={label} className="flex flex-1 items-center gap-1">
                <div
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={`hidden truncate text-[10px] sm:inline ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        {step === 0 && (
          <>
            <StepHeader icon={<User className="h-4 w-4" />} title="Dados pessoais" />
            <Field label="Nome completo" required>
              <Input
                value={draft.full_name}
                onChange={(e) => update("full_name", e.target.value)}
              />
            </Field>
            <Field label="Como quer ser chamado (opcional)">
              <Input
                value={draft.display_name}
                onChange={(e) => update("display_name", e.target.value)}
                placeholder="Apelido"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF" required help={HELP.cpf}>
                <Input
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={draft.cpf}
                  disabled={cpfLocked}
                  onChange={(e) => update("cpf", maskCPF(e.target.value))}
                />
                {cpfLocked && (
                  <p className="text-[10px] text-muted-foreground">
                    CPF validado.{" "}
                    <Link to="/tickets/cpf-change" className="text-primary underline">
                      Solicitar alteração via suporte
                    </Link>
                    .
                  </p>
                )}
              </Field>
              <Field label="Nascimento" required>
                <Input
                  type="date"
                  value={draft.birth_date}
                  onChange={(e) => update("birth_date", e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <StepHeader icon={<Phone className="h-4 w-4" />} title="Contato" />
            <Field label="E-mail" required>
              <Input value={draft.email} disabled />
            </Field>
            <Field label="Celular" required help={HELP.phone}>
              <Input
                inputMode="tel"
                placeholder="(11) 99999-9999"
                maxLength={16}
                value={draft.phone}
                onChange={(e) => update("phone", maskPhone(e.target.value))}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="wa-same"
                checked={draft.whatsapp_same_as_phone}
                onCheckedChange={(c) => toggleWhatsappSame(!!c)}
              />
              <Label htmlFor="wa-same" className="text-sm">
                Meu WhatsApp é igual ao celular
              </Label>
            </div>
            {!draft.whatsapp_same_as_phone && (
              <Field label="WhatsApp" required help={HELP.whatsapp}>
                <Input
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  value={draft.whatsapp}
                  onChange={(e) => update("whatsapp", maskPhone(e.target.value))}
                />
              </Field>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <StepHeader icon={<MapPin className="h-4 w-4" />} title="Localização" />
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Estado e Cidade *
                </span>
                <HelpTooltip
                  label="Estado e Cidade"
                  text={HELP.stateField + " Também é reutilizado em documentos oficiais."}
                />
              </div>
              <LocationPicker
                value={draft.location}
                onChange={(v) => update("location", v)}
                label=""
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddress((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {showAddress ? "Ocultar endereço" : "Adicionar endereço completo (opcional)"}
            </button>
            {showAddress && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="CEP">
                  <Input
                    value={draft.cep}
                    onChange={(e) => update("cep", e.target.value)}
                    maxLength={9}
                    placeholder="00000-000"
                  />
                </Field>
                <Field label="Bairro">
                  <Input value={draft.bairro} onChange={(e) => update("bairro", e.target.value)} />
                </Field>
                <div className="col-span-2">
                  <Field label="Logradouro">
                    <Input
                      value={draft.logradouro}
                      onChange={(e) => update("logradouro", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Número">
                  <Input value={draft.numero} onChange={(e) => update("numero", e.target.value)} />
                </Field>
                <Field label="Complemento">
                  <Input
                    value={draft.complemento}
                    onChange={(e) => update("complemento", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <StepHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Conferência final" />
            <p className="-mt-1 text-xs text-muted-foreground">
              Revise as informações abaixo. Para corrigir algo, use o botão{" "}
              <span className="font-medium text-foreground">Editar</span> da seção correspondente.
            </p>

            <ReviewBlock
              icon={<User className="h-4 w-4" />}
              title="Dados pessoais"
              onEdit={() => editSection(0)}
            >
              <ReviewRow label="Nome" value={draft.full_name} />
              {draft.display_name && <ReviewRow label="Apelido" value={draft.display_name} />}
              <ReviewRow label="CPF" value={draft.cpf} />
              <ReviewRow label="Nascimento" value={draft.birth_date} />
            </ReviewBlock>

            <ReviewBlock
              icon={<Phone className="h-4 w-4" />}
              title="Contato"
              onEdit={() => editSection(1)}
            >
              <ReviewRow label="E-mail" value={draft.email} />
              <ReviewRow label="Celular" value={draft.phone} />
              <ReviewRow
                label="WhatsApp"
                value={
                  draft.whatsapp_same_as_phone
                    ? draft.phone + " (mesmo do celular)"
                    : draft.whatsapp
                }
              />
            </ReviewBlock>

            <ReviewBlock
              icon={<MapPin className="h-4 w-4" />}
              title="Localização"
              onEdit={() => editSection(2)}
            >
              <ReviewRow label="Cidade / UF" value={draft.location} />
              {(draft.cep || draft.logradouro) && (
                <ReviewRow
                  label="Endereço"
                  value={[
                    draft.logradouro,
                    draft.numero,
                    draft.complemento,
                    draft.bairro,
                    draft.cep,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
            </ReviewBlock>

            <p className="pt-2 text-xs text-muted-foreground">
              Ao concluir, o CPF será travado. Alterações posteriores só através do suporte.
            </p>
          </>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              if (returnToReview) {
                setReturnToReview(false);
                setStep(3);
                return;
              }
              if (step === 0) navigate({ to: "/settings" });
              else setStep(step - 1);
            }}
          >
            <ChevronLeft className="h-4 w-4" />{" "}
            {returnToReview ? "Cancelar" : step === 0 ? "Sair" : "Voltar"}
          </Button>
          {step < 3 ? (
            <Button disabled={saving} onClick={next} className="btn-glow">
              {saving ? "Salvando…" : returnToReview ? "Salvar e voltar à conferência" : "Avançar"}{" "}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={saving} onClick={finish} className="btn-glow">
              {saving ? "Concluindo…" : "Concluir cadastro"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Problemas para concluir?{" "}
        <Link to="/help" className="text-primary hover:underline">
          Preciso de ajuda
        </Link>
      </p>

      <CpfConflictDialog
        open={cpfConflict}
        onOpenChange={setCpfConflict}
        title="Este CPF já está vinculado a outra conta"
        description="O CPF informado já pertence a uma conta existente do TrailBook. Recupere o acesso da conta original ou abra um chamado."
        onRecover={async () => {
          setCpfConflict(false);
          await supabase.auth.signOut();
          navigate({ to: "/auth", search: { tab: "signin" as const, recuperar: undefined } });
          toast.info("Use 'Esqueci minha senha?' com o e-mail da conta original.");
        }}
        onOpenHelp={async () => {
          setCpfConflict(false);
          await supabase.auth.signOut();
          navigate({ to: "/help" });
        }}
        onBackToLogin={async () => {
          setCpfConflict(false);
          await supabase.auth.signOut();
          navigate({ to: "/auth", search: { tab: "signin" as const, recuperar: undefined } });
        }}
      />
    </div>
  );
}

function StepHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
      {icon} {title}
    </div>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
          {required ? " *" : ""}
        </Label>
        {help && <HelpTooltip label={label} text={help} />}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right font-medium">
        {value || <em className="text-muted-foreground">—</em>}
      </span>
    </div>
  );
}

function ReviewBlock({
  icon,
  title,
  onEdit,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background/40 p-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          {icon} {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-8 px-2 text-xs"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      </header>
      <div>{children}</div>
    </section>
  );
}
