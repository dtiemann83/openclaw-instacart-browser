import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { recordOverride, promote } from "../preferences/evolve.js";

export const UpdatePreferenceInput = Type.Object({
  field: Type.Union([Type.Literal("brand"), Type.Literal("size"), Type.Literal("store")]),
  key: Type.String(),
  from: Type.Optional(Type.String()),
  to: Type.String(),
  reason: Type.Union([
    Type.Literal("pending"),
    Type.Literal("one_shot_confirm"),
    Type.Literal("manual"),
  ]),
});
export type UpdatePreferenceInputT = Static<typeof UpdatePreferenceInput>;

const PROMOTE_THRESHOLD = 2;

export async function runUpdatePreference(
  deps: { store: MemoryStore },
  input: UpdatePreferenceInputT,
): Promise<{ ok: true; promoted: boolean }> {
  const curFile = await deps.store.readPreferences();
  const cur = { prefs: curFile.preferences, overrides: curFile.overrides };
  const at = new Date().toISOString();
  if (input.reason === "pending") {
    const next = recordOverride(cur, {
      field: input.field, key: input.key,
      from: input.from ?? "", to: input.to,
      at, promoteThreshold: PROMOTE_THRESHOLD,
    });
    await deps.store.writePreferences({ preferences: next.prefs, overrides: next.overrides });
    return { ok: true, promoted: next.promoted };
  }
  const next = promote(cur, {
    field: input.field, key: input.key,
    from: input.from ?? "", to: input.to,
    at, reason: input.reason,
  });
  await deps.store.writePreferences({ preferences: next.prefs, overrides: next.overrides });
  return { ok: true, promoted: true };
}
