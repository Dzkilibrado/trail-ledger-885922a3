import { usageDate } from "./usage-reading";

export function validateUsageIncrement(mode: string, value: string, date: string, today = usageDate()): string | null {
  if (mode !== "hours" && mode !== "km") return "Defina uma única unidade de medição no cadastro da moto.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || date > today) return "Escolha uma data válida, até hoje.";
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return "Informe um uso válido e maior que zero.";
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return "Informe um uso válido e maior que zero.";
  if (mode === "km" && !Number.isInteger(amount)) return "Informe quilômetros inteiros.";
  if (mode === "hours" && Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return "Use até duas casas decimais.";
  return null;
}

export function usageIncrementPreview(mode: string, current: number, value: string) {
  const amount = Number(value.replace(",", "."));
  if (validateUsageIncrement(mode, value, usageDate()) || !Number.isFinite(current)) return null;
  return { current, amount, total: Math.round((current + amount) * 100) / 100 };
}