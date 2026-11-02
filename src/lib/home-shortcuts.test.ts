import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_SHORTCUTS,
  HOME_SHORTCUT_CATALOG,
  MAX_HOME_SHORTCUTS,
  SHORTCUT_COUNT_OPTIONS,
  resolveHomeShortcuts,
} from "./home-shortcuts";

describe("home shortcuts", () => {
  // Comportamento de defaults
  it("first default is registrar-uso", () =>
    expect(DEFAULT_HOME_SHORTCUTS[0]).toBe("registrar-uso"));

  it("default list fits within a valid count option", () =>
    expect(SHORTCUT_COUNT_OPTIONS).toContain(
      SHORTCUT_COUNT_OPTIONS.find((c) => c >= DEFAULT_HOME_SHORTCUTS.length)!,
    ));

  // Comportamento de resolução
  it("retains removal on subsequent reads", () =>
    expect(resolveHomeShortcuts(["cockpit"]).map((x) => x.key)).toEqual(["cockpit"]));

  it("retains an empty configuration", () =>
    expect(resolveHomeShortcuts([])).toEqual([]));

  it("retains reordering", () =>
    expect(resolveHomeShortcuts(["cockpit", "registrar-uso"]).map((x) => x.key)).toEqual([
      "cockpit",
      "registrar-uso",
    ]));

  it("ignores unknown keys gracefully", () =>
    expect(resolveHomeShortcuts(["registrar-uso", "chave-inexistente" as any]).map((x) => x.key)).toEqual([
      "registrar-uso",
    ]));

  // Constantes de configuração
  it("max is 15", () => expect(MAX_HOME_SHORTCUTS).toBe(15));

  it("count options are 3/6/9/12/15", () =>
    expect(SHORTCUT_COUNT_OPTIONS).toEqual([3, 6, 9, 12, 15]));

  it("all count options are multiples of 3", () =>
    SHORTCUT_COUNT_OPTIONS.forEach((c) => expect(c % 3).toBe(0)));

  // Catálogo
  it("catalog has no duplicate keys", () => {
    const keys = HOME_SHORTCUT_CATALOG.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("pecas is in catalog", () =>
    expect(HOME_SHORTCUT_CATALOG.some((s) => s.key === "pecas")).toBe(true));

  it("registrar-uso is in catalog", () =>
    expect(HOME_SHORTCUT_CATALOG.some((s) => s.key === "registrar-uso")).toBe(true));

  it("all catalog items have required fields", () => {
    for (const item of HOME_SHORTCUT_CATALOG) {
      expect(item.key).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.group).toMatch(/^(acao|moto|global)$/);
      expect(item.to).toBeTruthy();
    }
  });
});
