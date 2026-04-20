import { describe, it, expect } from "vitest";
import type { Preferences } from "../memory/schemas.js";
import { openAdhoc } from "./adhoc.js";
import { openStaples } from "./staples.js";
import { openRepeat } from "./repeat.js";
import { openRecipes } from "./recipes.js";

function prefs(): Preferences {
  return {
    brands: { milk: "Horizon" }, sizes: { milk: "1 gal" },
    stores: { preferred: [], avoid: [] },
    substitutions: { allow: true, ask_first: true },
    dietary: { restrictions: [], notes: "" },
    updated_at: "t",
  };
}

describe("listsource", () => {
  it("adhoc applies preferences", () => {
    const out = openAdhoc({ items: [{ name: "Milk", qty: 1 }], prefs: prefs() });
    expect(out.items[0].brand).toBe("Horizon");
    expect(out.items[0].size).toBe("1 gal");
    expect(out.origin).toBe("adhoc");
  });

  it("staples pulls the current staples list", () => {
    const out = openStaples({
      staples: [{
        key: "milk", display_name: "Milk", typical_qty: 1, occurrences: 3,
        last_seen: "t", recency_rank: 1,
      }],
    });
    expect(out.items[0].name).toBe("Milk");
    expect(out.items[0].qty).toBe(1);
    expect(out.origin).toBe("staples");
  });

  it("repeat loads a cart by cart_id", () => {
    const out = openRepeat({
      carts: [{
        cart_id: "local_x", built_at: "t", store: "s",
        fulfillment: { type: "delivery", window: "w" },
        items: [{ name: "Bread", qty: 1, price: 1 }],
      }],
      ref: { cart_id: "local_x" },
    });
    expect(out.items[0].name).toBe("Bread");
  });

  it("repeat with 'last' loads the most recent", () => {
    const out = openRepeat({
      carts: [
        { cart_id: "a", built_at: "2026-04-10T00:00:00Z", store: "s",
          fulfillment: { type: "delivery", window: "w" }, items: [{ name: "X", qty: 1, price: 1 }] },
        { cart_id: "b", built_at: "2026-04-20T00:00:00Z", store: "s",
          fulfillment: { type: "delivery", window: "w" }, items: [{ name: "Y", qty: 1, price: 1 }] },
      ],
      ref: { cart_id: "last" },
    });
    expect(out.items[0].name).toBe("Y");
  });

  it("recipes returns NotImplemented", () => {
    const out = openRecipes({ args: {} });
    expect(out.origin).toBe("recipes");
    expect(out.items).toEqual([]);
    expect(out.notImplemented).toBe(true);
  });
});
