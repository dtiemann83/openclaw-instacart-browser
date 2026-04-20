import type { ListSourceResult } from "./types.js";

export function openRecipes(_inp: { args: Record<string, unknown> }): ListSourceResult {
  return { items: [], origin: "recipes", notImplemented: true };
}
