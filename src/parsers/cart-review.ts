import { parse } from "node-html-parser";
import type { Cart, CartItem } from "../memory/schemas.js";

export interface ParsedReview {
  store: string;
  fulfillment: Cart["fulfillment"];
  items: CartItem[];
  subtotal?: number;
  fees?: number;
  total?: number;
}

function parseMoney(txt: string | undefined): number | undefined {
  if (!txt) return undefined;
  const m = txt.replace(/[, ]/g, "").match(/-?\$?(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function parseQty(txt: string | undefined): number {
  if (!txt) return 1;
  const m = txt.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 1;
}

export function parseCartReviewHtml(html: string): ParsedReview {
  const root = parse(html);
  const store = (root.querySelector('[data-testid="store-name"]')?.text ?? "").trim();
  const typeTxt = (root.querySelector('[data-testid="fulfillment-type"]')?.text ?? "").trim().toLowerCase();
  const type: "delivery" | "pickup" = typeTxt.includes("pickup") ? "pickup" : "delivery";
  const window = (root.querySelector('[data-testid="fulfillment-window"]')?.text ?? "").trim();
  const address = (root.querySelector('[data-testid="delivery-address"]')?.text ?? "").trim() || undefined;

  const itemNodes = root.querySelectorAll('[data-testid="cart-item"]');
  const items: CartItem[] = itemNodes.map((node) => {
    const name = (node.querySelector('[data-testid="item-name"]')?.text ?? "").trim();
    const size = (node.querySelector('[data-testid="item-size"]')?.text ?? "").trim() || undefined;
    const qty = parseQty(node.querySelector('[data-testid="item-qty"]')?.text);
    const unit = (node.querySelector('[data-testid="item-unit"]')?.text ?? "").trim() || undefined;
    const price = parseMoney(node.querySelector('[data-testid="item-price"]')?.text) ?? 0;
    return { name, size, qty, unit, price };
  });

  const subtotal = parseMoney(root.querySelector('[data-testid="subtotal"]')?.text);
  const fees = parseMoney(root.querySelector('[data-testid="fees"]')?.text);
  const total = parseMoney(root.querySelector('[data-testid="total"]')?.text);

  return {
    store,
    fulfillment: { type, window, address },
    items,
    subtotal,
    fees,
    total,
  };
}
