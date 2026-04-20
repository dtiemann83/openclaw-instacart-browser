import type { ListItem, ListSourceResult, Preferences } from "./types.js";

export interface AdhocInput {
  items: Array<{ name: string; qty?: number }>;
  prefs: Preferences;
}

export function openAdhoc(inp: AdhocInput): ListSourceResult {
  const items: ListItem[] = inp.items.map((it) => {
    const key = it.name.toLowerCase();
    return {
      name: it.name,
      qty: it.qty ?? 1,
      brand: inp.prefs.brands[key],
      size: inp.prefs.sizes[key],
    };
  });
  return { items, origin: "adhoc" };
}
