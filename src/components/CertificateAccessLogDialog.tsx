import { ListRowsSkeleton } from "@/components/Skeletons";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

type Props = { certificateId: string; trigger: React.ReactNode };

function parseUa(ua: string | null | undefined): string {
  if (!ua) return "—";
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desconhecido";
}

export function CertificateAccessLogDialog({ certificateId, trigger }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["certificate_access_log", certificateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_access_log")
        .select("id, accessed_at, ip, user_agent, referer, country")
        .eq("certificate_id", certificateId)
        .order("accessed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Log de acessos</DialogTitle>
          <DialogDescription>
            Cada abertura do link público é registrada aqui — apenas você (dono da moto) enxerga.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="p-4"><ListRowsSkeleton rows={3} /></div>
        ) : !data || data.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum acesso registrado ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Data / hora</th>
                  <th className="px-2 py-2 text-left">Dispositivo</th>
                  <th className="px-2 py-2 text-left">Origem</th>
                  <th className="px-2 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(r.accessed_at as string).toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2">{parseUa(r.user_agent)}</td>
                    <td className="px-2 py-2 max-w-[180px] truncate" title={r.referer ?? ""}>{r.referer || "direto"}</td>
                    <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{r.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <DialogClose asChild>
            <Button variant="ghost">Fechar</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}