# ADR 0017 — Tela de Boas-vindas do TrailBook (UX 2.0)

**Status:** Aceito · v1.9.1 · 2026-08-03

## Contexto

A Landing Page institucional era a primeira tela do aplicativo. Quem abria o
TrailBook queria acessar a própria motocicleta, não ler um site.

## Decisão

**Aplicativo = utilizar. Site = conhecer.** São experiências distintas.

- A rota `/` passa a ser a **Tela de Boas-vindas do TrailBook** — nome oficial;
  "Tela de Login" deixa de existir na documentação e na arquitetura.
- A Landing Page institucional é preservada integralmente e passa a viver em
  `/site`, acessível pelo link discreto "Conheça o TrailBook".
- Toda a experiência inicial fica concentrada em `src/components/welcome/`,
  independente do site institucional.

### Composição (mobile-first, sem rolagem)

Imagem premium → logo → TrailBook → "O Especialista Digital em Saúde da
Motocicleta" → texto curto → saudação contextual → Entrar → Criar conta →
Esqueci minha senha → Conheça o TrailBook.

### Background dinâmico

Biblioteca oficial declarativa (`welcome-gallery.ts`) com coleções (Trilhas,
Paisagens, Oficina, Competições, Detalhes mecânicos). Uma imagem é sorteada na
abertura e **fixada por sessão** (`sessionStorage: tb.welcome.bg`), com fallback
em memória. Apenas a imagem sorteada é baixada.

### Efeito cinematográfico

Ken Burns em CSS puro (`scale 1 → 1.06`, 28s, alternate), composto na GPU.
Desativado automaticamente com `prefers-reduced-motion`, `deviceMemory ≤ 2`,
`hardwareConcurrency ≤ 4` ou economia de dados.

### Saudação contextual

Apenas o relógio do aparelho: 05–11 Bom dia · 12–17 Boa tarde · 18–04 Boa noite,
com frase curta no tom da Constituição (ADR 0016). Sem rede, sem configuração.

### Navegação

`Entrar` → `/auth?tab=signin` · `Criar conta` → `/auth?tab=signup` ·
`Esqueci minha senha` → `/auth?recuperar=1` · `Conheça o TrailBook` → `/site`.
Sessão ativa pula a tela e vai para o painel.

## Consequências

- Abertura mais leve: uma imagem otimizada, sem carrossel/acordeão antes do login.
- `100dvh` + `safe-area-inset` e alvos de toque ≥ 44px garantem paridade
  Android/iPhone e compatibilidade com empacotamento futuro nas lojas.
- O site institucional evolui sem impactar o aplicativo, e vice-versa.
- Evoluções futuras (novas imagens, campanhas sazonais, mensagens
  institucionais) entram pela biblioteca declarativa, sem tocar em componentes.
