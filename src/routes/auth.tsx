import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { isValidCPF, maskCPF, onlyDigits, maskPhone } from "@/lib/br-validators";
import { ResendConfirmationButton } from "@/components/ResendConfirmationButton";
import { CpfConflictDialog } from "@/components/CpfConflictDialog";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search["tab"] === "signup" ? ("signup" as const) : ("signin" as const),
    recuperar: search["recuperar"] === "1" || search["recuperar"] === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — TrailBook" },
      { name: "description", content: "Acesse o prontuário digital da sua moto de trilha." },
    ],
  }),
  component: AuthPage,
});

const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72);
const emailSchema = z.string().trim().email("E-mail inválido").max(255);

const signupSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo").max(120),
    cpf: z.string().refine((v) => isValidCPF(v), "CPF inválido"),
    birthDate: z.string().refine((v) => {
      if (!v) return false;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 16 && age < 120;
    }, "Data de nascimento inválida"),
    phone: z.string().refine((v) => onlyDigits(v).length >= 10, "Celular inválido"),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    accept: z.boolean(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem",
  })
  .refine((d) => d.accept, { path: ["accept"], message: "Você precisa aceitar os termos" });

// Setup non-persistent session when "remember me" is unchecked (best-effort).
function armEphemeralSession() {
  const handler = () => {
    void supabase.auth.signOut();
  };
  window.addEventListener("beforeunload", handler);
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<{ status: string; reason: string } | null>(
    null,
  );
  // Sign-in state
  const [identifier, setIdentifier] = useState(""); // email OR CPF
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  // Sign-up state
  const [su, setSu] = useState({
    fullName: "",
    cpf: "",
    birthDate: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
    accept: false,
  });
  // Forgot-password state
  const [forgotOpen, setForgotOpen] = useState(Boolean(search.recuperar));
  const [forgotEmail, setForgotEmail] = useState("");
  // Post-signup confirmation state
  const [signupSent, setSignupSent] = useState<string | null>(null);
  // CPF conflict dialog
  const [cpfConflict, setCpfConflict] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" as string });
    });
    try {
      const p = new URLSearchParams(window.location.search);
      const b = p.get("blocked");
      if (b === "blocked" || b === "inactive") {
        setBlockedNotice({ status: b, reason: p.get("reason") || "" });
      }
    } catch {}
  }, [navigate]);

  async function resolveEmail(input: string): Promise<string | null> {
    const trimmed = input.trim();
    if (trimmed.includes("@")) return trimmed;
    const digits = onlyDigits(trimmed);
    if (digits.length !== 11) return null;
    if (!isValidCPF(digits)) {
      toast.error("CPF inválido");
      return null;
    }
    const { data, error } = await supabase.rpc("get_email_by_cpf", { _cpf: digits });
    if (error) {
      toast.error(error.message);
      return null;
    }
    if (!data) {
      toast.error("Nenhuma conta encontrada para este CPF");
      return null;
    }
    return data as string;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // hard guard against double submit
    setLoading(true);
    setUnconfirmedEmail(null);
    try {
      const email = await resolveEmail(identifier);
      if (!email) {
        setLoading(false);
        return;
      }
      if (!password || password.length < 6) {
        setLoading(false);
        return toast.error("Informe sua senha (mínimo 6 caracteres).");
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const msg = error.message || "";
        if (/confirm/i.test(msg) || /not confirmed/i.test(msg)) {
          setUnconfirmedEmail(email);
          toast.error(
            "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e SPAM.",
          );
        } else if (/invalid login credentials/i.test(msg) || /invalid.*password/i.test(msg)) {
          toast.error("E-mail ou senha incorretos.");
        } else if (/rate limit|too many/i.test(msg)) {
          toast.error("Muitas tentativas. Aguarde alguns instantes e tente novamente.");
        } else if (/network|fetch|failed to fetch/i.test(msg)) {
          toast.error("Não foi possível conectar agora. Verifique sua internet e tente novamente.");
        } else if (/banned|blocked/i.test(msg)) {
          toast.error("Seu acesso está bloqueado. Entre em contato com o suporte.");
        } else {
          toast.error(msg || "Não foi possível entrar. Tente novamente.");
        }
        return;
      }
      if (!remember) armEphemeralSession();
      navigate({ to: "/dashboard" as string, replace: true });
    } catch (err: any) {
      toast.error(
        err?.message?.includes("fetch")
          ? "Não foi possível conectar agora. Verifique sua internet e tente novamente."
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(su);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: su.email.trim(),
      password: su.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: su.fullName.trim(),
          cpf: onlyDigits(su.cpf),
          birth_date: su.birthDate,
          phone: su.phone,
        },
      },
    });
    setLoading(false);
    if (error) {
      if (/CPF já cadastrado/i.test(error.message)) {
        setCpfConflict(true);
        return;
      }
      const msg = /cpf/i.test(error.message)
        ? error.message.replace(/^.*CPF/i, "CPF")
        : error.message;
      return toast.error(msg);
    }
    // Sinal oficial do Supabase para "e-mail já tem conta confirmada": o
    // cadastro não retorna erro (por segurança, para não revelar quais
    // e-mails existem no sistema), mas o usuário retornado vem sem
    // nenhuma "identity" — não é criada uma conta nova de verdade, nem é
    // enviado e-mail nenhum. Sem esse aviso, a pessoa fica esperando um
    // e-mail que nunca chega.
    if (data?.user && data.user.identities?.length === 0) {
      toast.error("Este e-mail já tem uma conta no TrailBook", {
        description:
          'Você pode entrar normalmente, ou usar "Esqueci minha senha" se não lembra o acesso.',
      });
      setIdentifier(su.email.trim());
      navigate({ to: "/auth", search: { tab: "signin" } });
      return;
    }
    setSignupSent(su.email.trim());
    toast.success("Conta criada! Enviamos um e-mail de confirmação.");
  }

  async function handleGoogle() {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setLoading(false);
    if (res.error) return toast.error("Erro ao entrar com Google");
    if (!res.redirected) navigate({ to: "/dashboard" as string });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(forgotEmail);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(
      "Se este e-mail existir, enviamos um link de redefinição. Verifique a caixa de entrada e a pasta de SPAM.",
    );
    setForgotOpen(false);
  }

  return (
    <div className="min-h-dvh surface-hero grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src="/icons/icon-192.png" alt="TrailBook" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-xl font-bold">TrailBook</span>
        </Link>
        <div className="surface-elevated rounded-2xl p-6">
          {blockedNotice && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <strong>
                {blockedNotice.status === "blocked"
                  ? "Seu acesso está bloqueado."
                  : "Sua conta está inativa."}
              </strong>{" "}
              Entre em contato com o suporte.
              {blockedNotice.reason && (
                <div className="mt-1 opacity-80">Motivo: {blockedNotice.reason}</div>
              )}
            </div>
          )}
          {signupSent ? (
            <div className="text-center py-4">
              <h2 className="font-display text-xl font-bold">Confirme seu e-mail</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enviamos um link de confirmação para <strong>{signupSent}</strong>. Clique no link
                para ativar sua conta.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Não recebeu? Aguarde 1–2 minutos e verifique a caixa de{" "}
                <strong>SPAM/lixo eletrônico</strong>.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <ResendConfirmationButton
                  email={signupSent}
                  variant="default"
                  className="btn-glow"
                />
                <Button variant="ghost" size="sm" onClick={() => setSignupSent(null)}>
                  Voltar ao login
                </Button>
                <Link to="/help" className="text-xs text-primary hover:underline mt-1">
                  Preciso de ajuda
                </Link>
              </div>
            </div>
          ) : (
            <Tabs defaultValue={search.tab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                {forgotOpen ? (
                  <form className="space-y-4" onSubmit={handleForgot}>
                    <Field label="E-mail cadastrado">
                      <Input
                        type="email"
                        autoFocus
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setForgotOpen(false)}
                      >
                        Voltar
                      </Button>
                      <Button disabled={loading} type="submit" className="flex-1 btn-glow">
                        Enviar link
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form className="space-y-4" onSubmit={handleSignIn}>
                    <Field label="E-mail ou CPF">
                      <Input
                        type="text"
                        autoComplete="username"
                        placeholder="voce@email.com ou 000.000.000-00"
                        value={identifier}
                        onChange={(e) => {
                          const v = e.target.value;
                          // If it looks like a CPF (mostly digits, no @), apply mask.
                          if (
                            !v.includes("@") &&
                            /^[\d.\-\s]*$/.test(v) &&
                            onlyDigits(v).length > 0
                          ) {
                            setIdentifier(maskCPF(v));
                          } else {
                            setIdentifier(v);
                          }
                        }}
                        required
                      />
                    </Field>
                    <Field label="Senha">
                      <Input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </Field>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                        Lembrar de mim
                      </label>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => {
                          setForgotEmail(identifier.includes("@") ? identifier : "");
                          setForgotOpen(true);
                        }}
                      >
                        Esqueci minha senha?
                      </button>
                    </div>
                    <Button disabled={loading} type="submit" className="w-full btn-glow">
                      Entrar
                    </Button>
                    {unconfirmedEmail && (
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
                        <p className="text-muted-foreground">
                          Seu e-mail <strong>{unconfirmedEmail}</strong> ainda não foi confirmado.
                          Verifique sua caixa de entrada e a pasta de SPAM.
                        </p>
                        <ResendConfirmationButton email={unconfirmedEmail} />
                      </div>
                    )}
                    <div className="text-center pt-1">
                      <Link
                        to="/help"
                        className="text-xs text-muted-foreground hover:text-primary hover:underline"
                      >
                        Preciso de ajuda para acessar minha conta
                      </Link>
                    </div>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <form className="space-y-3" onSubmit={handleSignUp}>
                  <Field label="Nome completo">
                    <Input
                      value={su.fullName}
                      onChange={(e) => setSu({ ...su, fullName: e.target.value })}
                      required
                      autoComplete="name"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CPF">
                      <Input
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={su.cpf}
                        onChange={(e) => setSu({ ...su, cpf: maskCPF(e.target.value) })}
                        required
                        maxLength={14}
                      />
                    </Field>
                    <Field label="Nascimento">
                      <Input
                        type="date"
                        value={su.birthDate}
                        onChange={(e) => setSu({ ...su, birthDate: e.target.value })}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Celular">
                    <Input
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      value={su.phone}
                      onChange={(e) => setSu({ ...su, phone: maskPhone(e.target.value) })}
                      required
                      maxLength={16}
                      autoComplete="tel"
                    />
                  </Field>
                  <Field label="E-mail">
                    <Input
                      type="email"
                      value={su.email}
                      onChange={(e) => setSu({ ...su, email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Senha">
                      <Input
                        type="password"
                        value={su.password}
                        onChange={(e) => setSu({ ...su, password: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label="Confirmar senha">
                      <Input
                        type="password"
                        value={su.confirm}
                        onChange={(e) => setSu({ ...su, confirm: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                    <Checkbox
                      checked={su.accept}
                      onCheckedChange={(v) => setSu({ ...su, accept: !!v })}
                      className="mt-0.5"
                    />
                    <span>
                      Li e aceito os{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Termos de Uso
                      </a>{" "}
                      e a{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Política de Privacidade
                      </a>
                      .
                    </span>
                  </label>
                  <Button disabled={loading} type="submit" className="w-full btn-glow">
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" disabled={loading} onClick={handleGoogle}>
            Continuar com Google
          </Button>
        </div>
      </div>
      <CpfConflictDialog
        open={cpfConflict}
        onOpenChange={setCpfConflict}
        onRecover={() => {
          setCpfConflict(false);
          setForgotEmail(su.email || "");
          setForgotOpen(true);
        }}
        onOpenHelp={() => {
          setCpfConflict(false);
          navigate({ to: "/help" });
        }}
        onBackToLogin={() => {
          setCpfConflict(false);
        }}
      />
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
