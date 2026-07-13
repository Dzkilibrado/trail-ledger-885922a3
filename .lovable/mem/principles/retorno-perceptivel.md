---
name: Retorno perceptível a toda ação
description: Toda interação do usuário deve produzir navegação, carregamento, confirmação, sucesso, erro ou feedback visual — nunca silêncio.
type: principle
---
Nenhuma ação do usuário pode terminar sem um retorno perceptível.

Toda interação (clique, submit, toque) deve resultar em pelo menos um dos comportamentos abaixo:

- navegação para a próxima tela;
- carregamento (skeleton, spinner ou botão desabilitado);
- confirmação visível de sucesso (estado da UI atualizado);
- toast de sucesso após sincronia (par com ADR 0011);
- mensagem de erro amigável (par com ADR 0012);
- feedback visual imediato (mudança de estado do controle).

Aplicável a: botões, links, submits, gestos, atalhos e ações de menu. Vale para telas autenticadas e públicas, desktop e mobile.

**Como aplicar:**
- Botões que navegam usam `<Button asChild><Link/></Button>` para preservar semântica e acessibilidade — nunca `<Link><Button/></Link>` (aninhamento inválido, pode falhar em navegadores/tecnologias assistivas).
- Rotas de destino declaradas em `<Link to>` devem existir no `routeTree.gen.ts`; nunca apontar botão de "Notificações" para `/tickets` etc.
- Ações assíncronas exibem loading e desabilitam o gatilho enquanto executam.
- Falhas sempre viram mensagem amigável (ADR 0012), nunca silêncio.

ADR relacionada: 0014.