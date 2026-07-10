---
name: Padrão oficial de preenchimento — Seleção > Autocomplete > Texto livre
description: Regra oficial do TrailBook para campos com lista conhecida (UF, cidade, marca, modelo, etc.) — sempre priorizar seleção, evitar texto livre.
type: preference
---
Sempre que existir uma lista oficial e conhecida (UFs, municípios, marcas, modelos, formas de pagamento, tipos de documento, etc.):

1. **Campo de seleção** (Select/Sheet mobile) — padrão.
2. **Autocomplete/busca** — quando a lista é grande (>50 itens). Preferencialmente Bottom Sheet pesquisável em mobile.
3. **Texto livre** — apenas quando o usuário escolhe explicitamente "Outros" (exceção, nunca padrão).

**Onde aplicar (rolling):**
- Local da negociação no Smart Receipt (UF → Cidade via IBGE) — implementado.
- Local de eventos, oficinas, endereços de perfil, dados do Passaporte e Certificados — a aplicar gradualmente.
- Base oficial de UFs/municípios em `src/lib/br-locations.ts` (IBGE Localidades).
- Componente reutilizável: `src/components/LocationPicker.tsx`.

**Por quê:** padroniza dados, elimina erros de digitação, viabiliza filtros e estatísticas por UF/Cidade, melhora qualidade do Passaporte e Recibos.

**Como aplicar:** ao criar/editar qualquer formulário com um campo que aceita valores de um domínio conhecido, substituir `<Input placeholder="…">` por um seletor (Select curto ou Sheet pesquisável em mobile). Fallback "Outros" só quando faz sentido de negócio.
