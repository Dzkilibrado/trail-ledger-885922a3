import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useModule } from "@/hooks/useModules";

export const Route = createFileRoute("/_authenticated/perfil/conta")({
  head: () => ({
    meta: [{ title: "Gerenciar conta — TrailBook" }],
  }),
  component: ManageAccountPage,
});

function ManageAccountPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-24">
      <PageHeader
        title="Gerenciar conta"
        crumbs={[{ label: "Minha Conta", to: "/perfil" }, { label: "Gerenciar conta" }]}
        description="Ações sensíveis e permanentes. Leia a descrição de cada uma com atenção antes de continuar."
      />
      <ResetCard />
      <DeleteCard />
    </div>
  );
}

function ResetCard() {
  const { status } = useModule("account_reset");
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (status === "disabled") return null;
  const blocked = status === "maintenance";

  async function confirm() {
    setLoading(true);
    const { error } = await supabase.rpc("reset_own_account" as any);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir sua conta", { description: error.message });
      return;
    }
    setOpen(false);
    setWord("");
    await qc.invalidateQueries();
    toast.success("Conta redefinida. Você pode cadastrar sua primeira moto quando quiser.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold">Redefinir conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apaga todas as suas motos, manutenções, documentos, certificados e registros. Seu login
            e cadastro continuam ativos — fica como se você tivesse acabado de se cadastrar, pronto
            para adicionar sua primeira moto.
          </p>
          <p className="mt-2 text-xs font-semibold text-amber-400">
            Esta ação não pode ser desfeita.
          </p>
          <Button
            variant="outline"
            className="mt-4 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            disabled={blocked}
            onClick={() => setOpen(true)}
          >
            {blocked ? "Em manutenção" : "Redefinir conta"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setWord("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" /> Redefinir sua conta?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Todas as suas motos, manutenções, documentos e certificados serão apagados
                permanentemente. Seu login continua funcionando normalmente.
              </span>
              <span className="block">
                Para confirmar, digite <strong className="text-foreground">REDEFINIR</strong>{" "}
                abaixo.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value.toUpperCase())}
            placeholder="REDEFINIR"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40"
              disabled={word !== "REDEFINIR" || loading}
              onClick={confirm}
            >
              {loading ? "Redefinindo…" : "Redefinir conta"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteCard() {
  const { status } = useModule("account_deletion");
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);

  if (status === "disabled") return null;
  const blocked = status === "maintenance";

  async function confirm() {
    setLoading(true);
    const { error } = await supabase.rpc("delete_own_account" as any);
    if (error) {
      setLoading(false);
      toast.error("Não foi possível excluir sua conta", { description: error.message });
      return;
    }
    toast.success("Conta excluída. Sentiremos sua falta.");
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold">Excluir conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exclui sua conta por completo, incluindo o login. Você perde acesso a todas as suas
            motos, manutenções, documentos, certificados e registros — nada fica guardado.
          </p>
          <p className="mt-2 text-xs font-semibold text-destructive">
            Esta ação não pode ser desfeita. Para voltar a usar o TrailBook depois, será necessário
            se cadastrar novamente do zero.
          </p>
          <Button
            variant="outline"
            className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={blocked}
            onClick={() => setOpen(true)}
          >
            {blocked ? "Em manutenção" : "Excluir conta"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setWord("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Excluir sua conta permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Você vai perder o acesso a tudo: motos, manutenções, documentos, certificados e seu
                login. Não é possível desfazer esta ação.
              </span>
              <span className="block">
                Para confirmar, digite <strong className="text-foreground">EXCLUIR</strong> abaixo.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value.toUpperCase())}
            placeholder="EXCLUIR"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={word !== "EXCLUIR" || loading}
              onClick={confirm}
              className="disabled:opacity-40"
            >
              {loading ? "Excluindo…" : "Excluir conta"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
