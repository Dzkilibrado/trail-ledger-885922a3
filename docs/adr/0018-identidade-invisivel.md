# ADR 0018 — Identidade Invisível: o usuário vê apenas TrailBook

- Status: Aceita
- Versão: permanente (a partir da v1.9.3)

## 1. Objetivo

Oficializar como diretriz permanente: **o usuário nunca deve perceber como o
TrailBook foi desenvolvido — apenas a experiência TrailBook.**

## 2. Problema anterior

Links públicos, QR Codes e metadados sociais herdavam a origem técnica do
ambiente (domínios de preview/hospedagem), expondo infraestrutura ao usuário
final e enfraquecendo a marca em documentos compartilhados.

## 3. Solução adotada

1. `shareUrl(path)` em `src/lib/external-links.ts` monta **toda** URL pública
   sempre no domínio oficial (`https://trailbook.com.br`), independente do
   ambiente em execução.
2. Aplicado em: Certificado Digital (`/c/:token`), Laudo compartilhado
   (`/l/:token`), Recibo Inteligente (`/r/:code`), QR Codes, PDFs e telas de
   compartilhamento.
3. `TRAILBOOK_DISPLAY_DOMAIN` padroniza a exibição curta do domínio.
4. `og:image` / `twitter:image` passam a apontar para o domínio oficial.
5. `publicOrigin()` permanece de uso interno/técnico (fluxos que exigem mesma
   origem, como redirecionamentos de autenticação) e nunca é exibido.

## 4. Alternativas avaliadas

- Manter `window.location.origin`: simples, mas vaza domínio técnico em QR
  Codes e documentos impressos — reprovado.
- Variável de ambiente por ambiente: adiciona configuração sem ganho, já que o
  link público deve ser sempre o oficial.

## 5. Motivo da decisão

Entre expor detalhe técnico e preservar a experiência, prevalece a experiência.
A arquitetura suporta o produto; nunca compete com a marca.

## 6. Impactos positivos

- Links, QR Codes e documentos sempre com identidade TrailBook.
- Compartilhamentos gerados em homologação continuam válidos em produção.
- Base pronta para Android App Links / Apple Universal Links: URL oficial
  absoluta abre o app quando instalado e o Site Institucional quando não.

## 7. Compatibilidade

Sem mudança de schema, rotas ou regras da TIL. Tokens e códigos existentes
seguem válidos.

## 8. Riscos conhecidos

Links gerados em ambiente de desenvolvimento apontam para produção — esperado
e desejado; testes técnicos devem usar a rota diretamente.

## 9. Próximas evoluções

- `app.trailbook.com.br` (se adotado) como origem do aplicativo.
- Arquivos de associação em `/.well-known/` para as lojas.
- Revisão de e-mails e futuras APIs públicas sob a mesma regra.

## 10. Regras permanentes

Nunca expor ao usuário: nomes de frameworks, plataformas de desenvolvimento,
provedores de hospedagem, ambientes de homologação, domínios temporários, URLs
técnicas, identificadores internos, mensagens de erro não tratadas ou
referências a ferramentas de terceiros.
