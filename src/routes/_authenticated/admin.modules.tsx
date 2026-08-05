import { PageLineSkeleton } from "@/components/Skeletons";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useModules } from "@/hooks/useModules";
import { AccessDenied } from "./admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUS_META,
  LINKED_MODULE_KEYS,
  type ModuleStatus,
  type PlatformModule,
} from "@/lib/modules";
import { Save, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/modules")({
  head: () => ({ meta: [{ title: "Módulos do Sistema — TrailBook" }] }),
  component: AdminModules,
});

function AdminModules() {
  const { isAdmin, loading } = useIsAdmin();
  const modulesQ = useModules();

  if (loading || modulesQ.isLoading) return <PageLineSkeleton />;
  if (!isAdmin) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Módulos do Sistema"
        description="Controle o status de cada funcionalidade da plataforma sem publicar nova versão."
      />
      <div className="grid gap-3">
        {(modulesQ.data ?? []).map((m) => (
          <ModuleRow key={m.id} mod={m} />
        ))}
      </div>
    </div>
  );
}

function ModuleRow({ mod }: { mod: PlatformModule }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ModuleStatus>(mod.status);
  const [msg, setMsg] = useState(mod.maintenance_message ?? "");
  const [reason, setReason] = useState(mod.maintenance_reason ?? "");
  const [until, setUntil] = useState(
    mod.maintenance_until ? mod.maintenance_until.slice(0, 10) : "",
  );
  const [hide, setHide] = useState(mod.hide_when_disabled);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setStatus(mod.status);
    setMsg(mod.maintenance_message ?? "");
    setReason(mod.maintenance_reason ?? "");
    setUntil(mod.maintenance_until ? mod.maintenance_until.slice(0, 10) : "");
    setHide(mod.hide_when_disabled);
  }, [mod]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_module" as any, {
        _key: mod.key,
        _status: status,
        _maintenance_message: msg || null,
        _maintenance_until: until ? new Date(until).toISOString() : null,
        _maintenance_reason: reason || null,
        _hide_when_disabled: hide,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Módulo "${mod.label}" atualizado`);
      qc.invalidateQueries({ queryKey: ["platform-modules"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const meta = STATUS_META[mod.status];
  const linked = LINKED_MODULE_KEYS.has(mod.key);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold">{mod.label}</h3>
            <Badge variant="outline" className={meta.tone}>
              {meta.emoji} {meta.label}
            </Badge>
            {!linked && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-400"
              >
                <AlertTriangle className="mr-1 h-3 w-3" /> Não vinculado a nenhuma rota
              </Badge>
            )}
          </div>
          {mod.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{mod.description}</p>
          )}
          {!linked && (
            <p className="mt-0.5 text-xs text-amber-400/80">
              Alterar o status deste módulo não afeta nenhuma tela do sistema hoje — não há rota
              associada a ele.
            </p>
          )}
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{mod.key}</p>
        </div>
        <Button
          size="sm"
          variant={open ? "secondary" : "outline"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fechar" : "Configurar"}
        </Button>
      </div>

      {open && (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ModuleStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as ModuleStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].emoji} {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Previsão de retorno (opcional)</Label>
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Mensagem exibida ao usuário</Label>
            <Textarea
              rows={2}
              placeholder="Estamos realizando melhorias nesta funcionalidade…"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Motivo interno (auditoria)</Label>
            <Textarea
              rows={2}
              placeholder="Ex.: migração do banco, correção de bug crítico…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 md:col-span-2">
            <div>
              <div className="text-sm font-medium">Ocultar do menu quando desabilitado</div>
              <p className="text-xs text-muted-foreground">
                Se desativado, o módulo aparece na navegação em estado bloqueado.
              </p>
            </div>
            <Switch checked={hide} onCheckedChange={setHide} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
