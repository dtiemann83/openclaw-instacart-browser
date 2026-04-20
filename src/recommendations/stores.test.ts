import { describe, it, expect } from "vitest";
import { rankStores, DEFAULT_WEIGHTS } from "./stores.js";

describe("rankStores", () => {
  it("uses weights from config", () => {
    const { ranked } = rankStores({
      candidates: [
        { id: "a", name: "A", distanceMi: 1, windows: ["w1"], carries: ["milk"] },
        { id: "b", name: "B", distanceMi: 5, windows: ["w1"], carries: ["milk"] },
      ],
      list: ["milk"],
      prefs: { preferred: [], avoid: [] },
      historyCounts: {},
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked[0].id).toBe("a");
  });

  it("removes avoid list", () => {
    const { ranked } = rankStores({
      candidates: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      list: [],
      prefs: { preferred: [], avoid: ["A"] },
      historyCounts: {},
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked.map((r) => r.id)).toEqual(["b"]);
  });

  it("boosts preferred stores", () => {
    const { ranked } = rankStores({
      candidates: [
        { id: "a", name: "A", distanceMi: 5 },
        { id: "b", name: "B", distanceMi: 1 },
      ],
      list: [],
      prefs: { preferred: ["A"], avoid: [] },
      historyCounts: {},
      weights: { ...DEFAULT_WEIGHTS, proximity: 0.1, history: 0.1, listMatch: 0.1, windowFit: 0.1 },
    });
    expect(ranked[0].id).toBe("a");
  });

  it("returns rationale per store", () => {
    const { ranked } = rankStores({
      candidates: [{ id: "a", name: "A", distanceMi: 2 }],
      list: [],
      prefs: { preferred: [], avoid: [] },
      historyCounts: { A: 4 },
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked[0].rationale).toBeTruthy();
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("empty history fallback is stable", () => {
    const { ranked } = rankStores({
      candidates: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      list: [],
      prefs: { preferred: [], avoid: [] },
      historyCounts: {},
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});
