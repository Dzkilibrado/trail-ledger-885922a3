# Separação App × Site Institucional

App = utilizar. Site = conhecer. Duas experiências independentes, sem navegação compartilhada.

## 1. Nova navegação

- Na Tela de Boas-vindas, "Conheça o TrailBook" deixa de ser rota interna.
  Passa a abrir o Site Institucional no navegador padrão do aparelho
  (Chrome no Android, Safari no iPhone), em nova aba/janela externa.
- O site é aberto pela URL pública absoluta (`https://trailbook.com.br/site`),
  não por rota do roteador interno.
- No Site Institucional, some a área de autenticação. No lugar entram CTAs:
  - "Já possui uma conta?" → Abrir o Aplicativo
  - "Ainda não utiliza o TrailBook?" → Criar uma conta
  Ambos apontam para a URL pública do aplicativo (`/` e `/auth?tab=signup`),
  também como link externo — o site nunca navega para dentro do app pelo roteador.
- Some do site: botões "Entrar", link de recuperação de senha e qualquer
  referência a login no cabeçalho, hero, CTA final e rodapé.

## 2. Preservação do estado do aplicativo

- O link usa `target="_blank"` + `rel="noopener noreferrer"`, então o navegador
  abre uma nova aba/visualização e a aba do aplicativo permanece viva em
  segundo plano — nada é desmontado, recarregado ou reiniciado.
- Em app instalado (modo standalone/PWA), o mesmo link entrega a navegação ao
  navegador do sistema; o app continua na Tela de Boas-vindas e o retorno
  (gesto voltar / troca de app) recoloca o usuário exatamente onde estava.
- Nenhum `navigate()`, nenhum reload, nenhuma limpeza de `sessionStorage` —
  inclusive a imagem sorteada da tela de boas-vindas (`tb.welcome.bg`)
  permanece a mesma no retorno.

## 3. Fluxo futuro com Deep Links

- Estrutura preparada para Android App Links e Apple Universal Links: os CTAs
  do site apontam para URLs `https://` do próprio domínio, que é exatamente o
  formato exigido pelas duas plataformas.
- Quando o app estiver publicado, bastará hospedar os arquivos de associação
  (`/.well-known/assetlinks.json` no Android e
  `/.well-known/apple-app-site-association` no iOS) declarando as rotas `/` e
  `/auth`. Nenhuma alteração de componente será necessária.
- Sem o app instalado, a mesma URL continua abrindo a versão web normalmente —
  comportamento de fallback nativo, sem código extra.
- Nesta entrega os arquivos `.well-known` não são criados (dependem dos
  identificadores das lojas), apenas o formato de URL fica correto.

## 4. Arquivos alterados

| Arquivo | Ação |
| --- | --- |
| `src/lib/external-links.ts` | novo — origem pública canônica e helper de link externo |
| `src/components/welcome/AppWelcome.tsx` | "Conheça o TrailBook" vira link externo |
| `src/routes/site.tsx` | remove login/recuperação; CTAs "Abrir o Aplicativo" e "Criar uma conta" como links externos |
| `docs/adr/0017-tela-de-boas-vindas.md` | complemento sobre a separação App × Site |
| `CHANGELOG.md` | registro da versão |

## 5. Impacto em funcionalidades

Nenhum. As alterações são exclusivamente de navegação e apresentação:

- Entrar, Criar conta e Esqueci minha senha continuam íntegros dentro do app,
  na Tela de Boas-vindas e em `/auth`.
- A rota `/site` continua existindo, indexável e compartilhável — apenas deixa
  de ser alcançada por navegação interna.
- Nenhuma alteração em TIL, Saúde, Passaporte, Recibos, banco de dados,
  autenticação ou permissões.

### Detalhes técnicos

O helper resolve a origem pública em tempo de execução (`window.location.origin`
quando já é o domínio público; caso contrário a constante do domínio oficial),
garantindo que preview, publicado e domínio próprio funcionem sem configuração
extra. Os links externos usam `<a href target="_blank" rel="noopener noreferrer">`
— não `<Link>` — o que impede o roteador de interceptar a navegação.
