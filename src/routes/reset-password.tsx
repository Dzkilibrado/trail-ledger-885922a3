import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — TrailBook" },
      { name: "description", content: "Defina uma nova senha para acessar o TrailBook." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-parses the recovery token from the URL hash and fires
    // a PASSWORD_RECOVERY event with a temporary session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (password !== confirm) return toast.error("As senhas não coincidem");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada. Faça login novamente.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-dvh surface-hero grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground btn-glow">
            <Bike className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold">TrailBook</span>
        </Link>
        <div className="surface-elevated rounded-2xl p-6">
          <h1 className="font-display text-xl font-bold mb-1">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground mb-5">Escolha uma nova senha para sua conta.</p>
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Validando link… Se você não chegou aqui pelo e-mail de redefinição,{" "}
              <Link to="/auth" className="text-primary hover:underline">volte ao login</Link>.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Nova senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Confirmar senha</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              </div>
              <Button disabled={loading} type="submit" className="w-full btn-glow">Salvar nova senha</Button>
              <Link
                to="/perfil"
                className="block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar e voltar
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}