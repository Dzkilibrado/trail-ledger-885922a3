# Homologação Final — TrailBook Health · Etapa 3

**Data:** 2026-07-29 · **Versão:** v1.9.0 · **Responsável:** Time TrailBook (execução automatizada + revisão)

## Ambientes utilizados
| Item | Detalhe |
|---|---|
| Dispositivos | Emulação móvel 390×844 (Android/iPhone equivalente) e desktop 1361×813 |
| Navegadores | Chromium (base de Chrome/Edge). Safari iOS: **não executado** — exige aparelho real |
| Dados | Moto real do ambiente, laudo `TB-LAUDO-2026-000001` (10 itens críticos, confiabilidade média, ressalvas) |

## Matriz de homologação
| ID | Funcionalidade | Cenário | Dispositivo | Resultado esperado | Obtido | Situação |
|---|---|---|---|---|---|---|
| H3-01 | Central de Check-ups | Laudo existente | Mobile | Lista responsiva, status e validade | OK, sem rolagem horizontal (scrollWidth = 390) | Aprovado |
| H3-02 | Laudo — página | Abertura por código | Mobile | Snapshot completo, sem erros | OK, console limpo | Aprovado |
| H3-03 | PDF — download | Toque em Salvar em PDF | Mobile | Arquivo baixado | `Laudo-TrailBook-TB-LAUDO-2026-000001-2026-07-29.pdf` (350 KB) | Aprovado |
| H3-04 | PDF — nome | Padrão exigido | — | `Laudo-TrailBook-[codigo]-[data].pdf` | Idêntico | Aprovado |
| H3-05 | PDF — cliques repetidos | 2 toques rápidos | Mobile | 1 arquivo | Antes: 2 arquivos → **corrigido** com trava de 2,5 s | Aprovado após correção |
| H3-06 | PDF — estado | Durante geração | Mobile | "Preparando seu Laudo TrailBook…", botão travado, `aria-busy` | Implementado | Aprovado |
| H3-07 | PDF — falha | Download bloqueado | — | Abrir em nova aba + botão "Abrir PDF novamente" | Implementado (fallback) | Aprovado |
| H3-08 | PDF — conteúdo | Fidelidade ao snapshot | — | Código, identificação, status, "Posso rodar hoje?", componentes, Plano de Ação, histórico, índices, ressalvas, validade, hash, QR, versões, disclaimer | Todos presentes (3 páginas) | Aprovado |
| H3-09 | PDF — acentuação | Texto PT-BR | — | Acentos preservados | OK | Aprovado |
| H3-10 | PDF — paginação | Laudo com 27 componentes | — | Sem corte/sobreposição, rodapé "Página X de Y" | OK | Aprovado |
| H3-11 | PDF — QR Code | Impressão/tela | — | QR íntegro e legível | OK, não cortado | Aprovado |
| H3-12 | Página pública | Sem sessão | Mobile | Abre com conteúdo autorizado | OK | Aprovado |
| H3-13 | Privacidade do payload | Inspeção de rede + HTML | — | Sem CPF, e-mail, telefone, endereço, valores, ids de proprietário | Zero ocorrências | Aprovado |
| H3-14 | Token inválido | Token inexistente | Mobile | "Este link não é válido", sem revelar existência | OK | Aprovado |
| H3-15 | Expiração / revogação | Backend | — | Validado no servidor, não na interface | Conferido em `getPublicHealthReport` | Aprovado |
| H3-16 | Registro de acessos | Link aberto | — | Data, dispositivo e navegador resumidos | Antes só data → **corrigido** (Celular/Computador · navegador) | Aprovado após correção |
| H3-17 | Idempotência | Emissão por Check-up | — | Um laudo por `runId` | Índice único + reuso do laudo existente | Aprovado |
| H3-18 | Disclaimer | Prévia, laudo, PDF, página pública | — | Texto oficial equivalente | Presente em todos | Aprovado |
| H3-19 | Telemetria | Eventos da Etapa 3 | — | Registro técnico sem dados pessoais | `src/lib/health-reports/telemetry.ts` | Aprovado |
| H3-20 | Safari iOS real | PDF e QR | iPhone físico | — | **Não executado** (sem aparelho no ambiente) | Não executado |
| H3-21 | Leitura de QR por câmera física | Papel e tela | Android/iPhone | — | **Não executado** (validado apenas o conteúdo do QR) | Não executado |

## Problemas encontrados e severidade
| # | Problema | Severidade | Correção |
|---|---|---|---|
| 1 | Dois toques em "Salvar em PDF" geravam dois arquivos | Médio | Trava de reentrada de 2,5 s + `aria-busy` |
| 2 | Falha de download deixava o usuário sem saída | Alto | Fallback: abre em nova aba, avisa e mantém botão "Abrir PDF novamente" |
| 3 | Mensagens do PDF fora do padrão pedido | Baixo | "Preparando seu Laudo TrailBook…", "PDF gerado com sucesso.", falha com o código do laudo |
| 4 | Registro de acessos sem dispositivo/navegador | Médio | Resumo não invasivo a partir do `user_agent` |
| 5 | Ausência de telemetria técnica | Médio | Catálogo de eventos funcionais criado |

Nenhum problema **bloqueador** ou **crítico** foi identificado.

## Pendências (dependem de aparelho físico)
- Safari no iPhone: download, compartilhamento nativo e impressão do PDF.
- Leitura do QR Code por câmera real, inclusive impresso em preto e branco.
- Medição de desempenho em aparelho intermediário real.

## Conclusão
Etapa 3 **aprovada com ressalvas**: liberada para uso real em desktop e navegadores móveis baseados em Chromium; as validações em aparelho iOS físico permanecem como verificação de campo durante o beta.