import { describe, expect, it } from "vitest";
import { usageIncrementPreview, validateUsageIncrement } from "./usage-increment";
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