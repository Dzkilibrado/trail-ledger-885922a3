import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, LifeBuoy, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isValidCPF, maskCPF, maskPhone, onlyDigits } from "@/lib/br-validators";

export const Route = createFileRoute("/help")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Preciso de ajuda para acessar minha conta — TrailBook" },
      { name: "description", content: "Abra um chamado de suporte para recuperar seu acesso ao TrailBook." },
    ],
  }),
  component: HelpPage,
});

const PROBLEM_TYPES = [
  { value: "forgot_access", label: "Esqueci meu acesso" },
  { value: "cpf_exists", label: "CPF já cadastrado" },
  { value: "no_confirmation_email", label: "Não recebi e-mail de confirmação" },
  { value: "changed_email", label: "Troquei de e-mail" },
  { value: "changed_phone", label: "Troquei de telefone" },
  { value: "google_login_issue", label: "Problema com login Google" },
  { value: "account_blocked", label: "Conta bloqueada" },
  { value: "other", label: "Outro" },
] as const;

const schema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo").max(120),
  birthDate: z.string().min(1, "Informe a data de nascimento"),
  cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido"),
  phone: z.string().refine((v) => onlyDigits(v).length >= 10, "WhatsApp inválido"),
  email: z.string().trim().email("E-mail inválido").max(255),
  problemType: z.string().min(1, "Selecione o tipo de problema"),
  problemOther: z.string().optional(),
  description: z.string().trim().min(10, "Descreva o problema com mais detalhes").max(2000),
}).refine((d) => d.problemType !== "other" || (d.problemOther && d.problemOther.trim().length >= 3), {
  path: ["problemOther"], message: "Detalhe o tipo do problema",
});

function HelpPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "", birthDate: "", cpf: "", phone: "", email: "",
    problemType: "", problemOther: "", description: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { data, error } = await supabase.rpc("submit_help_request", {
      _full_name: form.fullName.trim(),
      _birth_date: form.birthDate,
      _cpf: onlyDigits(form.cpf),
      _phone: form.phone,
      _email: form.email.trim(),
      _problem_type: form.problemType,
      _description: form.description.trim(),
      _problem_other: form.problemOther?.trim() || undefined,
      _user_agent: navigator.userAgent.slice(0, 512),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setTicketCode((data as string | null) ?? "—");
    toast.success("Chamado registrado. Nossa equipe entrará em contato.");
  }

  return (
    <div className="min-h-dvh surface-hero px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold">TrailBook</span>
        </Link>

        <div className="surface-elevated rounded-2xl p-6 sm:p-8">
          {ticketCode ? (
            <div className="text-center py-6">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 font-display text-2xl font-bold">Chamado registrado!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu número de protocolo é
              </p>
              <p className="mt-1 font-mono text-lg font-semibold">{ticketCode}</p>
              <p className="mt-4 text-sm text-muted-foreground max-w-md mx-auto">
                Nossa equipe vai avaliar sua solicitação e entrar em contato pelo e-mail ou WhatsApp informado.
                Por segurança, nunca compartilhamos dados de conta neste canal — o atendimento é manual.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="outline" onClick={() => { setTicketCode(null); setForm({ fullName: "", birthDate: "", cpf: "", phone: "", email: "", problemType: "", problemOther: "", description: "" }); }}>
                  Abrir outro chamado
                </Button>
                <Button className="btn-glow" onClick={() => navigate({ to: "/auth" })}>Voltar ao login</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold">Preciso de ajuda para acessar minha conta</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preencha os dados abaixo e nossa equipe entrará em contato. Este canal não expõe dados da sua conta — todo atendimento é feito manualmente por um administrador.
                  </p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={submit}>
                <Field label="Nome completo *">
                  <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required autoComplete="name" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Data de nascimento *">
                    <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} required />
                  </Field>
                  <Field label="CPF *">
                    <Input inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
                      value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} required />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="WhatsApp *">
                    <Input inputMode="tel" placeholder="(11) 99999-9999" maxLength={16}
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} required autoComplete="tel" />
                  </Field>
                  <Field label="E-mail de contato *">
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
                  </Field>
                </div>
                <Field label="Tipo do problema *">
                  <Select value={form.problemType} onValueChange={(v) => setForm({ ...form, problemType: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {PROBLEM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {form.problemType === "other" && (
                  <Field label="Detalhe o tipo do problema *">
                    <Input value={form.problemOther} onChange={(e) => setForm({ ...form, problemOther: e.target.value })} required />
                  </Field>
                )}
                <Field label="Descrição *">
                  <Textarea rows={5} maxLength={2000}
                    placeholder="Explique com detalhes o que está acontecendo. Inclua o que você já tentou (ex.: reset de senha, reenvio de e-mail)."
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                </Field>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button type="button" variant="outline" className="sm:w-40" onClick={() => navigate({ to: "/auth" })}>Voltar ao login</Button>
                  <Button type="submit" className="flex-1 btn-glow" disabled={loading}>
                    {loading ? "Enviando…" : "Enviar chamado"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Ao enviar você concorda com os{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">Termos de Uso</a>
                  {" "}e a{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">Política de Privacidade</a>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}