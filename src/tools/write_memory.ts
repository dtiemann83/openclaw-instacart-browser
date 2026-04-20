import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import {
  cartsFileSchema, staplesFileSchema, preferencesFileSchema, sessionsFileSchema,
} from "../memory/schemas.js";

export const WriteMemoryInput = Type.Object({
  kind: Type.Union([
    Type.Literal("carts"),
    Type.Literal("staples"),
    Type.Literal("preferences"),
    Type.Literal("sessions"),
  ]),
  data: Type.Unknown(),
  merge: Type.Optional(Type.Boolean()),
});
export type WriteMemoryInputT = Static<typeof WriteMemoryInput>;

export async function runWriteMemory(
  deps: { store: MemoryStore },
  input: WriteMemoryInputT,
): Promise<{ ok: true }> {
  switch (input.kind) {
    case "carts": {
      const parsed = cartsFileSchema.parse(input.data);
      await deps.store.writeCarts(parsed);
      return { ok: true };
    }
    case "staples": {
      const parsed = staplesFileSchema.parse(input.data);
      await deps.store.writeStaples(parsed);
      return { ok: true };
    }
    case "preferences": {
      const parsed = preferencesFileSchema.parse(input.data);
      if (input.merge) {
        const cur = await deps.store.readPreferences();
        await deps.store.writePreferences({
          preferences: { ...cur.preferences, ...parsed.preferences },
          overrides: { ...cur.overrides, ...parsed.overrides },
        });
      } else {
        await deps.store.writePreferences(parsed);
      }
      return { ok: true };
    }
    case "sessions": {
      const parsed = sessionsFileSchema.parse(input.data);
      await deps.store.writeSessions(parsed);
      return { ok: true };
    }
  }
}
