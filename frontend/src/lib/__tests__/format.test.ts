import { describe, it, expect } from "vitest";
import { formatPrice, formatNumber } from "@/lib/format";

describe("formatPrice", () => {
  it("formats VND correctly", () => {
    expect(formatPrice(1000000)).toContain("1.000.000");
    expect(formatPrice(1000000)).toContain("₫");
  });
  it("handles zero", () => expect(formatPrice(0)).toMatch(/0.*₫/));
  it("handles negatives", () => expect(formatPrice(-500000)).toContain("-500.000"));
  it("large price", () => expect(formatPrice(50000000)).toMatch(/50\.000\.000.*₫/));
  it("small price", () => expect(formatPrice(1000)).toMatch(/1\.000.*₫/));
});

describe("formatNumber", () => {
  it("adds thousand separators", () => expect(formatNumber(1234567)).toBe("1.234.567"));
  it("no separator under 1000", () => expect(formatNumber(999)).toBe("999"));
  it("zero", () => expect(formatNumber(0)).toBe("0"));
  it("negative", () => expect(formatNumber(-50000)).toBe("-50.000"));
});
