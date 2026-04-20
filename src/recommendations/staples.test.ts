import { describe, it, expect } from "vitest";
import { detectStaples } from "./staples.js";
import type { Cart } from "../memory/schemas.js";

function cart(builtAt: string, items: Array<{ name: string; qty?: number; brand?: string; size?: string }>): Cart {
  return {
    cart_id: `local_${builtAt}`,
    built_at: builtAt,
    store: "HT",
    fulfillment: { type: "delivery", window: "w" },
    items: items.map((i) => ({ name: i.name, qty: i.qty ?? 1, price: 1, brand: i.brand, size: i.size })),
  };
}

describe("detectStaples", () => {
  it("needs minOccurrences within windowSize", () => {
    const carts: Cart[] = [
      cart("2026-04-10T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-14T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-16T00:00:00Z", [{ name: "Eggs" }]),
      cart("2026-04-18T00:00:00Z", [{ name: "Eggs" }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 5 } });
    expect(res.staples.map((s) => s.key)).toContain("milk");
    expect(res.staples.map((s) => s.key)).not.toContain("eggs");
  });

  it("limits to the most recent windowSize carts", () => {
    const carts: Cart[] = [
      cart("2026-04-01T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-02T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-03T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-10T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-11T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Bread" }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 3 } });
    expect(res.staples.map((s) => s.key)).toEqual(["bread"]);
  });

  it("respects maxAgeDays if set", () => {
    const now = new Date("2026-04-20T00:00:00Z");
    const carts: Cart[] = [
      cart("2026-01-01T00:00:00Z", [{ name: "Old" }]),
      cart("2026-01-02T00:00:00Z", [{ name: "Old" }]),
      cart("2026-01-03T00:00:00Z", [{ name: "Old" }]),
    ];
    const res = detectStaples({
      carts,
      config: { minOccurrences: 3, windowSize: 5, maxAgeDays: 30 },
      now,
    });
    expect(res.staples).toEqual([]);
  });

  it("computes recency_rank as 0..1 with most-recent highest", () => {
    const carts: Cart[] = [
      cart("2026-04-10T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-20T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-10T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-14T00:00:00Z", [{ name: "Bread" }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 10 } });
    const milk = res.staples.find((s) => s.key === "milk")!;
    const bread = res.staples.find((s) => s.key === "bread")!;
    expect(milk.recency_rank).toBeGreaterThan(bread.recency_rank);
    expect(milk.recency_rank).toBeLessThanOrEqual(1);
    expect(bread.recency_rank).toBeGreaterThanOrEqual(0);
  });

  it("uses median qty as typical_qty", () => {
    const carts: Cart[] = [
      cart("2026-04-10T00:00:00Z", [{ name: "Bananas", qty: 2 }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Bananas", qty: 5 }]),
      cart("2026-04-14T00:00:00Z", [{ name: "Bananas", qty: 3 }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 5 } });
    expect(res.staples[0].typical_qty).toBe(3);
  });
});
