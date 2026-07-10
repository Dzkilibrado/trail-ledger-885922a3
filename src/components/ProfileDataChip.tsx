import { Link } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";

/**
 * Indicador visual de que um campo foi pré-preenchido com dados do perfil
 * do usuário. Editar o valor aqui NÃO altera o perfil global — vale apenas
 * para a operação corrente. Para mudar em definitivo, o usuário vai em /perfil.
 *
 * Princípio: "Informar uma vez. Reutilizar sempre."
 */
export function ProfileDataChip({ label = "Dados do seu perfil" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
      <UserCheck className="h-3 w-3" />
      <span>{label}</span>
      <span className="text-primary/60">·</span>
      <Link to="/perfil" className="underline underline-offset-2 hover:no-underline">
        alterar
      </Link>
    </div>
  );
}