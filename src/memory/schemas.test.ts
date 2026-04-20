import { describe, it, expect } from "vitest";
import {
  cartsFileSchema,
  staplesFileSchema,
  preferencesFileSchema,
  sessionsFileSchema,
} from "./schemas.js";

describe("memory schemas", () => {
  it("parses empty defaults cleanly", () => {
    expect(() => cartsFileSchema.parse({ carts: [] })).not.toThrow();
    expect(() => staplesFileSchema.parse({
      staples: [], computed_at: "2026-04-20T00:00:00Z", normalizer_version: "1", config: {},
    })).not.toThrow();
    expect(() => preferencesFileSchema.parse({
      preferences: {
        brands: {}, sizes: {},
        stores: { preferred: [], avoid: [] },
        substitutions: { allow: true, ask_first: true },
        dietary: { restrictions: [], notes: "" },
        updated_at: "2026-04-20T00:00:00Z",
      },
      overrides: { pending: {}, history: [] },
    })).not.toThrow();
    expect(() => sessionsFileSchema.parse({ recent: [] })).not.toThrow();
  });

  it("requires Cart fields", () => {
    expect(() => cartsFileSchema.parse({ carts: [{ cart_id: "x" }] })).toThrow();
  });

  it("locks Session.status enum", () => {
    const s = sessionsFileSchema.parse({ recent: [] });
    expect(s.recent).toEqual([]);
    expect(() => sessionsFileSchema.parse({
      current: {
        session_id: "s1",
        started_at: "2026-04-20T00:00:00Z",
        last_updated: "2026-04-20T00:00:00Z",
        status: "bogus",
        list_source: "adhoc",
        cart: [],
        flags: {},
      },
      recent: [],
    })).toThrow();
  });

  it("locks overrides history reason enum", () => {
    expect(() => preferencesFileSchema.parse({
      preferences: {
        brands: {}, sizes: {},
        stores: { preferred: [], avoid: [] },
        substitutions: { allow: true, ask_first: true },
        dietary: { restrictions: [], notes: "" },
        updated_at: "2026-04-20T00:00:00Z",
      },
      overrides: {
        pending: {},
        history: [{ key: "milk", field: "brand", from: "a", to: "b", at: "now", reason: "pending" }],
      },
    })).toThrow();
  });
});
