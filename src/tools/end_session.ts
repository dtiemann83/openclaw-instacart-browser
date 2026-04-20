import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";

export const EndSessionInput = Type.Object({
  status: Type.Union([Type.Literal("handed_off"), Type.Literal("abandoned")]),
});
export type EndSessionInputT = Static<typeof EndSessionInput>;

export async function runEndSession(
  deps: { store: MemoryStore },
  input: EndSessionInputT,
): Promise<{ ok: true }> {
  const cur = await deps.store.readSessions();
  if (!cur.current) return { ok: true };
  const closed = { ...cur.current, status: input.status, last_updated: new Date().toISOString() };
  await deps.store.writeSessions({
    recent: [closed, ...cur.recent].slice(0, 10),
  });
  return { ok: true };
}
