import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecover: () => void;
  onOpenHelp: () => void;
  onBackToLogin: () => void;
  title?: string;
  description?: string;
}

export function CpfConflictDialog({ open, onOpenChange, onRecover, onOpenHelp, onBackToLogin, title, description }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? "Este CPF já possui uma conta cadastrada no TrailBook"}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? "Por segurança, cada CPF só pode estar vinculado a uma única conta. Escolha como deseja prosseguir:"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 sm:grid-cols-3 pt-2">
          <Button variant="outline" onClick={onBackToLogin}>Voltar ao login</Button>
          <Button variant="outline" onClick={onOpenHelp}>Abrir chamado</Button>
          <Button onClick={onRecover} className="btn-glow">Recuperar acesso</Button>
        </div>
        <AlertDialogFooter />
      </AlertDialogContent>
    </AlertDialog>
  );
}