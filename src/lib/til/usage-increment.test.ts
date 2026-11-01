import { describe, expect, it } from "vitest";
import { usageIncrementPreview, validateUsageIncrement, computeUsageAverage, isUsageAtypical } from "./usage-increment";
describe("additional usage shortcut", () => {
  it("adds 10h to 10h", () => expect(usageIncrementPreview("hours", 10, "10")?.total).toBe(20));
  it("adds 1,5h to 10h", () => expect(usageIncrementPreview("hours", 10, "1,5")?.total).toBe(11.5));
  it("adds 80km to 1500km", () => expect(usageIncrementPreview("km", 1500, "80")?.total).toBe(1580));
  for (const value of ["0", "-1", "", "NaN", "Infinity", "1e2", "0x10"]) {
    it(`rejects invalid amount ${value}`, () => expect(validateUsageIncrement("hours", value, "2026-10-10", "2026-10-10")).not.toBeNull());
  }
  it("requires two decimals for hours", () => expect(validateUsageIncrement("hours", "1.501", "2026-10-10", "2026-10-10")).not.toBeNull());
  it("requires integer km", () => expect(validateUsageIncrement("km", "80.5", "2026-10-10", "2026-10-10")).not.toBeNull());
  it("rejects future dates", () => expect(validateUsageIncrement("hours", "1", "2026-10-11", "2026-10-10")).not.toBeNull());
  it("rejects impossible dates", () => expect(validateUsageIncrement("hours", "1", "2026-02-30", "2026-10-10")).not.toBeNull());
});

describe("computeUsageAverage — média adaptativa ponderada", () => {
  it("retorna null com 0 registros", () => expect(computeUsageAverage([])).toBeNull());
  it("retorna null com 1 registro", () => expect(computeUsageAverage([10])).toBeNull());

  it("com 2 registros calcula média ponderada (3:2)", () => {
    // [10, 5]: pesos [3,2], soma=5 → (10*3 + 5*2)/5 = 40/5 = 8
    expect(computeUsageAverage([10, 5])).toBeCloseTo(8, 5);
  });

  it("com 3 registros calcula média ponderada (3:2:1)", () => {
    // [12, 8, 4]: pesos [3,2,1], soma=6 → (12*3 + 8*2 + 4*1)/6 = (36+16+4)/6 = 56/6 ≈ 9.333
    expect(computeUsageAverage([12, 8, 4])).toBeCloseTo(56 / 6, 5);
  });

  it("com mais de 3 registros usa apenas os 3 mais recentes", () => {
    // [12, 8, 4, 2, 1] → usa [12, 8, 4] = mesmo resultado acima
    expect(computeUsageAverage([12, 8, 4, 2, 1])).toBeCloseTo(56 / 6, 5);
  });

  it("média igual quando todos os valores são iguais", () => {
    expect(computeUsageAverage([10, 10, 10])).toBeCloseTo(10, 5);
  });

  it("acompanha tendência crescente (valor recente tem mais peso)", () => {
    // [20, 10, 5]: mais recente=20 → média > 10 simples
    const avg = computeUsageAverage([20, 10, 5])!;
    expect(avg).toBeGreaterThan(10); // tendência de alta detectada
  });

  it("acompanha tendência decrescente", () => {
    // [5, 10, 20]: mais recente=5 → média < 11.67 simples
    const avg = computeUsageAverage([5, 10, 20])!;
    expect(avg).toBeLessThan(11.67);
  });
});

describe("isUsageAtypical — limiar de 10%", () => {
  it("retorna false quando média é null (sem histórico)", () => {
    expect(isUsageAtypical(100, null)).toBe(false);
  });

  it("retorna false quando valor está dentro da faixa normal", () => {
    // média=10, 10% acima=11; valor 10.5 → dentro
    expect(isUsageAtypical(10.5, 10)).toBe(false);
  });

  it("retorna false exatamente no limiar (valor = média * 1.1)", () => {
    expect(isUsageAtypical(11, 10)).toBe(false); // 11 === 10*1.1, não "maior que"
  });

  it("retorna true quando valor excede 10% acima da média", () => {
    // média=10, 10% acima=11; valor 11.1 → atípico
    expect(isUsageAtypical(11.1, 10)).toBe(true);
  });

  it("retorna true para erro de digitação clássico (10h → 100h)", () => {
    // média=10h, usuário digitou 100h
    expect(isUsageAtypical(100, 10)).toBe(true);
  });

  it("retorna false quando média é zero (evita divisão)", () => {
    expect(isUsageAtypical(5, 0)).toBe(false);
  });

  it("retorna false quando média é negativa (dado inválido)", () => {
    expect(isUsageAtypical(5, -1)).toBe(false);
  });
});