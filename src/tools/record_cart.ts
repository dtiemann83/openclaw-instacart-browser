import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { cartSchema } from "../memory/schemas.js";
import { detectStaples } from "../recommendations/staples.js";
import type { InstacartConfig } from "../config.js";

export const RecordCartInput = Type.Object({
  cart: Type.Unknown({ description: "Cart object matching DESIGN §6." }),
});
export type RecordCartInputT = Static<typeof RecordCartInput>;

export async function runRecordCart(
  deps: { store: MemoryStore; config: InstacartConfig },
  input: RecordCartInputT,
): Promise<{ ok: true; staples_recomputed: boolean }> {
  const cart = cartSchema.parse(input.cart);
  await deps.store.appendCart(cart);
  const cartsFile = await deps.store.readCarts();
  const { staples, normalizer_version } = detectStaples({
    carts: cartsFile.carts,
    config: {
      minOccurrences: deps.config.staples.minOccurrences,
      windowSize: deps.config.staples.windowSize,
      maxAgeDays: deps.config.staples.maxAgeDays,
    },
  });
  await deps.store.writeStaples({
    staples,
    computed_at: new Date().toISOString(),
    normalizer_version,
    config: {
      minOccurrences: deps.config.staples.minOccurrences,
      windowSize: deps.config.staples.windowSize,
      maxAgeDays: deps.config.staples.maxAgeDays,
    },
  });
  return { ok: true, staples_recomputed: true };
}
