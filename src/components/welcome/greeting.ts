export type WelcomeGreeting = { title: string; line: string };

const MORNING = [
  "Vamos conferir como está a saúde da sua motocicleta?",
  "Um bom dia começa com a moto em dia.",
];
const AFTERNOON = [
  "Tudo pronto para a próxima trilha?",
  "Que tal revisar o que está pendente hoje?",
];
const NIGHT = [
  "Seu histórico está sempre seguro no TrailBook.",
  "Enquanto você descansa, o histórico da sua moto continua guardado.",
];

/** Saudação baseada apenas no relógio do aparelho — sem rede, sem configuração. */
export function getWelcomeGreeting(now: Date = new Date()): WelcomeGreeting {
  const h = now.getHours();
  const [title, pool] =
    h >= 5 && h < 12
      ? (["Bom dia.", MORNING] as const)
      : h >= 12 && h < 18
        ? (["Boa tarde.", AFTERNOON] as const)
        : (["Boa noite.", NIGHT] as const);

  const index = now.getDate() % pool.length;
  return { title, line: pool[index] };
}