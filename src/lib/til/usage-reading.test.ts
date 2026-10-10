import { describe, expect, it } from "vitest";
import { usageDate, validateUsageReading } from "./usage-reading";
describe("accumulated usage", () => {
  it("accepts total 13h after 10h", () => expect(validateUsageReading("hours", "13", "2026-10-10", 10, "2026-10-10")).toBeNull());
  it("accepts comma decimal 13,5", () => expect(validateUsageReading("hours", "13,5", "2026-10-10", 10, "2026-10-10")).toBeNull());
  it("rejects an empty reading", () => expect(validateUsageReading("hours", "", "2026-10-10", 10)).not.toBeNull());
  it("rejects negatives", () => expect(validateUsageReading("hours", "-1", "2026-10-10", 10)).not.toBeNull());
  it("rejects lower readings", () => expect(validateUsageReading("hours", "9", "2026-10-10", 10)).not.toBeNull());
  it("rejects duplicate readings", () => expect(validateUsageReading("hours", "10", "2026-10-10", 10)).not.toBeNull());
  it("rejects future dates", () => expect(validateUsageReading("hours", "13", "2026-10-11", 10, "2026-10-10")).not.toBeNull());
  it("rejects excessive hours precision", () => expect(validateUsageReading("hours", "13.501", "2026-10-10", 10)).not.toBeNull());
  it("requires integer km", () => expect(validateUsageReading("km", "12500.5", "2026-10-10", 10000)).not.toBeNull());
  it("accepts accumulated 12500km", () => expect(validateUsageReading("km", "12500", "2026-10-10", 10000, "2026-10-10")).toBeNull());
  it("blocks unspecified mode", () => expect(validateUsageReading("not_informed", "13", "2026-10-10", 10)).not.toBeNull());
  it("blocks ambiguous both mode", () => expect(validateUsageReading("both", "13", "2026-10-10", 10)).not.toBeNull());
  it("uses Brazilian calendar date", () => expect(usageDate(new Date("2026-10-10T01:00:00Z"))).toBe("2026-10-09"));
});