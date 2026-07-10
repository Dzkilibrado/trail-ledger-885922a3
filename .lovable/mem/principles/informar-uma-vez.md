---
name: Informar uma vez. Reutilizar sempre.
description: Módulos operacionais consomem dados do perfil via useProfileSnapshot; nunca pedem de novo nem escrevem de volta.
type: preference
---

Regra oficial do TrailBook. Uma vez que o usuário preenche o wizard de cadastro (nome, CPF, contato, UF/Cidade, endereço), TODOS os módulos operacionais devem consumir esses valores via `useProfileSnapshot()` — nunca pedir de novo.

**Como aplicar:**
- Formulários que pedem dados do próprio usuário: importar `useProfileSnapshot`, pré-preencher campos vazios com o snapshot, exibir `<ProfileDataChip />` acima do campo pré-preenchido.
- Nunca sobrescrever valor persistido (rascunho, edição): checar `!currentReceiptId && !valorAtual` antes de aplicar.
- Edição local vale só para a operação; nenhum módulo pode escrever de volta em `profiles`.
- Para invalidar o cache após mudança no perfil: `useInvalidateProfileSnapshot()`.

**Por quê:** filosofia oficial (mais funcionalidades = experiência MAIS simples). Reduz atrito, evita inconsistência entre módulos, mantém uma única fonte da verdade para dados pessoais.