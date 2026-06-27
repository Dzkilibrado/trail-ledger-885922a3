import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, QrCode, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [{ title: "Certificados — TrailBook" }] }),
  component: Certificates,
});

function Certificates() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: async () => (await supabase.from("certificates").select("*, motorcycles(nickname, model, brand)").order("created_at", { ascending: false })).data ?? [],
  });

  async function remove(id: string) {
    if (!confirm("Revogar este certificado?")) return;
    const { error } = await supabase.from("certificates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["certificates"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Certificados digitais</h1>
      <p className="text-sm text-muted-foreground">Compartilhe o histórico autorizado da sua moto via link público com QR Code.</p>
      {isLoading ? <div className="text-muted-foreground">Carregando…</div> : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((c) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${c.public_token}`;
            const m: any = c.motorcycles;
            return (
              <div key={c.id} className="surface-elevated flex flex-wrap items-center gap-4 rounded-2xl p-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><QrCode className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{m?.nickname || `${m?.brand} ${m?.model}`}</div>
                  <div className="truncate text-xs text-muted-foreground">{url} · criado em {formatDate(c.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /> Copiar</Button>
                  <Link to="/c/$token" params={{ token: c.public_token }}><Button size="sm" variant="outline">Abrir</Button></Link>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="surface-elevated rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Nenhum certificado gerado. Abra uma moto e clique em <strong>Gerar certificado</strong>.
        </div>
      )}
    </div>
  );
}