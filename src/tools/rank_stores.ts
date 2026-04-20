import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import type { InstacartConfig } from "../config.js";
import { rankStores, type StoreCandidate } from "../recommendations/stores.js";

export const RankStoresInput = Type.Object({
  candidates: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    distanceMi: Type.Optional(Type.Number()),
    windows: Type.Optional(Type.Array(Type.String())),
    carries: Type.Optional(Type.Array(Type.String())),
  })),
  list: Type.Optional(Type.Array(Type.String())),
});
export type RankStoresInputT = Static<typeof RankStoresInput>;

export async function runRankStores(
  deps: { store: MemoryStore; config: InstacartConfig },
  input: RankStoresInputT,
): Promise<{ ranked: Array<StoreCandidate & { score: number; rationale: string }> }> {
  const prefsFile = await deps.store.readPreferences();
  const cartsFile = await deps.store.readCarts();
  const historyCounts: Record<string, number> = {};
  for (const c of cartsFile.carts) {
    historyCounts[c.store] = (historyCounts[c.store] ?? 0) + 1;
  }
  const { ranked } = rankStores({
    candidates: input.candidates,
    list: input.list ?? [],
    prefs: prefsFile.preferences.stores,
    historyCounts,
    weights: deps.config.ranking,
  });
  return { ranked };
}
