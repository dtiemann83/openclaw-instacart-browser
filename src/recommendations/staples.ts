import { normalizeItemKey, NORMALIZER_VERSION } from "./normalize.js";
import type { Cart, Staple } from "../memory/schemas.js";

export interface StaplesConfig {
  minOccurrences: number;
  windowSize: number;
  maxAgeDays?: number;
}

export interface DetectStaplesInput {
  carts: Cart[];
  config: StaplesConfig;
  now?: Date;
}

export interface DetectStaplesOutput {
  staples: Staple[];
  normalizer_version: string;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function detectStaples(input: DetectStaplesInput): DetectStaplesOutput {
  const { carts, config } = input;
  const now = input.now ?? new Date();
  const sorted = [...carts].sort((a, b) => a.built_at.localeCompare(b.built_at));
  let windowCarts = sorted.slice(-config.windowSize);
  if (config.maxAgeDays != null) {
    const cutoff = now.getTime() - config.maxAgeDays * 86_400_000;
    windowCarts = windowCarts.filter((c) => Date.parse(c.built_at) >= cutoff);
  }
  const byKey = new Map<string, {
    display_name: string; brand?: string; size?: string;
    qtys: number[]; lastSeenMs: number; count: number;
  }>();
  for (const c of windowCarts) {
    const seenInCart = new Set<string>();
    for (const it of c.items) {
      const key = normalizeItemKey(it.name, { brand: it.brand });
      if (!key) continue;
      if (seenInCart.has(key)) continue;
      seenInCart.add(key);
      const cur = byKey.get(key) ?? {
        display_name: it.name, brand: it.brand, size: it.size,
        qtys: [], lastSeenMs: 0, count: 0,
      };
      cur.qtys.push(it.qty);
      cur.count += 1;
      const ms = Date.parse(c.built_at);
      if (ms > cur.lastSeenMs) {
        cur.lastSeenMs = ms;
        cur.display_name = it.name;
        cur.brand = it.brand ?? cur.brand;
        cur.size = it.size ?? cur.size;
      }
      byKey.set(key, cur);
    }
  }
  const qualifying = [...byKey.entries()].filter(([, v]) => v.count >= config.minOccurrences);
  const lastSeens = qualifying.map(([, v]) => v.lastSeenMs);
  const minLs = lastSeens.length ? Math.min(...lastSeens) : 0;
  const maxLs = lastSeens.length ? Math.max(...lastSeens) : 0;
  const span = Math.max(1, maxLs - minLs);
  const staples: Staple[] = qualifying.map(([key, v]) => ({
    key,
    display_name: v.display_name,
    brand: v.brand,
    size: v.size,
    typical_qty: median(v.qtys),
    occurrences: v.count,
    last_seen: new Date(v.lastSeenMs).toISOString(),
    recency_rank: maxLs === minLs ? 1 : (v.lastSeenMs - minLs) / span,
  }));
  staples.sort((a, b) =>
    b.recency_rank - a.recency_rank ||
    b.occurrences - a.occurrences ||
    a.key.localeCompare(b.key),
  );
  return { staples, normalizer_version: NORMALIZER_VERSION };
}
