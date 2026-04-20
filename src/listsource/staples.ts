import type { ListItem, ListSourceResult, Staple } from "./types.js";

export function openStaples(inp: { staples: Staple[] }): ListSourceResult {
  const items: ListItem[] = inp.staples.map((s) => ({
    name: s.display_name,
    qty: s.typical_qty,
    brand: s.brand,
    size: s.size,
  }));
  return { items, origin: "staples" };
}
