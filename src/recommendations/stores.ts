export interface StoreCandidate {
  id: string;
  name: string;
  distanceMi?: number;
  windows?: string[];
  carries?: string[];
}

export interface StoreWeights {
  proximity: number;
  history: number;
  listMatch: number;
  windowFit: number;
}

export const DEFAULT_WEIGHTS: StoreWeights = {
  proximity: 0.25, history: 0.35, listMatch: 0.30, windowFit: 0.10,
};

export interface RankInput {
  candidates: StoreCandidate[];
  list: string[];
  prefs: { preferred: string[]; avoid: string[] };
  historyCounts: Record<string, number>;
  weights: StoreWeights;
  windowAvailable?: boolean;
}

export interface Ranked extends StoreCandidate {
  score: number;
  rationale: string;
}

function listMatchRatio(list: string[], carries: string[] | undefined): number {
  if (!list.length || !carries) return 0.5;
  const have = new Set(carries.map((x) => x.toLowerCase()));
  const hits = list.filter((x) => have.has(x.toLowerCase())).length;
  return hits / list.length;
}

export function rankStores(input: RankInput): { ranked: Ranked[] } {
  const avoid = new Set(input.prefs.avoid);
  const preferred = new Set(input.prefs.preferred);
  const maxHistory = Math.max(1, ...Object.values(input.historyCounts));
  const maxDistance = Math.max(
    1,
    ...input.candidates.map((c) => c.distanceMi ?? 0),
  );

  const ranked: Ranked[] = input.candidates
    .filter((c) => !avoid.has(c.name) && !avoid.has(c.id))
    .map((c) => {
      const proximity = c.distanceMi == null ? 0.5 : 1 - c.distanceMi / maxDistance;
      const history = (input.historyCounts[c.name] ?? input.historyCounts[c.id] ?? 0) / maxHistory;
      const listMatch = listMatchRatio(input.list, c.carries);
      const windowFit = input.windowAvailable === false ? 0 : (c.windows?.length ? 1 : 0.5);
      const prefBoost = preferred.has(c.name) || preferred.has(c.id) ? 0.25 : 0;
      const score =
        input.weights.proximity * proximity +
        input.weights.history * history +
        input.weights.listMatch * listMatch +
        input.weights.windowFit * windowFit +
        prefBoost;
      const rationale = [
        c.distanceMi != null ? `dist=${c.distanceMi}mi` : null,
        history > 0 ? `history=${input.historyCounts[c.name] ?? input.historyCounts[c.id]}` : null,
        preferred.has(c.name) || preferred.has(c.id) ? "preferred" : null,
        c.windows?.length ? `windows=${c.windows.length}` : null,
      ].filter(Boolean).join(", ");
      return { ...c, score, rationale };
    });

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { ranked };
}
