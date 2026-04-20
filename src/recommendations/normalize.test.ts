import { describe, it, expect } from "vitest";
import { normalizeItemKey, NORMALIZER_VERSION } from "./normalize.js";

describe("normalizeItemKey", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeItemKey("Whole Milk!!")).toBe("whole milk");
    expect(normalizeItemKey("  Bananas  ")).toBe("bananas");
  });

  it("collapses whitespace", () => {
    expect(normalizeItemKey("Organic   Milk")).toBe("organic milk");
  });

  it("strips brand prefix when similar items recorded under it", () => {
    expect(normalizeItemKey("Horizon Organic Whole Milk", { brand: "Horizon Organic" }))
      .toBe("whole milk");
  });

  it("strips size suffix", () => {
    expect(normalizeItemKey("Milk 1 gal")).toBe("milk");
    expect(normalizeItemKey("Bread 20 oz")).toBe("bread");
    expect(normalizeItemKey("Yogurt 32-oz")).toBe("yogurt");
  });

  it("exposes a version string", () => {
    expect(typeof NORMALIZER_VERSION).toBe("string");
    expect(NORMALIZER_VERSION.length).toBeGreaterThan(0);
  });
});
