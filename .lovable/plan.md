# TrailBook UX 2.0 — Tela de Boas-vindas do aplicativo

Proposta visual. Nada será implementado antes da sua aprovação.

## 1. Wireframe (mobile, 390px, sem rolagem)

```text
┌───────────────────────────────┐
│  [imagem premium em tela      │
│   cheia, escurecida por       │
│   gradiente grafite]          │
│                               │
│                               │
│         ◆  (logo TrailBook)   │
│         TrailBook             │
│  O Especialista Digital em    │
│   Saúde da Motocicleta        │
│                               │
│  Bom dia.                     │
│  Vamos conferir como está a   │
│  saúde da sua motocicleta?    │
│                               │
│  ┌─────────────────────────┐  │
│  │        Entrar           │  │  <- botão primário laranja
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │      Criar conta        │  │  <- contorno claro
│  └─────────────────────────┘  │
│      Esqueci minha senha      │  <- texto discreto
│                               │
│      Conheça o TrailBook  →   │  <- rodapé, link discreto
└───────────────────────────────┘
```

Desktop: mesma composição centralizada numa coluna de ~420px sobre a imagem em tela cheia. Nenhum card, nenhuma seção extra.

## 2. Organização dos elementos

- Bloco superior: espaço respiratório (a imagem "fala").
- Bloco central-baixo: logo, nome, assinatura da missão, saudação contextual.
- Bloco de ação: Entrar (primário), Criar conta (secundário), Esqueci minha senha (texto).
- Rodapé: "Conheça o TrailBook".
- Altura travada em `100dvh` com `safe-area-inset` para iPhone; sem scroll em nenhum tamanho.

## 3. Comportamento do background

- Imagem em `object-cover`, cobrindo 100% da tela.
- Sobreposição em duas camadas: gradiente vertical grafite (transparente no topo → escuro embaixo) + leve véu para garantir contraste AA do texto.
- Uma imagem é sorteada na abertura e **fixada durante toda a sessão** (`sessionStorage`), então navegar e voltar não troca a foto.
- Fallback: cor de fundo grafite enquanto a imagem carrega (nunca tela branca).

## 4. Estratégia das imagens

- Biblioteca oficial com 8 imagens, organizadas em coleções: Trilhas, Motocicletas, Paisagens, Oficina, Competições, Detalhes mecânicos.
- Manifesto declarativo (`welcome-gallery.ts`) com id, coleção, arquivo, texto alternativo e crédito — adicionar imagem futura = adicionar um item na lista.
- Formato WebP/AVIF, ~1200×1800, comprimidas para ≤180 KB cada; apenas a imagem sorteada é baixada.
- Hospedagem via CDN de assets do projeto, com cache agressivo do navegador.

## 5. Efeito cinematográfico

- Ken Burns em CSS puro: `transform: scale(1 → 1.06)` em 28s, `ease-in-out`, alternando direção.
- Sem JavaScript por frame, sem canvas — custo de bateria desprezível (composto na GPU).
- Desativa automaticamente com `prefers-reduced-motion`, em `deviceMemory ≤ 2`, `hardwareConcurrency ≤ 4` ou economia de dados.

## 6. Saudação contextual

- Baseada apenas no relógio do aparelho: 05–11 Bom dia · 12–17 Boa tarde · 18–04 Boa noite.
- Duas linhas: saudação + frase curta rotativa dentro da faixa horária, sempre no tom da Constituição (prevenção, saúde, histórico).
- Sem configuração, sem chamada de rede.

## 7. Navegação

- Entrar → tela de acesso (formulário atual, agora sem a Landing antes).
- Criar conta → cadastro; oculto automaticamente se o cadastro estiver fechado.
- Esqueci minha senha → fluxo de recuperação existente.
- Conheça o TrailBook → Site Institucional (a Landing atual, movida para `/site`).
- Sessão ativa → o app pula a boas-vindas e vai direto ao painel.

## 8. O que deixa de existir na entrada do app

- Landing Page como primeira tela.
- Cabeçalho institucional, benefícios, "Como funciona", carrossel, FAQ e rodapé antes do login.
- Rolagem e estética de website na abertura.
- A tela deixa de se chamar "Tela de Login": passa a ser **Tela de Boas-vindas do TrailBook**.

## 9. O que permanece só no Site Institucional

Hero institucional, benefícios, como funciona, carrossel de telas, FAQ resumida, CTA final, rodapé — tudo preservado, sem alteração de conteúdo, apenas acessível pelo link "Conheça o TrailBook" e por busca/compartilhamento.

## 10. Compatibilidade Android e iPhone

- `100dvh` + `env(safe-area-inset-*)` para notch e barra inferior.
- Áreas de toque mínimas de 44px, tipografia legível sem zoom.
- Sem vídeo, sem autoplay de áudio, sem APIs restritas — nada que atrapalhe empacotamento futuro em Google Play / App Store.
- Modo standalone (app instalado) já suportado pelo manifesto existente.

## 11. Impacto na performance

- Uma única imagem carregada com `fetchpriority=high`; as demais nunca são baixadas naquela sessão.
- Peso da tela estimado em ~200 KB, contra o pacote atual da Landing (3 imagens + acordeão + carrossel).
- Animação 100% GPU; sem timers, sem bibliotecas novas.
- Primeira pintura mais rápida do que a experiência atual.

## 12. Arquivos que serão alterados

| Arquivo | Ação |
| --- | --- |
| `src/components/welcome/AppWelcome.tsx` | novo — toda a experiência concentrada aqui |
| `src/components/welcome/welcome-gallery.ts` | novo — biblioteca oficial de imagens por coleção |
| `src/components/welcome/useWelcomeBackground.ts` | novo — sorteio por sessão + detecção de desempenho |
| `src/components/welcome/greeting.ts` | novo — saudação contextual |
| `src/routes/index.tsx` | passa a renderizar a Tela de Boas-vindas |
| `src/routes/site.tsx` | novo — recebe integralmente a Landing institucional atual |
| `src/routes/auth.tsx` | ajustes de retorno/entrada vindos da nova tela |
| `src/styles.css` | keyframes do Ken Burns e tokens de sobreposição |
| `src/assets/welcome/*` | novas imagens otimizadas |
| `docs/adr/0017-tela-de-boas-vindas.md` + memória | registro da diretriz oficial |

### Detalhes técnicos

Componente isolado, sem dependência da Landing: o site institucional poderá evoluir sozinho. O sorteio usa `sessionStorage` (chave `tb.welcome.bg`) e cai para memória quando indisponível. Redirecionamentos de SEO da Landing (`/` → `/site`) mantêm as URLs públicas funcionando com `head()` próprio em cada rota.
