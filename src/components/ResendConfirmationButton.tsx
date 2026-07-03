import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  email: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
}

export function ResendConfirmationButton({ email, className, variant = "outline", size = "sm" }: Props) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  async function handle() {
    if (!email || !email.includes("@")) return toast.error("Informe um e-mail válido");
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos novamente o e-mail de confirmação. Verifique também a caixa de SPAM/lixo eletrônico.");
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} disabled={loading || cooldown > 0} onClick={handle}>
      {loading ? "Enviando…" : cooldown > 0 ? `Aguarde ${cooldown}s` : "Reenviar e-mail de confirmação"}
    </Button>
  );
}