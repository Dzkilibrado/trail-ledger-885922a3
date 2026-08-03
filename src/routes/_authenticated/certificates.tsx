import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, QrCode, Trash2, Settings2, ExternalLink, RefreshCcw, ShieldOff, Activity, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/trailbook";
import { CertificateSettingsDialog } from "@/components/CertificateSettingsDialog";
import { CertificateAccessLogDialog } from "@/components/CertificateAccessLogDialog";
import { effectiveStatus, STATUS_LABEL, STATUS_TONE, AUDIENCE_LABEL, type CertAudience } from "@/lib/cert-sections";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/Skeletons";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [{ title: "Certificados — TrailBook" }] }),
  component: Certificates,
});

function Certificates() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: async () => (await supabase.from("certificates").select("*, motorcycles(id, nickname, model, brand)").order("created_at", { ascending: false })).data ?? [],
  });

  async function revoke(id: string) {
    if (!confirm("Revogar este certificado? O link público deixará de funcionar.")) return;
    const { error } = await supabase.from("certificates").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Certificado revogado");
    qc.invalidateQueries({ queryKey: ["certificates"] });
  }
  async function reactivate(id: string) {
    const { error } = await supabase.from("certificates").update({ status: "active" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Certificado reativado");
    qc.invalidateQueries({ queryKey: ["certificates"] });
  }
  async function destroy(id: string) {
    if (!confirm("Excluir permanentemente este certificado?")) return;
    const { error } = await supabase.from("certificates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["certificates"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificados digitais"
        description="Compartilhe o histórico autorizado da sua moto via link público com QR Code. Qualquer pessoa com o link pode abrir as seções que você liberar."
      />
      {isLoading ? (
        <ListRowsSkeleton rows={3} />
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((c) => {
            const url = shareUrl(`/c/${c.public_token}`);
            const m: any = c.motorcycles;
            const eff = effectiveStatus(c as any);
            const isActive = eff === "active";
            return (
              <div key={c.id} className="surface-elevated flex flex-wrap items-center gap-4 rounded-2xl p-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><QrCode className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{m?.nickname || `${m?.brand} ${m?.model}`}</div>
                    <Badge variant="outline" className={STATUS_TONE[eff]}>{STATUS_LABEL[eff]}</Badge>
                    {(c as any).audience && (c as any).audience !== "custom" ? (
                      <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                        <Users className="mr-1 h-3 w-3" /> {AUDIENCE_LABEL[(c as any).audience as CertAudience] ?? (c as any).audience}
                      </Badge>
                    ) : null}
                    {c.expires_at ? <span className="text-[11px] text-muted-foreground">expira em {formatDate(c.expires_at)}</span> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{isActive ? url : "link inativo"} · criado em {formatDate(c.created_at)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isActive ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /> Copiar</Button>
                      <Link to="/c/$token" params={{ token: c.public_token }}><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4" /> Abrir</Button></Link>
                    </>
                  ) : eff === "revoked" || eff === "private" ? (
                    <Button size="sm" variant="outline" onClick={() => reactivate(c.id)}><RefreshCcw className="h-4 w-4" /> Reativar</Button>
                  ) : null}
                  <CertificateAccessLogDialog
                    certificateId={c.id}
                    trigger={<Button size="sm" variant="outline"><Activity className="h-4 w-4" /> Acessos</Button>}
                  />
                  {m?.id ? (
                    <CertificateSettingsDialog
                      motorcycleId={m.id}
                      existing={c as any}
                      trigger={<Button size="sm" variant="outline"><Settings2 className="h-4 w-4" /> Configurar</Button>}
                    />
                  ) : null}
                  {isActive ? (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => revoke(c.id)}><ShieldOff className="h-4 w-4" /> Revogar</Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => destroy(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
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