import type { HealthStatus } from "./status";

/**
 * TrailBook Health — catálogo central de linguagem.
 *
 * REGRA OFICIAL: nenhuma tela escreve texto de diagnóstico.
 * Todo texto exibido ao usuário vem daqui (ou da TIL, que também consome daqui).
 * Assim o mesmo status nunca é explicado de duas formas diferentes.
 */

/** Versão da regra de diagnóstico — rastreabilidade e auditoria. */
export const DIAGNOSIS_RULE_VERSION = "health-2.0.0";

/** Frase semântica oficial de cada status (nível componente). */
export const STATUS_MEANING_TEXT: Record<HealthStatus, string> = {
  ok: "Não identificamos necessidade de intervenção nos registros atuais.",
  attention: "Este item merece acompanhamento e pode exigir manutenção em breve.",
  action: "Recomendamos verificar este item antes de continuar utilizando a moto.",
  unknown: "Ainda não existem informações suficientes para avaliar este item.",
};

/** Título curto usado em cards e listas. */
export const STATUS_TITLE: Record<HealthStatus, string> = {
  ok: "Saudável",
  attention: "Atenção",
  action: "Necessita ação",
  unknown: "Ainda não avaliado",
};

/** Cabeçalho da explicação "por que este status?". */
export const STATUS_WHY_TITLE: Record<HealthStatus, string> = {
  ok: "Por que está saudável?",
  attention: "Por que está em atenção?",
  action: "Por que necessita ação?",
  unknown: "Por que ainda não foi avaliado?",
};

/** Resposta "posso rodar hoje?" — nível moto. */
export const RIDE_ANSWER_TITLE: Record<HealthStatus, string> = {
  ok: "Sua moto está pronta para uso",
  attention: "Pode ser utilizada, com acompanhamento",
  action: "Uso não recomendado agora",
  unknown: "Ainda não é possível confirmar",
};

export const RIDE_ANSWER_MESSAGE: Record<HealthStatus, string> = {
  ok: "Não identificamos itens críticos nos registros atuais.",
  attention: "Sua moto pode ser utilizada, mas existem itens que merecem acompanhamento.",
  action: "Não recomendamos utilizar a moto antes de verificar os itens críticos. Foi identificada uma condição que pode comprometer a segurança.",
  unknown: "Ainda não temos informações suficientes para confirmar se a moto está pronta para uso. Complete os dados indicados para gerar uma análise mais confiável.",
};

/** Linguagem responsável — sempre exibida junto da resposta. */
export const RIDE_ANSWER_DISCLAIMER =
  "Análise baseada nos registros disponíveis no TrailBook. Não substitui inspeção mecânica presencial.";

/** Conclusão padrão por status (o que fazer). */
export const STATUS_CONCLUSION: Record<HealthStatus, string> = {
  ok: "Nada a fazer agora. Continue registrando as atividades normalmente.",
  attention: "Ainda pode ser utilizada normalmente. Programe a manutenção deste componente.",
  action: "Resolva este item antes do próximo uso.",
  unknown: "Informe os dados indicados para que o TrailBook possa avaliar este componente.",
};

/** Conclusão reforçada para itens de segurança. */
export const STATUS_CONCLUSION_SAFETY =
  "Este é um item de segurança. Não recomendamos rodar antes de resolvê-lo.";

/** Texto de apoio para componentes sem dados. */
export const NO_DATA_HELP_TITLE = "Ainda não avaliado";
export const NO_DATA_HELP_INTRO = (name: string) =>
  `Não encontramos informações suficientes sobre ${name.toLowerCase()}.`;
export const NO_DATA_HELP_STEPS = [
  "Informe a última inspeção",
  "Registre a última troca ou manutenção",
  "Atualize a quilometragem ou as horas atuais",
  "Opcionalmente, envie uma foto do componente",
];

/** Rótulos de dados usados / dados que melhorariam a análise. */
export const DATA_LABEL: Record<string, string> = {
  last_maintenance: "Última manutenção",
  current_usage: "Horas / quilometragem atuais",
  reference_interval: "Intervalo de referência",
  inspection: "Registros de inspeção",
  occurrences: "Ocorrências informadas",
  photo: "Foto atual do componente",
  workshop: "Inspeção realizada por oficina",
  history: "Histórico de manutenções",
};

export const IMPROVE_ACTION: Record<string, string> = {
  last_maintenance: "Informe a data e a leitura da última manutenção",
  current_usage: "Atualize o horímetro ou o odômetro da moto",
  reference_interval: "Defina o intervalo de referência do componente",
  inspection: "Registre uma inspeção do componente",
  occurrences: "Informe ocorrências ou avarias observadas",
  photo: "Anexe uma foto atual do componente",
  workshop: "Registre uma manutenção feita em oficina",
  history: "Registre as manutenções já realizadas",
};
