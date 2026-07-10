# Fase D — Reutilização automática dos dados do perfil

Princípio oficial: **"Informar uma vez. Reutilizar sempre."**

O usuário já preencheu o cadastro completo no wizard (Fase B). A partir daqui, todo módulo que precise de nome, CPF, contato, localização ou endereço do usuário deve consumir esses valores do perfil — sem digitar de novo.

## O que será entregue

### 1. Hook central `useProfileSnapshot`

Local: `src/hooks/useProfileSnapshot.ts`

- Uma única fonte de leitura do perfil do usuário logado, cacheada via TanStack Query (`staleTime: 5 min`).
- Retorna objeto tipado: `full_name, display_name, cpf, birth_date, email, phone, whatsapp, uf, city, cep, bairro, logradouro, numero, complemento`.
- Helpers derivados: `location` (`"Cidade / UF"`), `whatsappResolved` (respeita `whatsapp_same_as_phone`), `isComplete` (todos essenciais presentes).
- Invalidado automaticamente no `onAuthStateChange` (já existe no `__root.tsx`).

### 2. Componente visual `ProfileDataChip`

Local: `src/components/ProfileDataChip.tsx`

Chip pequeno, discreto, exibido acima de campos pré-preenchidos:
`"Dados do seu perfil · editar apenas para esta operação"` com link para `/perfil` (alterar definitivamente).

Deixa claro que o valor **veio do perfil** e que edições locais não sobrescrevem o cadastro global.

### 3. Integrações por módulo

| Módulo | Campos pré-preenchidos | Onde |
|---|---|---|
| **Smart Receipt** | `location` (Cidade / UF do vendedor) | `EmitReceiptDialog` — campo "Local da negociação" já existente, agora inicia com `snapshot.location` |
| **Certificados** | Nome do titular, CPF, e-mail, telefone | `certificates.tsx` — bloco do emitente |
| **Transferências** | Nome, CPF, WhatsApp do transferidor | `transfers.tsx` — bloco "seus dados" |
| **Documentos** | Nome do proprietário no upload de docs pessoais | `documents.index.tsx` — quando aplicável |

Regras comuns a todos:
- Se o campo já tem valor persistido (rascunho, edição), NÃO sobrescreve — respeita o existente.
- Campo vazio + snapshot disponível → pré-preenche + mostra `ProfileDataChip`.
- Edição local é permitida e válida apenas para aquela operação.
- Nenhuma mutação escreve de volta no `profiles` a partir destes módulos.

### 4. Documentação

- ADR `docs/adr/0006-reutilizacao-automatica-perfil.md`.
- Memória: `mem://principles/informar-uma-vez` (regra core).
- Atualizar `.lovable/plan.md` marcando Fase D concluída.

## Fora de escopo

- Alteração de esquema do banco (Fase A já cobriu).
- Novos campos no perfil.
- Módulos operacionais que não consomem dados pessoais (Cockpit, TIL, plano de manutenção).

## Detalhes técnicos

- `useProfileSnapshot` fica em `src/hooks/`, importa `supabase` do client browser, usa `useAuth`/`supabase.auth.getUser` para o `uid` e faz um único `select` das colunas necessárias.
- `queryKey: ["profile-snapshot", uid]` — reaproveitado por todos os módulos, sem duplicar fetches.
- Efeito de pré-preenchimento em cada módulo: `useEffect` que dispara **uma vez** quando `snapshot` chega E o estado local está vazio.
- Após a Fase D, o wizard passa a ser o único ponto de entrada de dados do perfil; módulos operacionais só consomem.

## Homologação prevista

Cenários a validar após implementação:
1. Novo Smart Receipt → "Local da negociação" já vem com Cidade/UF do perfil.
2. Editar rascunho antigo → mantém o local salvo, não sobrescreve.
3. Novo certificado → titular pré-preenchido.
4. Nova transferência → dados do transferidor prontos.
5. Alterar perfil → próximo módulo aberto reflete o novo valor (invalidação de cache).
6. Console sem erros; typecheck limpo.
