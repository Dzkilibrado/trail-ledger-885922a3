---
name: Linguagem oficial da UI TrailBook
description: Toda interface do TrailBook usa português simples, objetivo e amigável, sem termos técnicos quando existir alternativa clara. Nomes técnicos ficam restritos a código, docs, ADR e arquitetura.
type: preference
---

# Linguagem oficial da UI

Aplicar a TODO texto exibido ao usuário: labels, títulos, botões, tooltips,
toasts, mensagens de erro, e-mails transacionais, breadcrumbs e menus.

## Regras
- Português simples, objetivo, amigável.
- Sem termos técnicos quando existir equivalente claro em português.
- Sem palavras em inglês quando houver equivalente em português.
- O usuário nunca precisa perguntar o significado de um botão.
- Frases curtas. Verbo no imperativo positivo em CTAs ("Gerar recibo", não "Emitir recibo agora").

## Onde termos técnicos são permitidos
- Código-fonte (identificadores, nomes de arquivo, tipos, tabelas).
- Documentação técnica interna.
- ADRs.
- Diagramas de arquitetura.

## Glossário oficial
| Nunca (UI)             | Sempre (UI)                     |
| ---------------------- | ------------------------------- |
| Smart Receipt          | Recibo de Compra e Venda        |
| Emit Smart Receipt     | Gerar Recibo                    |
| Smart Receipt History  | Histórico de Recibos            |
| Smart Receipt Status   | Status do Recibo                |
| Dashboard              | Início                          |
| Timeline               | Histórico                       |
| Passport               | Passaporte Digital              |
| Log                    | Registro                        |
| Upload                 | Anexar / Enviar                 |
| Preview                | Visualizar                      |
| Loading                | Carregando                      |

## Como aplicar em code review
- Se aparecer termo técnico em `.tsx` de rota/componente exibido ao usuário → corrigir.
- Se aparecer em `sonner`/`toast` → corrigir.
- Se aparecer em `head().meta` (title, description) → corrigir.
- Nomes de rota podem manter forma técnica (`/dashboard`) — o label visível é que precisa ser em português.