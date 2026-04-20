import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCartReviewHtml } from "./cart-review.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, "../../test/fixtures/cart-review.html"), "utf8"
);

describe("parseCartReviewHtml", () => {
  it("extracts store + fulfillment", () => {
    const c = parseCartReviewHtml(FIXTURE);
    expect(c.store).toBe("Harris Teeter - Wake Forest");
    expect(c.fulfillment.type).toBe("delivery");
    expect(c.fulfillment.window).toContain("10:00 AM");
    expect(c.fulfillment.address).toContain("Wake Forest");
  });

  it("extracts items with qty and price", () => {
    const c = parseCartReviewHtml(FIXTURE);
    expect(c.items).toHaveLength(2);
    const milk = c.items[0];
    expect(milk.name).toBe("Horizon Organic Whole Milk");
    expect(milk.qty).toBe(2);
    expect(milk.price).toBeCloseTo(7.98);
    expect(milk.size).toBe("1 gal");
  });

  it("extracts totals if present", () => {
    const c = parseCartReviewHtml(FIXTURE);
    expect(c.subtotal).toBeCloseTo(9.96);
    expect(c.total).toBeCloseTo(13.95);
    expect(c.fees).toBeCloseTo(3.99);
  });
});
