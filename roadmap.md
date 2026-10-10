# Correção 01 — Fase A

## Ajuste 01 — Registrar Uso
- [x] Correção do atalho: quantidade adicional, resumo TIL, RPC independente da leitura acumulada, 267 testes e build OK; evidências em docs/homologacao/registrar-uso-adicional.md; sem publicação.
- [ ] Aplicar nova função ao banco compartilhado — depende de aprovação específica; não aplicar durante implementação.
- [x] Incluir atalho inicialmente uma única vez, preservando personalização e todos os itens.
- [x] Reutilizar registro oficial com formulário de data, leitura acumulada e local.
- [x] Validar sincronia, regras, interface e documentação sem publicação: 237 testes, build OK, interface desktop/mobile; limitações em docs/homologacao/ajuste-01-registrar-uso.md.

- [x] Incorporar esclarecimento: acesso público sem login, modalidades, identificação necessária, prazos existentes e testes positivos de funcionamento.

- [x] Implementar contratos públicos por lista de campos e defesa adicional da aplicação.
- [x] Criar proposta SQL específica fora das migrations aplicáveis, sem aplicação no banco compartilhado.
- [x] Validar RPCs, permissões, PDFs e consumidores com dados sintéticos em PostgreSQL isolado.
- [x] Revisar documentação, FAQ e orientações do Assistente afetadas.
- [x] Conferir integridade por leitura e entregar evidências e GO/NO-GO.
- [x] Finalização prioritária: contrato exists comprovado, documento fiscal restrito, textos protegidos para identidades conhecidas e identificadores estruturados; 190 testes aprovados.
- [x] Inspeção visual das páginas reais com respostas sintéticas, QR decodificado e PDF fiscal com imagem sintética; nenhuma escrita no banco compartilhado.
- [ ] Assinatura/download/expiração reais de armazenamento — bloqueados por ausência de backend isolado com armazenamento privado; mocks não substituem essa comprovação.
- [x] Fase B autorizada em 10/10/2026: correção aplicada; incompatibilidade JSONB corrigida para frente; quatro conjuntos históricos preservados e link comprador ativo funcionando sem login.
- [x] Publicação solicitada e conferida no domínio oficial: versão 1.6.11, build 20261010-032827-89lbomr; início, tela de login, sessão autenticada, Central e laudo comprador ativo sem erros de página. Senha/Google e fluxo fiscal válido permanecem em homologação.
- [ ] Confirmar sincronização GitHub — depende de acesso ao repositório principal, indisponível nesta sessão.