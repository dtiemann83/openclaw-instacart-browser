import type { Preferences, PreferenceOverrides, HistoryEntry } from "../memory/schemas.js";

export type Field = "brand" | "size" | "store";

export interface OverrideInput {
  field: Field;
  key: string;
  from: string;
  to: string;
  at: string;
  promoteThreshold: number;
}

export interface PromoteInput {
  field: Field;
  key: string;
  from: string;
  to: string;
  at: string;
  reason: HistoryEntry["reason"];
}

export interface State {
  prefs: Preferences;
  overrides: PreferenceOverrides;
}

export interface RecordResult extends State {
  promoted: boolean;
}

export function recordOverride(s: State, inp: OverrideInput): RecordResult {
  const next: State = {
    prefs: structuredClone(s.prefs),
    overrides: structuredClone(s.overrides),
  };
  const list = next.overrides.pending[inp.key] ?? [];
  list.push({ suggested: inp.from, chosen: inp.to, at: inp.at });
  next.overrides.pending[inp.key] = list;

  // Streak check: tail-N all agree on same `chosen`.
  const tail = list.slice(-inp.promoteThreshold);
  const agree =
    tail.length >= inp.promoteThreshold &&
    tail.every((o) => o.chosen === inp.to);

  if (agree) {
    applyField(next.prefs, inp.field, inp.key, inp.to);
    next.overrides.history.push({
      key: inp.key, field: inp.field, from: inp.from, to: inp.to, at: inp.at,
      reason: "n_consistent_overrides",
    });
    next.overrides.pending[inp.key] = [];
    return { ...next, promoted: true };
  }

  return { ...next, promoted: false };
}

export function promote(s: State, inp: PromoteInput): State {
  const next: State = {
    prefs: structuredClone(s.prefs),
    overrides: structuredClone(s.overrides),
  };
  applyField(next.prefs, inp.field, inp.key, inp.to);
  next.overrides.history.push({
    key: inp.key, field: inp.field, from: inp.from, to: inp.to, at: inp.at,
    reason: inp.reason,
  });
  next.overrides.pending[inp.key] = [];
  return next;
}

function applyField(prefs: Preferences, field: Field, key: string, to: string): void {
  if (field === "brand") prefs.brands[key] = to;
  else if (field === "size") prefs.sizes[key] = to;
  else if (field === "store") {
    if (!prefs.stores.preferred.includes(to)) prefs.stores.preferred.push(to);
  }
  prefs.updated_at = new Date().toISOString();
}
