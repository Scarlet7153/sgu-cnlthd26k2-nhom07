import { describe, it, expect } from "vitest";
import {
  mapPsuWattageToSegment,
  extractPsuWattage,
  normalizeSocket,
  normalizeRamType,
  getProductSocket,
  getProductRamType,
} from "@/lib/pcBuilderFilters";

describe("mapPsuWattageToSegment", () => {
  it("below 550", () => expect(mapPsuWattageToSegment(450)).toBe("Dưới 550W"));
  it("550-650 range", () => expect(mapPsuWattageToSegment(600)).toBe("550W - 650W"));
  it("650-750 range", () => expect(mapPsuWattageToSegment(750)).toBe("650W - 750W"));
  it("750-850 range", () => expect(mapPsuWattageToSegment(850)).toBe("750W - 850W"));
  it("850-1000 range", () => expect(mapPsuWattageToSegment(1000)).toBe("850W - 1000W"));
  it("above 1000", () => expect(mapPsuWattageToSegment(1200)).toBe("Trên 1000W"));
  it("boundary 550", () => expect(mapPsuWattageToSegment(550)).toBe("550W - 650W"));
});

describe("extractPsuWattage", () => {
  it("parses '750W'", () => expect(extractPsuWattage("750W")).toBe(750));
  it("parses '650 W'", () => expect(extractPsuWattage("650 W")).toBe(650));
  it("parses plain number", () => expect(extractPsuWattage("850")).toBe(850));
  it("returns null for empty", () => expect(extractPsuWattage("")).toBeNull());
  it("returns null for null", () => expect(extractPsuWattage(null)).toBeNull());
  it("ignores out-of-range numbers", () => expect(extractPsuWattage("50")).toBeNull());
  it("extracts from text", () => expect(extractPsuWattage("Corsair 850W Gold")).toBe(850));
});

describe("normalizeSocket", () => {
  it("normalizes 'LGA 1700'", () => expect(normalizeSocket("LGA 1700")).toBe("LGA1700"));
  it("normalizes 'AM4'", () => expect(normalizeSocket("AM4")).toBe("AM4"));
  it("null input", () => expect(normalizeSocket(null)).toBeNull());
  it("empty string", () => expect(normalizeSocket("")).toBeNull());
  it("strips dashes", () => expect(normalizeSocket("lga-1200")).toBe("LGA1200"));
});

describe("normalizeRamType", () => {
  it("DDR4", () => expect(normalizeRamType("DDR4")).toBe("DDR4"));
  it("DDR 5", () => expect(normalizeRamType("DDR 5")).toBe("DDR5"));
  it("ddr3 lowercase", () => expect(normalizeRamType("ddr3")).toBe("DDR3"));
  it("no match", () => expect(normalizeRamType("GDDR6")).toBeNull());
  it("null", () => expect(normalizeRamType(null)).toBeNull());
});

describe("getProductSocket", () => {
  const makeProduct = (overrides: any) => ({
    name: "", specs: {}, ...overrides,
  });

  it("reads direct socket field", () => {
    const p = makeProduct({ socket: "AM5" });
    expect(getProductSocket(p as any)).toBe("AM5");
  });
  it("reads specs.Socket", () => {
    const p = makeProduct({ specs: { Socket: "LGA1700" } });
    expect(getProductSocket(p as any)).toBe("LGA1700");
  });
  it("returns null for empty product", () => {
    expect(getProductSocket(makeProduct({}) as any)).toBeNull();
  });
  it("returns null for null", () => {
    expect(getProductSocket(null)).toBeNull();
  });
});

describe("getProductRamType", () => {
  const makeProduct = (overrides: any) => ({
    name: "", specs: {}, ...overrides,
  });

  it("reads direct ramType", () => {
    const p = makeProduct({ ramType: "DDR5" });
    expect(getProductRamType(p as any)).toBe("DDR5");
  });
  it("reads from specs", () => {
    const p = makeProduct({ specs: { "Thế hệ": "DDR4" } });
    expect(getProductRamType(p as any)).toBe("DDR4");
  });
  it("extracts from name", () => {
    const p = makeProduct({ name: "Kingston Fury DDR5 16GB" });
    expect(getProductRamType(p as any)).toBe("DDR5");
  });
  it("null product", () => expect(getProductRamType(null)).toBeNull());
});
