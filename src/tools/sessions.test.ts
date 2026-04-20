import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createMemoryStore } from "../memory/index.js";
import { runStartSession } from "./start_session.js";
import { runUpdateSession } from "./update_session.js";
import { runEndSession } from "./end_session.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "icb-sess-"));
});

describe("session tools", () => {
  it("start creates current, update patches it, end rotates into recent", async () => {
    const store = createMemoryStore({ dataDir: tmp });
    const { session_id } = await runStartSession({ store }, { list_source: "adhoc" });
    expect(session_id).toMatch(/^sess_/);

    await runUpdateSession({ store }, { patch: { status: "drafting", store: { name: "HT" } } });
    let sess = (await store.readSessions()).current!;
    expect(sess.store?.name).toBe("HT");
    expect(sess.last_updated).not.toBe(sess.started_at);

    const end = await runEndSession({ store }, { status: "handed_off" });
    expect(end.ok).toBe(true);
    const after = await store.readSessions();
    expect(after.current).toBeUndefined();
    expect(after.recent[0].status).toBe("handed_off");
  });

  it("rotates stale current (>24h) on next start", async () => {
    const store = createMemoryStore({ dataDir: tmp });
    const stale = {
      session_id: "sess_old",
      started_at: "2026-01-01T00:00:00Z",
      last_updated: "2026-01-01T00:00:00Z",
      status: "drafting" as const,
      list_source: "adhoc" as const,
      cart: [],
      flags: {},
    };
    await store.writeSessions({ current: stale, recent: [] });
    await runStartSession({ store }, { list_source: "staples" });
    const after = await store.readSessions();
    expect(after.current?.session_id).not.toBe("sess_old");
    expect(after.recent.some((s) => s.session_id === "sess_old" && s.status === "abandoned")).toBe(true);
  });
});
