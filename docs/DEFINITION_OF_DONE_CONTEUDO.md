# Definition of Done — Conteudo e Descoberta

**Valido a partir de:** setembro 2026
**Mantido por:** equipe de produto TrailBook

---

## Regra

Toda funcionalidade nova, alterada, renomeada, lancada em Beta, colocada em manutencao
ou desabilitada **deve obrigatoriamente** passar pela checklist abaixo antes de ser
considerada entregue.

Nenhuma nova funcionalidade e considerada completamente entregue se a camada de
descoberta e ajuda continuar desatualizada.

---

## Checklist

### Assistente TrailBook

- [ ] Existe artigo publicado na Knowledge Base descrevendo a funcionalidade?
- [ ] O artigo usa linguagem simples, sem termos tecnicos internos?
- [ ] O `module_key` do artigo esta mapeado corretamente em `ARTICLE_MODULE_MAP`?
- [ ] O intent correspondente existe em `help_intents`?
- [ ] Existem frases naturais em `help_intent_phrases` cobrindo as formas como o usuario perguntaria?
- [ ] O slug do artigo aparece em `HOME_SLUG_CANDIDATES` se for funcionalidade frequente?
- [ ] O label no `HOME_LABELS` usa linguagem orientada a intencao do usuario?
- [ ] Perguntas relacionadas (related) apontam para artigos corretos pelo `module_key`?

### Module-Aware

- [ ] O `platform_module` correspondente esta criado com o status correto?
- [ ] O Assistente NAO promove a funcionalidade quando o modulo esta `disabled` ou `maintenance`?
- [ ] O Assistente promove a funcionalidade quando o modulo esta `active` ou `beta`?
- [ ] O CTA do artigo aponta para rota real e existente?
- [ ] O CTA e bloqueado quando o modulo nao esta disponivel?

### Knowledge Base

- [ ] Artigos desatualizados foram arquivados (status = archived) em vez de deletados?
- [ ] Nenhum artigo publicado descreve funcionalidade inexistente ou indisponivel?
- [ ] A migration de conteudo e idempotente (ON CONFLICT, IF NOT EXISTS)?
- [ ] Os context_tags do artigo cobrem os termos naturais que o usuario usaria na busca?

### Site Institucional (/site)

- [ ] A funcionalidade esta refletida nos BENEFITS?
- [ ] O FAQ foi atualizado se a funcionalidade gera duvida comum?
- [ ] Funcionalidades Beta sao marcadas com badge "Beta" ou equivalente?
- [ ] Nenhuma afirmacao juridica, tecnica ou comercial incorreta foi incluida?
- [ ] Termos internos (Health 4.0, TIL, Conservation Index, Lovable, Supabase) NAO aparecem para o usuario?

---

## Estados de modulo e impacto no conteudo

| Status | Home Assistente | Topicos | Busca | CTA | Site |
|--------|----------------|---------|-------|-----|------|
| active | aparece | aparece | responde | funciona | apresentar |
| beta | aparece | aparece | responde | funciona | apresentar com badge Beta |
| maintenance | nao aparece | nao aparece | aviso | bloqueado | mencionar brevemente |
| disabled | nao aparece | nao aparece | aviso | bloqueado | nao apresentar |

---

## Nomenclatura proibida em interfaces de usuario

Nunca usar para o usuario:

- Health 4.0 — usar: Saude da Moto
- TIL — usar descricao funcional
- Conservation Index — nao expor
- Confidence Index — nao expor
- Lovable, Supabase, React, URLs tecnicas
- IDs internos, slugs de modulo, chaves de banco

---

## Fluxo de entrega de nova funcionalidade

1. Funcionalidade implementada e testada
2. platform_module criado/atualizado com status correto
3. Artigo KB criado/atualizado (linguagem simples, sem termos internos)
4. Intent + phrases adicionadas
5. HOME_SLUG_CANDIDATES + HOME_LABELS atualizados se necessario
6. ARTICLE_MODULE_MAP atualizado se novo module_key
7. Site /site atualizado (BENEFITS, FAQS, SLIDES se relevante)
8. Migration de conteudo criada e entregue para execucao
9. Testes do Assistente passando (TypeScript zero erros, build limpo)
10. ENTREGUE

---

## Lacunas documentadas

| Funcionalidade | Status | Artigo KB | Prioridade |
|---|---|---|---|
| Mapa da moto | A verificar | Nao existe | Baixa |
| Manutencao Geral | Dentro do cockpit | Nao existe | Baixa |
| Agenda | Implementado | agenda-manutencao criado Etapa 2 | Resolvida |
| Historico | Implementado | historico-manutencao criado Etapa 2 | Resolvida |
| Oficinas | Implementado | oficinas criado Etapa 2 | Resolvida |
| Fiscalizacao | Implementado como preset do Laudo | fiscalizacao-laudo criado Etapa 2 | Resolvida |
