import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { sessionSchema } from "../memory/schemas.js";

export const UpdateSessionInput = Type.Object({
  patch: Type.Unknown({ description: "Partial Session to merge into current." }),
});
export type UpdateSessionInputT = Static<typeof UpdateSessionInput>;

export async function runUpdateSession(
  deps: { store: MemoryStore },
  input: UpdateSessionInputT,
): Promise<{ ok: true }> {
  const cur = await deps.store.readSessions();
  if (!cur.current) throw new Error("no current session");
  const merged = sessionSchema.parse({
    ...cur.current,
    ...(input.patch as Record<string, unknown>),
    last_updated: new Date().toISOString(),
  });
  await deps.store.writeSessions({ current: merged, recent: cur.recent });
  return { ok: true };
}
