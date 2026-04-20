import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createMemoryStore } from "./index.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "icb-facade-"));
});

describe("MemoryStore", () => {
  it("returns empty defaults when dir is empty", async () => {
    const m = createMemoryStore({ dataDir: tmp });
    expect((await m.readCarts()).carts).toEqual([]);
    expect((await m.readSessions()).recent).toEqual([]);
    expect((await m.readPreferences()).preferences.brands).toEqual({});
    const staples = await m.readStaples();
    expect(staples.staples).toEqual([]);
  });

  it("round-trips carts", async () => {
    const m = createMemoryStore({ dataDir: tmp });
    await m.writeCarts({
      carts: [{
        cart_id: "local_x", built_at: "2026-04-20T00:00:00Z",
        store: "HT", fulfillment: { type: "delivery", window: "w1" }, items: [],
      }],
    });
    const back = await m.readCarts();
    expect(back.carts[0].cart_id).toBe("local_x");
  });

  it("appendCart pushes one cart and leaves others intact", async () => {
    const m = createMemoryStore({ dataDir: tmp });
    await m.appendCart({
      cart_id: "c1", built_at: "2026-04-20T00:00:00Z", store: "S",
      fulfillment: { type: "pickup", window: "w" }, items: [],
    });
    await m.appendCart({
      cart_id: "c2", built_at: "2026-04-20T00:00:01Z", store: "S",
      fulfillment: { type: "pickup", window: "w" }, items: [],
    });
    const back = await m.readCarts();
    expect(back.carts.map((c) => c.cart_id)).toEqual(["c1", "c2"]);
  });
});
