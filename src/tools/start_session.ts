import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { newSessionId } from "../ids.js";

export const StartSessionInput = Type.Object({
  list_source: Type.Union([
    Type.Literal("adhoc"), Type.Literal("staples"),
    Type.Literal("repeat"), Type.Literal("recipes"),
  ]),
  list_source_ref: Type.Optional(Type.String()),
});
export type StartSessionInputT = Static<typeof StartSessionInput>;

const STALE_MS = 24 * 60 * 60 * 1000;

export async function runStartSession(
  deps: { store: MemoryStore },
  input: StartSessionInputT,
): Promise<{ session_id: string }> {
  const cur = await deps.store.readSessions();
  const now = Date.now();
  const recent = [...cur.recent];
  if (cur.current) {
    const lu = Date.parse(cur.current.last_updated);
    if (now - lu > STALE_MS) {
      recent.unshift({ ...cur.current, status: "abandoned" });
    } else {
      // Active-within-24h session was already in `current`; caller chose to start anew, rotate it.
      recent.unshift({ ...cur.current, status: "abandoned" });
    }
  }
  const session_id = newSessionId();
  const nowIso = new Date(now).toISOString();
  await deps.store.writeSessions({
    current: {
      session_id,
      started_at: nowIso,
      last_updated: nowIso,
      status: "drafting",
      list_source: input.list_source,
      list_source_ref: input.list_source_ref,
      cart: [],
      flags: {},
    },
    recent: recent.slice(0, 10),
  });
  return { session_id };
}
