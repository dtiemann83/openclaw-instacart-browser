import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";

export const ReadMemoryInput = Type.Object({
  kind: Type.Union([
    Type.Literal("carts"),
    Type.Literal("staples"),
    Type.Literal("preferences"),
    Type.Literal("sessions"),
  ]),
});
export type ReadMemoryInputT = Static<typeof ReadMemoryInput>;

export async function runReadMemory(
  deps: { store: MemoryStore },
  input: ReadMemoryInputT,
): Promise<{ data: unknown }> {
  switch (input.kind) {
    case "carts":       return { data: await deps.store.readCarts() };
    case "staples":     return { data: await deps.store.readStaples() };
    case "preferences": return { data: await deps.store.readPreferences() };
    case "sessions":    return { data: await deps.store.readSessions() };
  }
}
