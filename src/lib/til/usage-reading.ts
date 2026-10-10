export function usageDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function validateUsageReading(mode: string, value: string, date: string, current: number, today = usageDate()): string | null {
  if (mode !== "hours" && mode !== "km") return "Defina uma única unidade de medição no cadastro da moto.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today) return "Escolha uma data válida, até hoje.";
  const reading = Number(value.replace(",", "."));
  if (!value.trim() || !Number.isFinite(reading) || reading < 0) return "Informe uma leitura válida.";
  if (reading <= current) return "A leitura deve ser maior que a leitura atual.";
  if (mode === "km" && !Number.isInteger(reading)) return "Informe quilômetros inteiros.";
  if (mode === "hours" && Math.abs(reading * 100 - Math.round(reading * 100)) > 0.000001) return "Use até duas casas decimais.";
  return null;
}