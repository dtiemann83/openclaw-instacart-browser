import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import type { InstacartConfig } from "../config.js";
import { detectStaples } from "../recommendations/staples.js";

export const DetectStaplesInput = Type.Object({
  force: Type.Optional(Type.Boolean()),
});
export type DetectStaplesInputT = Static<typeof DetectStaplesInput>;

export async function runDetectStaples(
  deps: { store: MemoryStore; config: InstacartConfig },
  input: DetectStaplesInputT,
): Promise<{ staples: unknown; changed: boolean }> {
  const cartsFile = await deps.store.readCarts();
  const cur = await deps.store.readStaples();
  const { staples, normalizer_version } = detectStaples({
    carts: cartsFile.carts,
    config: deps.config.staples,
  });
  const changed =
    input.force ||
    cur.normalizer_version !== normalizer_version ||
    cur.staples.length !== staples.length ||
    staples.some((s, i) => cur.staples[i]?.key !== s.key);
  if (changed) {
    await deps.store.writeStaples({
      staples,
      computed_at: new Date().toISOString(),
      normalizer_version,
      config: deps.config.staples,
    });
  }
  return { staples, changed: !!changed };
}
