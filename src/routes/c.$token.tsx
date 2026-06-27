import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EVENT_TYPE_LABEL, formatDate, brl } from "@/lib/trailbook";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { Bike, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/c/$token")({
  head: () => ({ meta: [{ title: "Certificado TrailBook" }] }),
  component: PublicCert,
});

function makePublicClient() {
  return createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function PublicCert() {
  const { token } = Route.useParams();
  const [state, setState] = useState<{ loading: boolean; cert?: any; moto?: any; events?: any[]; error?: string }>({ loading: true });

  useEffect(() => {
    const sb = makePublicClient();
    (async () => {
      const { data: cert } = await sb.from("certificates").select("*").eq("public_token", token).maybeSingle();
      if (!cert) { setState({ loading: false, error: "Certificado inválido ou revogado." }); return; }
      // Note: events/motorcycles tables require auth — public cert just shows metadata.
      // Owner must allow public view; for now we render certificate info.
      setState({ loading: false, cert });
    })();
  }, [token]);

  if (state.loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (state.error) return <div className="grid min-h-screen place-items-center text-muted-foreground">{state.error}</div>;

  return (
    <div className="min-h-screen surface-hero">
      <div className="container mx-auto max-w-2xl px-6 py-12">
        <div className="surface-elevated rounded-3xl p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground btn-glow">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Certificado TrailBook</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este certificado comprova que a motocicleta possui um prontuário digital ativo no TrailBook.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Token</div>
            <div className="font-mono text-sm break-all">{state.cert.public_token}</div>
            <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Emitido em</div>
            <div className="text-sm">{formatDate(state.cert.created_at)}</div>
            {state.cert.expires_at && (
              <>
                <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Expira em</div>
                <div className="text-sm">{formatDate(state.cert.expires_at)}</div>
              </>
            )}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Para visualizar o histórico completo, o proprietário precisa autorizar o compartilhamento.
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Bike className="h-4 w-4" /> TrailBook · Prontuário digital para motos off-road
        </div>
      </div>
    </div>
  );
}