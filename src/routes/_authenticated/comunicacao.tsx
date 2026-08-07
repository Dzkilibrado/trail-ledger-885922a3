import { createFileRoute, redirect } from "@tanstack/react-router";

// Comunicação e Central mostravam os mesmos itens (Mensagens, Chamados,
// Notificações) — duas telas quase idênticas confundindo o usuário.
// Central já reúne tudo (inclusive Financeiro, Agenda, Oficinas,
// Certificados), então esta rota agora só redireciona para lá.
// Mantida como redirect (em vez de removida) para não quebrar links
// antigos ou atalhos que o usuário já tenha salvo.
export const Route = createFileRoute("/_authenticated/comunicacao")({
  beforeLoad: () => {
    throw redirect({ to: "/central" });
  },
});
