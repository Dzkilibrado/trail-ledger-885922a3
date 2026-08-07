import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/br-validators";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Info,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useProfileSnapshot } from "@/hooks/useProfileSnapshot";

/**
 * Fluxo excepcional de alteração de CPF via suporte (Fase E).
 * Fluxo mobile-first em 5 passos: motivo → novo CPF → documento → declaração → envio.
 * Cria um chamado tipo `cpf_change` e uma request em `cpf_change_requests`.
 * Aprovação/rejeição ficam com o admin. CPF NUNCA muda direto pelo cliente.
 */
export const Route = createFileRoute("/_authenticated/tickets/cpf-change")({
  head: () => ({ meta: [{ title: "Solicitar alteração de CPF — TrailBook" }] }),
  component: CpfChangePage,
});

const MAX_MB = 5;
const ACCEPT = ["image/jpeg", "image/png", "application/pdf"];

function CpfChangePage() {
  const navigate = useNavigate();
  const profile = useProfileSnapshot();
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [confirmCpf, setConfirmCpf] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [truth, setTruth] = useState(false);
  const [sending, setSending] = useState(false);

  const currentCpfMasked = useMemo(
    () =>
      profile.data?.cpf
        ? maskCPF(profile.data.cpf).replace(/\d/g, (d, i, s) => (i < s.length - 2 ? "*" : d))
        : "—",
    [profile.data?.cpf],
  );
  const newCpfDigits = onlyDigits(newCpf);

  function validateStep(): string | null {
    if (step === 0 && reason.trim().length < 10) return "Descreva o motivo (mínimo 10 caracteres).";
    if (step === 1) {
      if (!isValidCPF(newCpfDigits)) return "Novo CPF inválido.";
      if (onlyDigits(confirmCpf) !== newCpfDigits) return "A confirmação do CPF não confere.";
      if (profile.data?.cpf === newCpfDigits) return "O novo CPF é igual ao atual.";
    }
    if (step === 2) {
      if (!file) return "Anexe o documento comprobatório.";
      if (!ACCEPT.includes(file.type)) return "Formato inválido. Use JPG, PNG ou PDF.";
      if (file.size > MAX_MB * 1024 * 1024) return `Arquivo maior que ${MAX_MB} MB.`;
    }
    if (step === 3 && !truth) return "Marque a declaração de veracidade.";
    return null;
  }

  async function next() {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  }

  async function submit() {
    if (validateStep() != null || !file) return;
    setSending(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.user) throw new Error("Não autenticado");

      // 1) cria chamado do tipo cpf_change
      const { data: ticket, error: tErr } = await supabase
        .from("tickets")
        .insert({
          user_id: s.session!.user.id,
          type: "cpf_change" as never,
          module: "account" as never,
          priority: "high" as never,
          title: "Solicitação de alteração de CPF",
          description: reason.trim(),
        })
        .select("id")
        .single();
      if (tErr || !ticket) throw new Error(tErr?.message ?? "Falha ao abrir chamado");

      // 2) upload do documento no bucket privado
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const path = `${s.session!.user.id}/${ticket.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("cpf-change-docs").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);

      // 3) submissão via RPC
      const { error: rpcErr } = await supabase.rpc(
        "submit_cpf_change_request" as never,
        {
          _ticket_id: ticket.id,
          _new_cpf: newCpfDigits,
          _reason: reason.trim(),
          _document_path: path,
        } as never,
      );
      if (rpcErr) {
        // Rollback upload em caso de falha da RPC
        await supabase.storage.from("cpf-change-docs").remove([path]);
        throw new Error(rpcErr.message);
      }

      // Não invalidamos o snapshot aqui: o CPF só muda após aprovação do admin.
      // A invalidação real acontece via refetchOnMount/refetchOnWindowFocus do
      // `useProfileSnapshot` na próxima abertura do perfil / retomada do app.
      toast.success("Solicitação enviada. Acompanhe no chamado.");
      navigate({ to: "/tickets/$id", params: { id: ticket.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar solicitação");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title="Solicitar alteração de CPF"
        description="Fluxo excepcional. A alteração depende de análise pela equipe de suporte."
        crumbs={[{ label: "Perfil", to: "/perfil" }, { label: "Alteração de CPF" }]}
      />

      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Seu CPF atual permanece ativo até a aprovação.</p>
            <p className="mt-1 text-amber-200/80">
              Análise em até 2 dias úteis. Você será notificado no chamado.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="text-xs text-muted-foreground">Passo {step + 1} de 5</div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((step + 1) / 5) * 100}%` }}
          />
        </div>

        {step === 0 && (
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da alteração</Label>
            <Textarea
              id="reason"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique com clareza (ex.: cadastro inicial com número incorreto, decisão judicial, etc.)"
              maxLength={2000}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <IdCard className="h-3.5 w-3.5" /> CPF atual
              </div>
              <div className="mt-1 font-mono text-base">{currentCpfMasked}</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newCpf">Novo CPF</Label>
              <Input
                id="newCpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                value={newCpf}
                onChange={(e) => setNewCpf(maskCPF(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmCpf">Confirme o novo CPF</Label>
              <Input
                id="confirmCpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                value={confirmCpf}
                onChange={(e) => setConfirmCpf(maskCPF(e.target.value))}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <Label>Documento comprobatório (JPG, PNG ou PDF — até {MAX_MB} MB)</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background/40 p-4 text-sm">
              <Upload className="h-4 w-4 text-primary" />
              <div className="flex-1">
                {file ? (
                  <>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB · {file.type}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">Toque para escolher um arquivo</span>
                )}
              </div>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5" />
              Envie CNH, RG ou comprovante oficial que mostre o CPF correto. Documento fica em
              bucket privado, acessível apenas por você e pelos administradores autorizados.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <Checkbox checked={truth} onCheckedChange={(v) => setTruth(!!v)} className="mt-0.5" />
              <span>
                Declaro, sob as penas da lei, que as informações e o documento anexado são
                verdadeiros e de minha inteira responsabilidade. Estou ciente de que informações
                falsas podem resultar em bloqueio da conta e sanções legais.
              </span>
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Revisão</div>
            <Row k="CPF atual" v={currentCpfMasked} />
            <Row k="Novo CPF" v={newCpf} />
            <Row k="Documento" v={file?.name ?? ""} />
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Motivo</div>
              <p className="mt-1 whitespace-pre-wrap">{reason}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 0 || sending}
            onClick={() => setStep(step - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < 4 ? (
            <Button onClick={next} className="btn-glow">
              Avançar <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={sending} className="btn-glow">
              {sending ? (
                "Enviando…"
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Enviar solicitação
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prefere falar com o suporte antes?{" "}
        <Link to="/help" className="text-primary hover:underline">
          Central de Ajuda
        </Link>
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v || "—"}</span>
    </div>
  );
}
