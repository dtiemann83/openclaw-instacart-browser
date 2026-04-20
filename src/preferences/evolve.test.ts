import { describe, it, expect } from "vitest";
import { recordOverride, promote } from "./evolve.js";
import type { Preferences, PreferenceOverrides } from "../memory/schemas.js";

function fresh(): { prefs: Preferences; overrides: PreferenceOverrides } {
  return {
    prefs: {
      brands: {}, sizes: {},
      stores: { preferred: [], avoid: [] },
      substitutions: { allow: true, ask_first: true },
      dietary: { restrictions: [], notes: "" },
      updated_at: "2026-04-20T00:00:00Z",
    },
    overrides: { pending: {}, history: [] },
  };
}

describe("recordOverride", () => {
  it("appends to pending[] without promoting", () => {
    const s = fresh();
    const out = recordOverride(s, {
      field: "brand", key: "milk", from: "A", to: "B",
      at: "2026-04-20T00:00:00Z", promoteThreshold: 2,
    });
    expect(out.promoted).toBe(false);
    expect(out.overrides.pending.milk.length).toBe(1);
    expect(out.prefs.brands.milk).toBeUndefined();
  });

  it("promotes after N consecutive identical overrides", () => {
    let s = fresh();
    const one = recordOverride(s, { field: "brand", key: "milk", from: "A", to: "B", at: "2026-04-20T00:00:00Z", promoteThreshold: 2 });
    const two = recordOverride(one, { field: "brand", key: "milk", from: "A", to: "B", at: "2026-04-21T00:00:00Z", promoteThreshold: 2 });
    expect(two.promoted).toBe(true);
    expect(two.prefs.brands.milk).toBe("B");
    expect(two.overrides.pending.milk ?? []).toEqual([]);
    expect(two.overrides.history.at(-1)?.reason).toBe("n_consistent_overrides");
  });

  it("resets streak if chosen differs", () => {
    const s0 = fresh();
    const step1 = recordOverride(s0, {
      field: "brand", key: "milk", from: "A", to: "B", at: "t1", promoteThreshold: 2,
    });
    const step2 = recordOverride(
      { prefs: step1.prefs, overrides: step1.overrides },
      { field: "brand", key: "milk", from: "A", to: "C", at: "t2", promoteThreshold: 2 },
    );
    expect(step2.promoted).toBe(false);
    expect(step2.overrides.pending.milk.length).toBe(2);
    expect(step2.overrides.history.filter((h) => h.key === "milk").length).toBe(0);
  });
});

describe("promote", () => {
  it("one_shot_confirm writes to prefs and history", () => {
    const s = fresh();
    const out = promote(s, { field: "brand", key: "milk", from: "A", to: "B", at: "2026-04-20T00:00:00Z", reason: "one_shot_confirm" });
    expect(out.prefs.brands.milk).toBe("B");
    expect(out.overrides.history.at(-1)?.reason).toBe("one_shot_confirm");
  });

  it("manual promotion also writes history", () => {
    const s = fresh();
    const out = promote(s, { field: "brand", key: "milk", from: "", to: "B", at: "2026-04-20T00:00:00Z", reason: "manual" });
    expect(out.prefs.brands.milk).toBe("B");
    expect(out.overrides.history.at(-1)?.reason).toBe("manual");
  });

  it("handles store field by updating stores.preferred", () => {
    const s = fresh();
    const out = promote(s, { field: "store", key: "HT", from: "", to: "HT", at: "t", reason: "manual" });
    expect(out.prefs.stores.preferred).toContain("HT");
  });
});
