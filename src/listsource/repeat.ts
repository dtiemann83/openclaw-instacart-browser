import type { ListItem, ListSourceResult, Cart } from "./types.js";

export interface RepeatInput {
  carts: Cart[];
  ref: { cart_id: string };
}

export function openRepeat(inp: RepeatInput): ListSourceResult {
  let target: Cart | undefined;
  if (inp.ref.cart_id === "last") {
    const sorted = [...inp.carts].sort((a, b) => a.built_at.localeCompare(b.built_at));
    target = sorted.at(-1);
  } else {
    target = inp.carts.find((c) => c.cart_id === inp.ref.cart_id);
  }
  const items: ListItem[] = (target?.items ?? []).map((it) => ({
    name: it.name, qty: it.qty, brand: it.brand, size: it.size,
  }));
  return { items, origin: "repeat" };
}
