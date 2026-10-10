import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_SHORTCUTS, resolveHomeShortcuts, MAX_HOME_SHORTCUTS } from "./home-shortcuts";
describe("home shortcuts", () => {
  it("new user has usage first", () => expect(DEFAULT_HOME_SHORTCUTS[0]).toBe("registrar-uso"));
  it("retains previous defaults", () => expect(DEFAULT_HOME_SHORTCUTS.slice(1)).toEqual(["passaporte","documentos","recibo","selos","saude","manutencoes","cockpit"]));
  it("retains removal on subsequent reads", () => expect(resolveHomeShortcuts(["cockpit"]).map(x => x.key)).toEqual(["cockpit"]));
  it("retains an empty configuration", () => expect(resolveHomeShortcuts([])).toEqual([]));
  it("retains reordering", () => expect(resolveHomeShortcuts(["cockpit","registrar-uso"]).map(x => x.key)).toEqual(["cockpit","registrar-uso"]));
  it("has room for all nine existing selections plus usage", () => expect(MAX_HOME_SHORTCUTS).toBe(10));
});