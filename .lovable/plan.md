# Fase 1 — Catálogo Mestre + Cadastro Inteligente da Moto

Escopo restrito e seguro. Não altera lógica de manutenção existente (isso vem em fases seguintes). Foco em: base de dados de modelos, novo fluxo guiado de cadastro, estado (nova/usada), revisão obrigatória antes de salvar, e preparação da base para o Plano por modelo.

## 1. Migração de banco (uma migração)

Criar tabelas do catálogo mestre em `public`, todas com RLS + GRANTs.

```
motorcycle_brands(id, name UNIQUE, slug, active, sort_order)
motorcycle_types_ref(code PK, label, sort_order)   -- trail, enduro, motocross, rally, adventure, big_trail, other
motorcycle_models(id, brand_id FK, type_code FK, name, active, sort_order, UNIQUE(brand_id,type_code,name))
motorcycle_model_engines(id, model_id FK, displacement INT, active, UNIQUE(model_id,displacement))
motorcycle_model_years(id, model_id FK, year_make INT, year_model INT, UNIQUE(model_id,year_make,year_model))
motorcycle_usage_types(code PK, label, multiplier NUMERIC)  -- light, normal, severe, competition, sand_mud, other (mapeia ao use_profile atual)
motorcycle_model_defaults(model_id PK FK, control_type control_type_enum, notes)  -- horímetro/hodômetro/ambos/não_informado
```

Manutenção: reusar `maintenance_plan_templates` e `maintenance_plan_items` já existentes; apenas garantir que `template` pode referenciar `model_id` opcionalmente (adicionar coluna nullable `model_id`).

Extensões em `motorcycles`:
- `condition` ENUM (`new`,`used`) NOT NULL DEFAULT `used`
- `catalog_model_id` UUID NULL (link para o catálogo quando escolhido; NULL quando "Outro")
- `plan_review_status` ENUM (`pending`,`reviewed`,`skipped`) DEFAULT `pending` — usado só quando `condition='used'`

Todas RLS: leitura pública anon nos catálogos (`motorcycle_brands`, `_types_ref`, `_models`, `_engines`, `_years`, `_usage_types`, `_defaults`), escrita apenas admin. GRANTs corretos.

Seed enxuto e conservador:
- Marcas: Honda, Yamaha, KTM, Kawasaki, Suzuki, Husqvarna, Sherco, GasGas
- Modelos representativos por tipo (ex.: CRF 250F/230F/450X trilha/enduro; YZ 250F/450F motocross; KTM 300 XC-W enduro; Ténéré 700 adventure; XRE 300 big trail; etc.) — sem inventar cilindradas incertas
- Cilindradas apenas quando conhecidas
- Sem plano de manutenção específico por modelo agora (deixa em branco — usa o template default existente)

## 2. Camada de dados (frontend)

`src/lib/motorcycle-catalog.ts` já existe — estender/refatorar para expor:
- `useBrands()`, `useTypes()`, `useModels({brand,type})`, `useEngines({model})`, `useYears({model})`
- `useModelDefaults(modelId)` — retorna control_type sugerido
- Cada consulta com fallback à opção "Outro" quando resultado vazio

## 3. Novo fluxo de cadastro (`/motorcycles/new`)

Wizard em 4 passos com barra de progresso, mobile-first:

**Passo 1 — Identificação**
1. Tipo da moto (Select)
2. Marca (Select filtrado)
3. Modelo (Select filtrado por marca+tipo)
4. Cilindrada (Select filtrado por modelo)
5. Ano fabricação / Ano modelo (Selects filtrados)
6. Apelido (input opcional)

Cada Select mostra "Outro" ao final. "Outro" abre input de texto obrigatório e desativa filtros dependentes (usuário completa manual).

**Passo 2 — Estado da moto**
- Radio: Nova / Usada-Seminova
- Se Nova: horímetro=0 e KM=0 são fixados e ocultos
- Se Usada: campos obrigatórios conforme `control_type` sugerido; mostra aviso amarelo:  
  "Como esta moto já possui uso anterior, revise o estado atual dos itens de manutenção antes de ativar os alertas."

**Passo 3 — Tipo de controle**
- Sugestão do catálogo pré-selecionada; usuário pode alterar
- Opções: Horímetro / Hodômetro / Ambos / Não informado

**Passo 4 — Revisão**
- Card de resumo com todos os dados
- Botões: "Editar" (volta ao passo), "Confirmar cadastro"
- Só ao confirmar o `INSERT` acontece

## 4. Pós-cadastro (moto usada)

Se `condition='used'` e `plan_review_status='pending'`:
- No dashboard da moto (`/motorcycles/$id`): banner amarelo persistente:
  > "Ajuste o plano de manutenção desta moto para refletir o estado atual."
  > Botão: **Ajustar plano de manutenção**
- Botão leva a `/motorcycles/$id/plan` (já existe) com callout no topo. Após revisão o usuário marca "Concluir revisão" → status vira `reviewed` e banner some.
- (Fase 2 detalhará o wizard de revisão item-a-item; por ora, ao entrar na página já existente, aparece o callout com botão "Marcar revisão concluída".)

## 5. UX e componentes

- Reusar `Select`, `RadioGroup`, `Input` do shadcn
- Wizard: componente simples com passos + validação zod por passo
- Nenhuma cor hardcoded — usar tokens semânticos
- Textos de apoio conforme diretrizes (Português, tom TrailBook)
- Mobile-first: Selects grandes, botões largos, sem rolagem excessiva

## 6. Auditoria

Cadastro já é auditado via `write_audit()` na tabela `motorcycles`. Sem alteração.

Adicionar log de "plan_review_completed" via `admin_log_event`-equivalente para o próprio usuário — ou registrar direto em `audit_log` (mais simples).

## 7. Fora do escopo desta fase (documentar para próximas)

- Fase 2: Registro de atividade (horas+minutos, leitura atual, editar/excluir com recálculo, integridade por item)
- Fase 3: Saúde da Moto gerenciável (cards fixar/ocultar/reordenar) + Dashboard da moto reformulado
- Fase 4: Wizard detalhado de revisão do plano item-a-item para moto usada
- Fase 5: Admin CRUD do catálogo mestre (adicionar marcas/modelos via UI)

## 8. Homologação da Fase 1

1. Cadastro nova moto — horímetro/KM fixados em 0
2. Cadastro moto usada — exige leituras atuais
3. Selects encadeados filtram corretamente
4. Opção "Outro" libera texto livre em cada nível
5. Tipo de controle sugerido automaticamente
6. Passo Revisão só grava ao confirmar
7. Banner de revisão aparece em moto usada
8. Banner some após "revisão concluída"
9. Console limpo, typecheck limpo, mobile ok
10. Auditoria registra criação e conclusão de revisão

## Arquivos previstos

- `supabase/migrations/<timestamp>_catalog_mestre.sql` (nova)
- `src/lib/motorcycle-catalog.ts` (estender)
- `src/lib/motorcycle-catalog.functions.ts` (nova — server fns se necessário; provavelmente reads client-side com policies anon)
- `src/routes/_authenticated/motorcycles.new.tsx` (refatorar para wizard)
- `src/components/motorcycle-wizard/*` (novos: StepIdentification, StepCondition, StepControl, StepReview, WizardShell)
- `src/routes/_authenticated/motorcycles.$id.tsx` (adicionar banner de revisão)
- `src/routes/_authenticated/motorcycles.$id.plan.tsx` (adicionar callout + botão "Concluir revisão")
- `src/integrations/supabase/types.ts` (regenerado após migração)
