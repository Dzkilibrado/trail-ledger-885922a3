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

## Complemento — Separação App × Site Institucional (v1.9.2)

**APP = utilizar. SITE = conhecer.** As duas experiências deixam de compartilhar
navegação.

- "Conheça o TrailBook" não navega mais por rota interna: abre o Site
  Institucional no **navegador padrão do aparelho** (Chrome no Android, Safari
  no iPhone) via `<a href target="_blank" rel="noopener noreferrer">`. O
  aplicativo permanece aberto em segundo plano com o estado intacto — sem
  `navigate()`, sem reload, sem limpar `sessionStorage` (a imagem sorteada
  `tb.welcome.bg` continua a mesma no retorno).
- O Site Institucional deixa de ter função de autenticação: sem "Entrar", sem
  recuperação de senha, sem formulário de login. No lugar, CTAs:
  "Ainda não utiliza o TrailBook?" → Criar uma conta ·
  "Já possui uma conta?" → Abrir o aplicativo.
- Todos os links entre site e app usam URLs públicas absolutas resolvidas por
  `src/lib/external-links.ts` — formato exigido por **Android App Links** e
  **Apple Universal Links**. Na publicação nas lojas basta hospedar
  `/.well-known/assetlinks.json` e `/.well-known/apple-app-site-association`
  declarando `/` e `/auth`; nenhum componente precisará mudar. Sem o app
  instalado, a mesma URL abre a versão web (fallback nativo).
- Nenhuma funcionalidade do aplicativo é impactada: Entrar, Criar conta e
  Esqueci minha senha seguem íntegros na Tela de Boas-vindas e em `/auth`.
