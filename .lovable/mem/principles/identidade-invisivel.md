---
name: Identidade Invisível do TrailBook
description: Diretriz permanente — o usuário nunca percebe a tecnologia; toda URL pública usa o domínio oficial trailbook.com.br
type: preference
---
O usuário nunca deve perceber **como** o TrailBook foi desenvolvido. Ele percebe apenas a experiência TrailBook.

Nunca expor ao usuário final: frameworks, plataformas de desenvolvimento, provedores de hospedagem, ambientes de homologação, domínios temporários, URLs técnicas, identificadores internos, mensagens técnicas, erros não tratados ou referências a ferramentas de terceiros.

**Como aplicar (ADR 0018):**
- Toda URL pública/compartilhável (Certificado `/c/:token`, Laudo `/l/:token`, Recibo `/r/:code`, QR Codes, PDFs, e-mails, notificações, futuras APIs) usa `shareUrl(path)` de `src/lib/external-links.ts` → sempre `https://trailbook.com.br`.
- Navegação pública App ↔ Site (`siteUrl()`, `appUrl()`, `appSignUpUrl()`) também usa o domínio oficial — nunca a origem do ambiente.
- Nunca usar `window.location.origin` nem `publicUrl()` para links que o usuário vê, copia, imprime ou vira QR Code. `publicOrigin()` é só para fluxos técnicos de mesma origem (ex.: redirect de autenticação).
- O selo da ferramenta de desenvolvimento fica oculto no site publicado.
- Exibição curta do domínio: `TRAILBOOK_DISPLAY_DOMAIN`.
- Metadados sociais (`og:image`, `twitter:image`) sempre no domínio oficial.
- Arquitetura preparada para Android App Links / Apple Universal Links: app instalado abre o TrailBook; senão, abre o Site Institucional.

**Why:** entre expor detalhe técnico e preservar a experiência, prevalece sempre a experiência. A arquitetura existe para suportar o produto, nunca para competir com a marca.
