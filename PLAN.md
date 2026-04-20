# instacart-browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `instacart-browser` OpenClaw plugin — a skill + helper-tools plugin that lets the household chef build Instacart carts conversationally, stopping at the review screen so a human places the order.

**Architecture:** Standalone TypeScript plugin package matching the `imessage-photon` layout. Plugin entry uses `definePluginEntry` from `openclaw/plugin-sdk/plugin-entry` and registers ~11 agent-callable tools plus a shipped SKILL.md. All Instacart DOM interaction lives in SKILL.md + references/ (driven via the built-in `browser` tool); TypeScript owns memory I/O, ranking, preference evolution, login-code polling, and staples detection. Persistent JSON lives in a config-driven data dir (default `~/.openclaw/workspace/instacart-browser/`).

**Tech Stack:** Node ≥22, TypeScript (ESM, NodeNext), `openclaw` peer dep ^2026.4.14, `@sinclair/typebox` for tool input schemas, `zod` for persisted-JSON validation, `vitest` for tests. Ships SKILL.md via the plugin manifest's `skills` key.

---

## File Structure (created by this plan)

```
~/Desktop/Repos/instacart-browser/
├── openclaw.plugin.json        # manifest (id, requires, configSchema, skills: ["."])
├── package.json                # @dtiemann/openclaw-instacart-browser
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── index.ts                    # definePluginEntry — registers all tools
├── api.ts                      # local barrel re-exporting plugin-sdk surface used here
├── DESIGN.md                   # (already written)
├── PLAN.md                     # (this file)
├── README.md
├── SKILL.md                    # agent-facing
├── references/
│   ├── auth.md
│   ├── stores.md
│   ├── cart.md
│   ├── fulfillment.md
│   ├── review.md
│   └── troubleshooting.md
├── src/
│   ├── config.ts
│   ├── ids.ts                  # local_<uuid> helper
│   ├── memory/
│   │   ├── schemas.ts          # zod wrappers for all four files
│   │   ├── io.ts               # atomic read/write, corrupt quarantine
│   │   ├── index.ts            # MemoryStore facade
│   │   ├── carts.ts
│   │   ├── staples.ts
│   │   ├── preferences.ts
│   │   └── sessions.ts
│   ├── recommendations/
│   │   ├── normalize.ts        # versioned item-key normalizer
│   │   ├── staples.ts          # detect_staples impl
│   │   └── stores.ts           # rank_stores impl
│   ├── preferences/
│   │   └── evolve.ts
│   ├── listsource/
│   │   ├── types.ts
│   │   ├── adhoc.ts
│   │   ├── staples.ts
│   │   ├── repeat.ts
│   │   └── recipes.ts
│   ├── auth/
│   │   └── login-code.ts
│   ├── parsers/
│   │   └── cart-review.ts
│   └── tools/
│       ├── resolve_login_code.ts
│       ├── read_memory.ts
│       ├── write_memory.ts
│       ├── record_cart.ts
│       ├── rank_stores.ts
│       ├── detect_staples.ts
│       ├── update_preference.ts
│       ├── open_list_source.ts
│       ├── start_session.ts
│       ├── update_session.ts
│       └── end_session.ts
└── test/
    ├── fixtures/
    │   ├── carts.sample.json
    │   └── cart-review.html
    └── (each src module has a colocated *.test.ts under src/)
```

Tests live colocated next to the source they cover (e.g., `src/memory/io.test.ts`), which matches the OpenClaw convention and lets `vitest.config.ts` keep a single `include: ["src/**/*.test.ts"]`. The `test/` directory is used only for shared fixtures.

---

## Task 1: Scaffold the plugin package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `openclaw.plugin.json`
- Create: `api.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@dtiemann/openclaw-instacart-browser",
  "version": "0.1.0",
  "description": "OpenClaw plugin that builds Instacart carts conversationally and stops at the review screen.",
  "private": true,
  "type": "module",
  "main": "index.ts",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@sinclair/typebox": "^0.33.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "openclaw": "^2026.4.14",
    "typescript": "^5.6.0",
    "vitest": "^2.1.9",
    "@types/node": "^22.0.0"
  },
  "peerDependencies": {
    "openclaw": "*"
  },
  "peerDependenciesMeta": {
    "openclaw": { "optional": true }
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["index.ts", "api.ts", "src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/tools/*.ts"],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70
      }
    }
  }
});
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
coverage/
.DS_Store
*.log
```

- [ ] **Step 5: Write `openclaw.plugin.json`**

```json
{
  "id": "instacart-browser",
  "name": "Instacart Browser",
  "description": "Build Instacart carts conversationally; stops at review — humans place orders.",
  "version": "0.1.0",
  "entry": "index.ts",
  "skills": ["."],
  "requires": {
    "skills": ["resend"],
    "tools": ["browser"]
  },
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "dataDir": {
        "type": "string",
        "description": "Where to store carts/staples/preferences/sessions JSON.",
        "default": "~/.openclaw/workspace/instacart-browser"
      },
      "profile": {
        "type": "string",
        "description": "Browser profile to attach to.",
        "default": "openclaw"
      },
      "loginEmail": {
        "type": "string",
        "description": "Instacart account email (passwordless)."
      },
      "auth": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "senderPattern":  { "type": "string", "default": ".*@instacart\\.com$" },
          "codeRegex":      { "type": "string", "default": "\\b(\\d{6})\\b" },
          "timeoutMs":      { "type": "number", "default": 120000 },
          "pollIntervalMs": { "type": "number", "default": 3000 }
        }
      },
      "staples": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "minOccurrences": { "type": "number", "default": 3 },
          "windowSize":     { "type": "number", "default": 5 },
          "maxAgeDays":     { "type": "number" }
        }
      },
      "ranking": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "proximity": { "type": "number", "default": 0.25 },
          "history":   { "type": "number", "default": 0.35 },
          "listMatch": { "type": "number", "default": 0.30 },
          "windowFit": { "type": "number", "default": 0.10 }
        }
      }
    }
  }
}
```

- [ ] **Step 6: Write `api.ts`** (local barrel — keep imports pointed at this instead of reaching into host internals)

```ts
export { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
export type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
export { Type } from "@sinclair/typebox";
export type { Static, TSchema } from "@sinclair/typebox";
```

- [ ] **Step 7: Install and verify**

Run: `cd ~/Desktop/Repos/instacart-browser && npm install && npm run typecheck`
Expected: install succeeds; typecheck passes (no source files yet, so zero errors).

- [ ] **Step 8: Git init + first commit**

```bash
cd ~/Desktop/Repos/instacart-browser
git init
git add package.json tsconfig.json vitest.config.ts .gitignore openclaw.plugin.json api.ts DESIGN.md PLAN.md
git commit -m "scaffold: package skeleton, tsconfig, vitest, manifest, api barrel"
```

---

## Task 2: Config loader

**Files:**
- Create: `src/config.ts`
- Create: `src/config.test.ts`

- [ ] **Step 1: Write the failing test (`src/config.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { loadConfig, DEFAULT_CONFIG } from "./config.js";

describe("loadConfig", () => {
  it("returns defaults for empty input", () => {
    const cfg = loadConfig({});
    expect(cfg.profile).toBe("openclaw");
    expect(cfg.loginEmail).toBeUndefined();
    expect(cfg.staples.minOccurrences).toBe(3);
    expect(cfg.staples.windowSize).toBe(5);
    expect(cfg.ranking.proximity).toBe(0.25);
    expect(cfg.auth.senderPattern).toBe(".*@instacart\\.com$");
  });

  it("expands ~ in dataDir", () => {
    const cfg = loadConfig({ dataDir: "~/some/where" });
    expect(cfg.dataDir).toBe(path.join(os.homedir(), "some/where"));
  });

  it("merges user overrides without dropping defaults", () => {
    const cfg = loadConfig({ staples: { minOccurrences: 5 } });
    expect(cfg.staples.minOccurrences).toBe(5);
    expect(cfg.staples.windowSize).toBe(5);
  });

  it("rejects unknown top-level keys", () => {
    expect(() => loadConfig({ bogus: 1 } as any)).toThrow(/unknown/i);
  });

  it("defaults maxAgeDays to undefined", () => {
    expect(DEFAULT_CONFIG.staples.maxAgeDays).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config.ts`**

```ts
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const authSchema = z.object({
  senderPattern: z.string().default(".*@instacart\\.com$"),
  codeRegex: z.string().default("\\b(\\d{6})\\b"),
  timeoutMs: z.number().default(120_000),
  pollIntervalMs: z.number().default(3_000),
}).strict();

const staplesSchema = z.object({
  minOccurrences: z.number().int().positive().default(3),
  windowSize: z.number().int().positive().default(5),
  maxAgeDays: z.number().int().positive().optional(),
}).strict();

const rankingSchema = z.object({
  proximity: z.number().default(0.25),
  history: z.number().default(0.35),
  listMatch: z.number().default(0.30),
  windowFit: z.number().default(0.10),
}).strict();

const configSchema = z.object({
  dataDir: z.string().default("~/.openclaw/workspace/instacart-browser"),
  profile: z.string().default("openclaw"),
  loginEmail: z.string().optional(),
  auth: authSchema.default({}),
  staples: staplesSchema.default({}),
  ranking: rankingSchema.default({}),
}).strict();

export type InstacartConfig = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: InstacartConfig = configSchema.parse({});

function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function loadConfig(raw: unknown): InstacartConfig {
  const parsed = configSchema.parse(raw ?? {});
  return { ...parsed, dataDir: expandHome(parsed.dataDir) };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/config.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "config: zod-validated loader with ~ expansion and strict keys"
```

---

## Task 3: Atomic memory I/O

**Files:**
- Create: `src/memory/io.ts`
- Create: `src/memory/io.test.ts`

- [ ] **Step 1: Write the failing test (`src/memory/io.test.ts`)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { readJson, writeJson } from "./io.js";

const fileSchema = z.object({ n: z.number() });
type FileShape = z.infer<typeof fileSchema>;

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "icb-io-"));
});

describe("io.readJson / writeJson", () => {
  it("round-trips", async () => {
    const p = path.join(tmp, "f.json");
    await writeJson<FileShape>(p, { n: 1 }, fileSchema);
    const back = await readJson<FileShape>(p, fileSchema, () => ({ n: 0 }));
    expect(back.n).toBe(1);
  });

  it("returns default if file missing", async () => {
    const p = path.join(tmp, "missing.json");
    const back = await readJson<FileShape>(p, fileSchema, () => ({ n: 0 }));
    expect(back.n).toBe(0);
  });

  it("quarantines corrupt files and returns default", async () => {
    const p = path.join(tmp, "bad.json");
    await fs.writeFile(p, "{not json");
    const back = await readJson<FileShape>(p, fileSchema, () => ({ n: 42 }));
    expect(back.n).toBe(42);
    const entries = await fs.readdir(tmp);
    expect(entries.some((e) => e.includes(".corrupt."))).toBe(true);
  });

  it("quarantines schema-failing files and returns default", async () => {
    const p = path.join(tmp, "shape.json");
    await fs.writeFile(p, JSON.stringify({ n: "not a number" }));
    const back = await readJson<FileShape>(p, fileSchema, () => ({ n: 7 }));
    expect(back.n).toBe(7);
    const entries = await fs.readdir(tmp);
    expect(entries.some((e) => e.includes(".corrupt."))).toBe(true);
  });

  it("creates parent dir with 0700 perms", async () => {
    const p = path.join(tmp, "nested/deep/f.json");
    await writeJson<FileShape>(p, { n: 9 }, fileSchema);
    const stat = await fs.stat(path.dirname(p));
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it("writes atomically via temp + rename", async () => {
    const p = path.join(tmp, "atomic.json");
    await writeJson<FileShape>(p, { n: 1 }, fileSchema);
    const before = await fs.readdir(tmp);
    await writeJson<FileShape>(p, { n: 2 }, fileSchema);
    const after = await fs.readdir(tmp);
    const tempsBefore = before.filter((e) => e.endsWith(".tmp"));
    const tempsAfter = after.filter((e) => e.endsWith(".tmp"));
    expect(tempsBefore.length).toBe(0);
    expect(tempsAfter.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/memory/io.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/memory/io.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try { await fs.chmod(dir, 0o700); } catch { /* best-effort on non-posix */ }
}

export async function readJson<T>(
  filePath: string,
  schema: ZodType<T>,
  makeDefault: () => T,
): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return makeDefault();
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await quarantine(filePath);
    return makeDefault();
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    await quarantine(filePath);
    return makeDefault();
  }
  return result.data;
}

export async function writeJson<T>(
  filePath: string,
  value: T,
  schema: ZodType<T>,
): Promise<void> {
  const validated = schema.parse(value);
  await ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(validated, null, 2), { mode: 0o600 });
  await fs.rename(tmpPath, filePath);
}

async function quarantine(filePath: string): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${filePath}.corrupt.${stamp}.json`;
  try { await fs.rename(filePath, dest); } catch { /* best-effort */ }
  // Intentional: caller falls back to default. No throw.
  // eslint-disable-next-line no-console
  console.error(`[instacart-browser] quarantined ${filePath} -> ${dest}`);
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/memory/io.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/memory/io.ts src/memory/io.test.ts
git commit -m "memory: atomic read/write with schema validation and corrupt quarantine"
```

---

## Task 4: Memory schemas (zod wrappers for all four files)

**Files:**
- Create: `src/memory/schemas.ts`
- Create: `src/memory/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/memory/schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/memory/schemas.ts`**

```ts
import { z } from "zod";

export const cartItemSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  size: z.string().optional(),
  qty: z.number(),
  unit: z.string().optional(),
  price: z.number(),
  substituted_from: z.string().optional(),
  category: z.string().optional(),
}).strict();

export const cartSchema = z.object({
  cart_id: z.string(),
  built_at: z.string(),
  store: z.string(),
  store_id: z.string().optional(),
  fulfillment: z.object({
    type: z.enum(["delivery", "pickup"]),
    window: z.string(),
    window_start: z.string().optional(),
    window_end: z.string().optional(),
    address: z.string().optional(),
  }).strict(),
  items: z.array(cartItemSchema),
  subtotal: z.number().optional(),
  fees: z.number().optional(),
  tip: z.number().optional(),
  total: z.number().optional(),
  notes: z.string().optional(),
}).strict();

export const cartsFileSchema = z.object({ carts: z.array(cartSchema) }).strict();

export const stapleSchema = z.object({
  key: z.string(),
  display_name: z.string(),
  brand: z.string().optional(),
  size: z.string().optional(),
  typical_qty: z.number(),
  occurrences: z.number(),
  last_seen: z.string(),
  recency_rank: z.number(),
}).strict();

export const staplesFileSchema = z.object({
  staples: z.array(stapleSchema),
  computed_at: z.string(),
  normalizer_version: z.string(),
  config: z.object({
    minOccurrences: z.number().optional(),
    windowSize: z.number().optional(),
    maxAgeDays: z.number().optional(),
  }).strict(),
}).strict();

export const preferencesSchema = z.object({
  brands: z.record(z.string()),
  sizes: z.record(z.string()),
  stores: z.object({
    preferred: z.array(z.string()),
    avoid: z.array(z.string()),
  }).strict(),
  substitutions: z.object({
    allow: z.boolean(),
    ask_first: z.boolean(),
  }).strict(),
  dietary: z.object({
    restrictions: z.array(z.string()),
    notes: z.string(),
  }).strict(),
  updated_at: z.string(),
}).strict();

export const pendingOverrideSchema = z.object({
  suggested: z.string(),
  chosen: z.string(),
  at: z.string(),
}).strict();

export const historyEntrySchema = z.object({
  key: z.string(),
  field: z.enum(["brand", "size", "store"]),
  from: z.string(),
  to: z.string(),
  at: z.string(),
  reason: z.enum(["one_shot_confirm", "n_consistent_overrides", "manual"]),
}).strict();

export const preferenceOverridesSchema = z.object({
  pending: z.record(z.array(pendingOverrideSchema)),
  history: z.array(historyEntrySchema),
}).strict();

export const preferencesFileSchema = z.object({
  preferences: preferencesSchema,
  overrides: preferenceOverridesSchema,
}).strict();

export const substitutionFlagSchema = z.object({
  original: z.string(),
  offered: z.string(),
  accepted: z.boolean().optional(),
  decided_at: z.string().optional(),
}).strict();

export const sessionSchema = z.object({
  session_id: z.string(),
  started_at: z.string(),
  last_updated: z.string(),
  status: z.enum(["drafting", "reviewing", "handed_off", "abandoned"]),
  list_source: z.enum(["adhoc", "staples", "repeat", "recipes"]),
  list_source_ref: z.string().optional(),
  store: z.object({
    id: z.string().optional(),
    name: z.string(),
  }).strict().optional(),
  fulfillment: z.object({
    type: z.enum(["delivery", "pickup"]).optional(),
    window: z.string().optional(),
    window_start: z.string().optional(),
    window_end: z.string().optional(),
    address: z.string().optional(),
  }).strict().optional(),
  cart: z.array(cartItemSchema),
  flags: z.object({
    substitutions: z.array(substitutionFlagSchema).optional(),
    oos: z.array(z.string()).optional(),
  }).strict(),
  resume_hint: z.string().optional(),
}).strict();

export const sessionsFileSchema = z.object({
  current: sessionSchema.optional(),
  recent: z.array(sessionSchema),
}).strict();

export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Staple = z.infer<typeof stapleSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferenceOverrides = z.infer<typeof preferenceOverridesSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SubstitutionFlag = z.infer<typeof substitutionFlagSchema>;
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/memory/schemas.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/memory/schemas.ts src/memory/schemas.test.ts
git commit -m "memory: zod schemas for carts, staples, preferences, sessions"
```

---

## Task 5: MemoryStore facade

**Files:**
- Create: `src/memory/index.ts`
- Create: `src/memory/facade.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/memory/facade.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/memory/index.ts`**

```ts
import path from "node:path";
import { readJson, writeJson } from "./io.js";
import {
  cartsFileSchema, staplesFileSchema, preferencesFileSchema, sessionsFileSchema,
  type Cart,
} from "./schemas.js";
import type { z } from "zod";

type CartsFile = z.infer<typeof cartsFileSchema>;
type StaplesFile = z.infer<typeof staplesFileSchema>;
type PreferencesFile = z.infer<typeof preferencesFileSchema>;
type SessionsFile = z.infer<typeof sessionsFileSchema>;

const FILES = {
  carts: "carts.json",
  staples: "staples.json",
  preferences: "preferences.json",
  sessions: "sessions.json",
} as const;

function defaultCarts(): CartsFile { return { carts: [] }; }
function defaultStaples(): StaplesFile {
  return { staples: [], computed_at: new Date(0).toISOString(), normalizer_version: "0", config: {} };
}
function defaultPreferences(): PreferencesFile {
  return {
    preferences: {
      brands: {}, sizes: {},
      stores: { preferred: [], avoid: [] },
      substitutions: { allow: true, ask_first: true },
      dietary: { restrictions: [], notes: "" },
      updated_at: new Date(0).toISOString(),
    },
    overrides: { pending: {}, history: [] },
  };
}
function defaultSessions(): SessionsFile { return { recent: [] }; }

export interface MemoryStore {
  readCarts(): Promise<CartsFile>;
  writeCarts(v: CartsFile): Promise<void>;
  appendCart(c: Cart): Promise<void>;
  readStaples(): Promise<StaplesFile>;
  writeStaples(v: StaplesFile): Promise<void>;
  readPreferences(): Promise<PreferencesFile>;
  writePreferences(v: PreferencesFile): Promise<void>;
  readSessions(): Promise<SessionsFile>;
  writeSessions(v: SessionsFile): Promise<void>;
}

export function createMemoryStore(opts: { dataDir: string }): MemoryStore {
  const p = (k: keyof typeof FILES) => path.join(opts.dataDir, FILES[k]);
  return {
    readCarts:  () => readJson(p("carts"),  cartsFileSchema,  defaultCarts),
    writeCarts: (v) => writeJson(p("carts"),  v, cartsFileSchema),
    async appendCart(c) {
      const cur = await readJson(p("carts"), cartsFileSchema, defaultCarts);
      cur.carts.push(c);
      await writeJson(p("carts"), cur, cartsFileSchema);
    },
    readStaples:  () => readJson(p("staples"),  staplesFileSchema,  defaultStaples),
    writeStaples: (v) => writeJson(p("staples"),  v, staplesFileSchema),
    readPreferences:  () => readJson(p("preferences"),  preferencesFileSchema,  defaultPreferences),
    writePreferences: (v) => writeJson(p("preferences"),  v, preferencesFileSchema),
    readSessions:  () => readJson(p("sessions"),  sessionsFileSchema,  defaultSessions),
    writeSessions: (v) => writeJson(p("sessions"),  v, sessionsFileSchema),
  };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/memory/facade.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/memory/index.ts src/memory/facade.test.ts
git commit -m "memory: MemoryStore facade with per-file read/write + appendCart"
```

---

## Task 6: ID helper

**Files:**
- Create: `src/ids.ts`
- Create: `src/ids.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { newCartId, newSessionId } from "./ids.js";

describe("ids", () => {
  it("newCartId has local_ prefix and is unique", () => {
    const a = newCartId();
    const b = newCartId();
    expect(a.startsWith("local_")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("newSessionId has sess_ prefix", () => {
    expect(newSessionId().startsWith("sess_")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/ids.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ids.ts`**

```ts
import { randomUUID } from "node:crypto";
export function newCartId(): string { return `local_${randomUUID()}`; }
export function newSessionId(): string { return `sess_${randomUUID()}`; }
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/ids.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/ids.ts src/ids.test.ts
git commit -m "ids: local_ / sess_ UUID helpers"
```

---

## Task 7: Item-key normalizer (versioned)

**Files:**
- Create: `src/recommendations/normalize.ts`
- Create: `src/recommendations/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeItemKey, NORMALIZER_VERSION } from "./normalize.js";

describe("normalizeItemKey", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeItemKey("Whole Milk!!")).toBe("whole milk");
    expect(normalizeItemKey("  Bananas  ")).toBe("bananas");
  });

  it("collapses whitespace", () => {
    expect(normalizeItemKey("Organic   Milk")).toBe("organic milk");
  });

  it("strips brand prefix when similar items recorded under it", () => {
    expect(normalizeItemKey("Horizon Organic Whole Milk", { brand: "Horizon Organic" }))
      .toBe("whole milk");
  });

  it("strips size suffix", () => {
    expect(normalizeItemKey("Milk 1 gal")).toBe("milk");
    expect(normalizeItemKey("Bread 20 oz")).toBe("bread");
    expect(normalizeItemKey("Yogurt 32-oz")).toBe("yogurt");
  });

  it("exposes a version string", () => {
    expect(typeof NORMALIZER_VERSION).toBe("string");
    expect(NORMALIZER_VERSION.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/recommendations/normalize.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/recommendations/normalize.ts`**

```ts
export const NORMALIZER_VERSION = "1";

const SIZE_RE = /\b\d+(\.\d+)?\s*[-]?\s*(oz|lb|lbs|g|kg|ml|l|gal|gallon|ct|pack|pk)\b/i;
const PUNCT_RE = /[^\w\s-]+/g;
const WS_RE = /\s+/g;

export function normalizeItemKey(name: string, opts?: { brand?: string }): string {
  let s = name;
  if (opts?.brand) {
    const b = opts.brand.toLowerCase();
    if (s.toLowerCase().startsWith(b)) s = s.slice(opts.brand.length);
  }
  s = s.toLowerCase();
  s = s.replace(SIZE_RE, " ");
  s = s.replace(PUNCT_RE, " ");
  s = s.replace(WS_RE, " ").trim();
  return s;
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/recommendations/normalize.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/recommendations/normalize.ts src/recommendations/normalize.test.ts
git commit -m "recommendations: versioned item-key normalizer"
```

---

## Task 8: Staples detector

**Files:**
- Create: `src/recommendations/staples.ts`
- Create: `src/recommendations/staples.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { detectStaples } from "./staples.js";
import type { Cart } from "../memory/schemas.js";

function cart(builtAt: string, items: Array<{ name: string; qty?: number; brand?: string; size?: string }>): Cart {
  return {
    cart_id: `local_${builtAt}`,
    built_at: builtAt,
    store: "HT",
    fulfillment: { type: "delivery", window: "w" },
    items: items.map((i) => ({ name: i.name, qty: i.qty ?? 1, price: 1, brand: i.brand, size: i.size })),
  };
}

describe("detectStaples", () => {
  it("needs minOccurrences within windowSize", () => {
    const carts: Cart[] = [
      cart("2026-04-10T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-14T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-16T00:00:00Z", [{ name: "Eggs" }]),
      cart("2026-04-18T00:00:00Z", [{ name: "Eggs" }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 5 } });
    expect(res.staples.map((s) => s.key)).toContain("milk");
    expect(res.staples.map((s) => s.key)).not.toContain("eggs");
  });

  it("limits to the most recent windowSize carts", () => {
    const carts: Cart[] = [
      cart("2026-04-01T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-02T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-03T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-10T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-11T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Bread" }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 3 } });
    expect(res.staples.map((s) => s.key)).toEqual(["bread"]);
  });

  it("respects maxAgeDays if set", () => {
    const now = new Date("2026-04-20T00:00:00Z");
    const carts: Cart[] = [
      cart("2026-01-01T00:00:00Z", [{ name: "Old" }]),
      cart("2026-01-02T00:00:00Z", [{ name: "Old" }]),
      cart("2026-01-03T00:00:00Z", [{ name: "Old" }]),
    ];
    const res = detectStaples({
      carts,
      config: { minOccurrences: 3, windowSize: 5, maxAgeDays: 30 },
      now,
    });
    expect(res.staples).toEqual([]);
  });

  it("computes recency_rank as 0..1 with most-recent highest", () => {
    const carts: Cart[] = [
      cart("2026-04-10T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-20T00:00:00Z", [{ name: "Milk" }]),
      cart("2026-04-10T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Bread" }]),
      cart("2026-04-14T00:00:00Z", [{ name: "Bread" }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 10 } });
    const milk = res.staples.find((s) => s.key === "milk")!;
    const bread = res.staples.find((s) => s.key === "bread")!;
    expect(milk.recency_rank).toBeGreaterThan(bread.recency_rank);
    expect(milk.recency_rank).toBeLessThanOrEqual(1);
    expect(bread.recency_rank).toBeGreaterThanOrEqual(0);
  });

  it("uses median qty as typical_qty", () => {
    const carts: Cart[] = [
      cart("2026-04-10T00:00:00Z", [{ name: "Bananas", qty: 2 }]),
      cart("2026-04-12T00:00:00Z", [{ name: "Bananas", qty: 5 }]),
      cart("2026-04-14T00:00:00Z", [{ name: "Bananas", qty: 3 }]),
    ];
    const res = detectStaples({ carts, config: { minOccurrences: 3, windowSize: 5 } });
    expect(res.staples[0].typical_qty).toBe(3);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/recommendations/staples.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/recommendations/staples.ts`**

```ts
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
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/recommendations/staples.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/recommendations/staples.ts src/recommendations/staples.test.ts
git commit -m "recommendations: staples detector with window + maxAge + recency rank"
```

---

## Task 9: Store ranker

**Files:**
- Create: `src/recommendations/stores.ts`
- Create: `src/recommendations/stores.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { rankStores, DEFAULT_WEIGHTS } from "./stores.js";

describe("rankStores", () => {
  it("uses weights from config", () => {
    const { ranked } = rankStores({
      candidates: [
        { id: "a", name: "A", distanceMi: 1, windows: ["w1"], carries: ["milk"] },
        { id: "b", name: "B", distanceMi: 5, windows: ["w1"], carries: ["milk"] },
      ],
      list: ["milk"],
      prefs: { preferred: [], avoid: [] },
      historyCounts: {},
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked[0].id).toBe("a");
  });

  it("removes avoid list", () => {
    const { ranked } = rankStores({
      candidates: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      list: [],
      prefs: { preferred: [], avoid: ["A"] },
      historyCounts: {},
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked.map((r) => r.id)).toEqual(["b"]);
  });

  it("boosts preferred stores", () => {
    const { ranked } = rankStores({
      candidates: [
        { id: "a", name: "A", distanceMi: 5 },
        { id: "b", name: "B", distanceMi: 1 },
      ],
      list: [],
      prefs: { preferred: ["A"], avoid: [] },
      historyCounts: {},
      weights: { ...DEFAULT_WEIGHTS, proximity: 0.1, history: 0.1, listMatch: 0.1, windowFit: 0.1 },
    });
    expect(ranked[0].id).toBe("a");
  });

  it("returns rationale per store", () => {
    const { ranked } = rankStores({
      candidates: [{ id: "a", name: "A", distanceMi: 2 }],
      list: [],
      prefs: { preferred: [], avoid: [] },
      historyCounts: { A: 4 },
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked[0].rationale).toBeTruthy();
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("empty history fallback is stable", () => {
    const { ranked } = rankStores({
      candidates: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      list: [],
      prefs: { preferred: [], avoid: [] },
      historyCounts: {},
      weights: DEFAULT_WEIGHTS,
    });
    expect(ranked.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/recommendations/stores.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/recommendations/stores.ts`**

```ts
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
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/recommendations/stores.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/recommendations/stores.ts src/recommendations/stores.test.ts
git commit -m "recommendations: store ranker with weighted scoring and rationale"
```

---

## Task 10: Preference evolution

**Files:**
- Create: `src/preferences/evolve.ts`
- Create: `src/preferences/evolve.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { recordOverride, promote } from "./evolve.js";
import type { Preferences, PreferenceOverrides } from "../memory/schemas.js";

function fresh(): { prefs: Preferences; overrides: PreferenceOverrides } {
  return {
    prefs: {
      brands: {}, sizes: {},
      stores: { preferred: [], avoid: [] },
      substitutions: { allow: true, ask_first: true },
      dietary: { restrictions: [], notes: "" },
      updated_at: "2026-04-20T00:00:00Z",
    },
    overrides: { pending: {}, history: [] },
  };
}

describe("recordOverride", () => {
  it("appends to pending[] without promoting", () => {
    const s = fresh();
    const out = recordOverride(s, {
      field: "brand", key: "milk", from: "A", to: "B",
      at: "2026-04-20T00:00:00Z", promoteThreshold: 2,
    });
    expect(out.promoted).toBe(false);
    expect(out.overrides.pending.milk.length).toBe(1);
    expect(out.prefs.brands.milk).toBeUndefined();
  });

  it("promotes after N consecutive identical overrides", () => {
    let s = fresh();
    const one = recordOverride(s, { field: "brand", key: "milk", from: "A", to: "B", at: "2026-04-20T00:00:00Z", promoteThreshold: 2 });
    const two = recordOverride(one, { field: "brand", key: "milk", from: "A", to: "B", at: "2026-04-21T00:00:00Z", promoteThreshold: 2 });
    expect(two.promoted).toBe(true);
    expect(two.prefs.brands.milk).toBe("B");
    expect(two.overrides.pending.milk ?? []).toEqual([]);
    expect(two.overrides.history.at(-1)?.reason).toBe("n_consistent_overrides");
  });

  it("resets streak if chosen differs", () => {
    const s0 = fresh();
    const step1 = recordOverride(s0, {
      field: "brand", key: "milk", from: "A", to: "B", at: "t1", promoteThreshold: 2,
    });
    const step2 = recordOverride(
      { prefs: step1.prefs, overrides: step1.overrides },
      { field: "brand", key: "milk", from: "A", to: "C", at: "t2", promoteThreshold: 2 },
    );
    expect(step2.promoted).toBe(false);
    expect(step2.overrides.pending.milk.length).toBe(2);
    expect(step2.overrides.history.filter((h) => h.key === "milk").length).toBe(0);
  });
});

describe("promote", () => {
  it("one_shot_confirm writes to prefs and history", () => {
    const s = fresh();
    const out = promote(s, { field: "brand", key: "milk", from: "A", to: "B", at: "2026-04-20T00:00:00Z", reason: "one_shot_confirm" });
    expect(out.prefs.brands.milk).toBe("B");
    expect(out.overrides.history.at(-1)?.reason).toBe("one_shot_confirm");
  });

  it("manual promotion also writes history", () => {
    const s = fresh();
    const out = promote(s, { field: "brand", key: "milk", from: "", to: "B", at: "2026-04-20T00:00:00Z", reason: "manual" });
    expect(out.prefs.brands.milk).toBe("B");
    expect(out.overrides.history.at(-1)?.reason).toBe("manual");
  });

  it("handles store field by updating stores.preferred", () => {
    const s = fresh();
    const out = promote(s, { field: "store", key: "HT", from: "", to: "HT", at: "t", reason: "manual" });
    expect(out.prefs.stores.preferred).toContain("HT");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/preferences/evolve.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/preferences/evolve.ts`**

```ts
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
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/preferences/evolve.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/preferences/evolve.ts src/preferences/evolve.test.ts
git commit -m "preferences: override recording with N-consistent auto-promote + explicit promote"
```

---

## Task 11: Login-code resolver

**Files:**
- Create: `src/auth/login-code.ts`
- Create: `src/auth/login-code.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveLoginCode } from "./login-code.js";

type InboundMsg = { id: string; from: string; receivedAt: string; text: string };

function mockResend(messages: InboundMsg[]) {
  return {
    list: vi.fn(async () => messages.map((m) => ({ id: m.id, from: m.from, receivedAt: m.receivedAt }))),
    get: vi.fn(async (id: string) => {
      const m = messages.find((x) => x.id === id)!;
      return { id: m.id, from: m.from, receivedAt: m.receivedAt, text: m.text };
    }),
  };
}

describe("resolveLoginCode", () => {
  it("extracts 6-digit code matching senderPattern after requested_after", async () => {
    const resend = mockResend([
      { id: "m1", from: "auth@instacart.com", receivedAt: "2026-04-20T00:00:05Z", text: "Your code is 123456." },
    ]);
    const res = await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 1000,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    expect(res).toEqual({ ok: true, code: "123456", received_at: "2026-04-20T00:00:05Z" });
  });

  it("ignores mail from before requested_after", async () => {
    const resend = mockResend([
      { id: "m1", from: "auth@instacart.com", receivedAt: "2026-04-19T00:00:00Z", text: "Code 999999" },
    ]);
    const res = await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 100,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("timeout");
  });

  it("ignores mail from wrong sender", async () => {
    const resend = mockResend([
      { id: "m1", from: "spam@nope.com", receivedAt: "2026-04-20T00:00:05Z", text: "Code 123456" },
    ]);
    const res = await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 100,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    expect(res.ok).toBe(false);
  });

  it("never logs the code", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const resend = mockResend([
      { id: "m1", from: "auth@instacart.com", receivedAt: "2026-04-20T00:00:05Z", text: "Your code is 777777." },
    ]);
    await resolveLoginCode({
      resend,
      requestedAfter: "2026-04-20T00:00:00Z",
      senderPattern: ".*@instacart\\.com$",
      codeRegex: "\\b(\\d{6})\\b",
      timeoutMs: 1000,
      pollIntervalMs: 10,
      now: () => Date.now(),
    });
    for (const call of [...spy.mock.calls, ...errSpy.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain("777777");
    }
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/auth/login-code.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/auth/login-code.ts`**

```ts
export interface ResendInboundSummary {
  id: string;
  from: string;
  receivedAt: string;
}
export interface ResendInboundFull extends ResendInboundSummary {
  text: string;
}
export interface ResendClient {
  list: () => Promise<ResendInboundSummary[]>;
  get: (id: string) => Promise<ResendInboundFull>;
}

export interface ResolveInput {
  resend: ResendClient;
  requestedAfter: string;        // ISO
  senderPattern: string;         // regex
  codeRegex: string;             // regex with first capture = code
  timeoutMs: number;
  pollIntervalMs: number;
  now?: () => number;
}

export type ResolveResult =
  | { ok: true;  code: string;  received_at: string }
  | { ok: false; error: "timeout" | "not_found" };

export async function resolveLoginCode(input: ResolveInput): Promise<ResolveResult> {
  const now = input.now ?? (() => Date.now());
  const deadline = now() + input.timeoutMs;
  const senderRe = new RegExp(input.senderPattern);
  const codeRe = new RegExp(input.codeRegex);
  const afterMs = Date.parse(input.requestedAfter);
  const seen = new Set<string>();

  while (now() < deadline) {
    const list = await input.resend.list();
    const candidates = list
      .filter((m) => !seen.has(m.id))
      .filter((m) => Date.parse(m.receivedAt) >= afterMs)
      .filter((m) => senderRe.test(m.from));

    for (const summary of candidates) {
      seen.add(summary.id);
      const full = await input.resend.get(summary.id);
      const match = full.text.match(codeRe);
      if (match && match[1]) {
        return { ok: true, code: match[1], received_at: full.receivedAt };
      }
    }

    await sleep(input.pollIntervalMs);
  }
  return { ok: false, error: "timeout" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/auth/login-code.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/auth/login-code.ts src/auth/login-code.test.ts
git commit -m "auth: resend-mock-based login-code resolver with requested_after filter"
```

---

## Task 12: List-source interface + adhoc / staples / repeat / recipes

**Files:**
- Create: `src/listsource/types.ts`
- Create: `src/listsource/adhoc.ts`
- Create: `src/listsource/staples.ts`
- Create: `src/listsource/repeat.ts`
- Create: `src/listsource/recipes.ts`
- Create: `src/listsource/listsource.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import type { Preferences } from "../memory/schemas.js";
import { openAdhoc } from "./adhoc.js";
import { openStaples } from "./staples.js";
import { openRepeat } from "./repeat.js";
import { openRecipes } from "./recipes.js";

function prefs(): Preferences {
  return {
    brands: { milk: "Horizon" }, sizes: { milk: "1 gal" },
    stores: { preferred: [], avoid: [] },
    substitutions: { allow: true, ask_first: true },
    dietary: { restrictions: [], notes: "" },
    updated_at: "t",
  };
}

describe("listsource", () => {
  it("adhoc applies preferences", () => {
    const out = openAdhoc({ items: [{ name: "Milk", qty: 1 }], prefs: prefs() });
    expect(out.items[0].brand).toBe("Horizon");
    expect(out.items[0].size).toBe("1 gal");
    expect(out.origin).toBe("adhoc");
  });

  it("staples pulls the current staples list", () => {
    const out = openStaples({
      staples: [{
        key: "milk", display_name: "Milk", typical_qty: 1, occurrences: 3,
        last_seen: "t", recency_rank: 1,
      }],
    });
    expect(out.items[0].name).toBe("Milk");
    expect(out.items[0].qty).toBe(1);
    expect(out.origin).toBe("staples");
  });

  it("repeat loads a cart by cart_id", () => {
    const out = openRepeat({
      carts: [{
        cart_id: "local_x", built_at: "t", store: "s",
        fulfillment: { type: "delivery", window: "w" },
        items: [{ name: "Bread", qty: 1, price: 1 }],
      }],
      ref: { cart_id: "local_x" },
    });
    expect(out.items[0].name).toBe("Bread");
  });

  it("repeat with 'last' loads the most recent", () => {
    const out = openRepeat({
      carts: [
        { cart_id: "a", built_at: "2026-04-10T00:00:00Z", store: "s",
          fulfillment: { type: "delivery", window: "w" }, items: [{ name: "X", qty: 1, price: 1 }] },
        { cart_id: "b", built_at: "2026-04-20T00:00:00Z", store: "s",
          fulfillment: { type: "delivery", window: "w" }, items: [{ name: "Y", qty: 1, price: 1 }] },
      ],
      ref: { cart_id: "last" },
    });
    expect(out.items[0].name).toBe("Y");
  });

  it("recipes returns NotImplemented", () => {
    const out = openRecipes({ args: {} });
    expect(out.origin).toBe("recipes");
    expect(out.items).toEqual([]);
    expect(out.notImplemented).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/listsource/listsource.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement each module**

`src/listsource/types.ts`:

```ts
import type { Staple, Preferences, Cart } from "../memory/schemas.js";

export interface ListItem {
  name: string;
  qty: number;
  brand?: string;
  size?: string;
  notes?: string;
}

export interface ListSourceResult {
  items: ListItem[];
  origin: "adhoc" | "staples" | "repeat" | "recipes";
  notImplemented?: boolean;
}

export type { Staple, Preferences, Cart };
```

`src/listsource/adhoc.ts`:

```ts
import type { ListItem, ListSourceResult, Preferences } from "./types.js";

export interface AdhocInput {
  items: Array<{ name: string; qty?: number }>;
  prefs: Preferences;
}

export function openAdhoc(inp: AdhocInput): ListSourceResult {
  const items: ListItem[] = inp.items.map((it) => {
    const key = it.name.toLowerCase();
    return {
      name: it.name,
      qty: it.qty ?? 1,
      brand: inp.prefs.brands[key],
      size: inp.prefs.sizes[key],
    };
  });
  return { items, origin: "adhoc" };
}
```

`src/listsource/staples.ts`:

```ts
import type { ListItem, ListSourceResult, Staple } from "./types.js";

export function openStaples(inp: { staples: Staple[] }): ListSourceResult {
  const items: ListItem[] = inp.staples.map((s) => ({
    name: s.display_name,
    qty: s.typical_qty,
    brand: s.brand,
    size: s.size,
  }));
  return { items, origin: "staples" };
}
```

`src/listsource/repeat.ts`:

```ts
import type { ListItem, ListSourceResult, Cart } from "./types.js";

export interface RepeatInput {
  carts: Cart[];
  ref: { cart_id: string };
}

export function openRepeat(inp: RepeatInput): ListSourceResult {
  let target: Cart | undefined;
  if (inp.ref.cart_id === "last") {
    const sorted = [...inp.carts].sort((a, b) => a.built_at.localeCompare(b.built_at));
    target = sorted.at(-1);
  } else {
    target = inp.carts.find((c) => c.cart_id === inp.ref.cart_id);
  }
  const items: ListItem[] = (target?.items ?? []).map((it) => ({
    name: it.name, qty: it.qty, brand: it.brand, size: it.size,
  }));
  return { items, origin: "repeat" };
}
```

`src/listsource/recipes.ts`:

```ts
import type { ListSourceResult } from "./types.js";

export function openRecipes(_inp: { args: Record<string, unknown> }): ListSourceResult {
  return { items: [], origin: "recipes", notImplemented: true };
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `npm test -- src/listsource/listsource.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/listsource/ 
git commit -m "listsource: adhoc (applies prefs), staples, repeat, recipes stub"
```

---

## Task 13: Cart-review HTML parser (fixture test)

**Files:**
- Create: `test/fixtures/cart-review.html`
- Create: `src/parsers/cart-review.ts`
- Create: `src/parsers/cart-review.test.ts`

- [ ] **Step 1: Write the fixture `test/fixtures/cart-review.html`**

```html
<!doctype html>
<html><body>
<main data-testid="review-page">
  <header>
    <h1>Review your order</h1>
    <div data-testid="store-name">Harris Teeter - Wake Forest</div>
  </header>
  <section data-testid="fulfillment">
    <div data-testid="fulfillment-type">Delivery</div>
    <div data-testid="fulfillment-window">Sat, Apr 18, 10:00 AM – 12:00 PM</div>
    <div data-testid="delivery-address">123 Main St, Wake Forest, NC</div>
  </section>
  <ul data-testid="cart-items">
    <li data-testid="cart-item">
      <span data-testid="item-name">Horizon Organic Whole Milk</span>
      <span data-testid="item-size">1 gal</span>
      <span data-testid="item-qty">2</span>
      <span data-testid="item-price">$7.98</span>
    </li>
    <li data-testid="cart-item">
      <span data-testid="item-name">Bananas</span>
      <span data-testid="item-qty">6</span>
      <span data-testid="item-unit">each</span>
      <span data-testid="item-price">$1.98</span>
    </li>
  </ul>
  <aside data-testid="totals">
    <div data-testid="subtotal">$9.96</div>
    <div data-testid="fees">$3.99</div>
    <div data-testid="total">$13.95</div>
  </aside>
</main>
</body></html>
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCartReviewHtml } from "./cart-review.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, "../../test/fixtures/cart-review.html"), "utf8"
);

describe("parseCartReviewHtml", () => {
  it("extracts store + fulfillment", () => {
    const c = parseCartReviewHtml(FIXTURE);
    expect(c.store).toBe("Harris Teeter - Wake Forest");
    expect(c.fulfillment.type).toBe("delivery");
    expect(c.fulfillment.window).toContain("10:00 AM");
    expect(c.fulfillment.address).toContain("Wake Forest");
  });

  it("extracts items with qty and price", () => {
    const c = parseCartReviewHtml(FIXTURE);
    expect(c.items).toHaveLength(2);
    const milk = c.items[0];
    expect(milk.name).toBe("Horizon Organic Whole Milk");
    expect(milk.qty).toBe(2);
    expect(milk.price).toBeCloseTo(7.98);
    expect(milk.size).toBe("1 gal");
  });

  it("extracts totals if present", () => {
    const c = parseCartReviewHtml(FIXTURE);
    expect(c.subtotal).toBeCloseTo(9.96);
    expect(c.total).toBeCloseTo(13.95);
    expect(c.fees).toBeCloseTo(3.99);
  });
});
```

- [ ] **Step 3: Run test — expect failure**

Run: `npm test -- src/parsers/cart-review.test.ts`
Expected: FAIL.

- [ ] **Step 4: Add `node-html-parser` dependency**

Run: `npm install node-html-parser`

- [ ] **Step 5: Implement `src/parsers/cart-review.ts`**

```ts
import { parse } from "node-html-parser";
import type { Cart, CartItem } from "../memory/schemas.js";

export interface ParsedReview {
  store: string;
  fulfillment: Cart["fulfillment"];
  items: CartItem[];
  subtotal?: number;
  fees?: number;
  total?: number;
}

function parseMoney(txt: string | undefined): number | undefined {
  if (!txt) return undefined;
  const m = txt.replace(/[, ]/g, "").match(/-?\$?(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function parseQty(txt: string | undefined): number {
  if (!txt) return 1;
  const m = txt.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 1;
}

export function parseCartReviewHtml(html: string): ParsedReview {
  const root = parse(html);
  const store = (root.querySelector('[data-testid="store-name"]')?.text ?? "").trim();
  const typeTxt = (root.querySelector('[data-testid="fulfillment-type"]')?.text ?? "").trim().toLowerCase();
  const type: "delivery" | "pickup" = typeTxt.includes("pickup") ? "pickup" : "delivery";
  const window = (root.querySelector('[data-testid="fulfillment-window"]')?.text ?? "").trim();
  const address = (root.querySelector('[data-testid="delivery-address"]')?.text ?? "").trim() || undefined;

  const itemNodes = root.querySelectorAll('[data-testid="cart-item"]');
  const items: CartItem[] = itemNodes.map((node) => {
    const name = (node.querySelector('[data-testid="item-name"]')?.text ?? "").trim();
    const size = (node.querySelector('[data-testid="item-size"]')?.text ?? "").trim() || undefined;
    const qty = parseQty(node.querySelector('[data-testid="item-qty"]')?.text);
    const unit = (node.querySelector('[data-testid="item-unit"]')?.text ?? "").trim() || undefined;
    const price = parseMoney(node.querySelector('[data-testid="item-price"]')?.text) ?? 0;
    return { name, size, qty, unit, price };
  });

  const subtotal = parseMoney(root.querySelector('[data-testid="subtotal"]')?.text);
  const fees = parseMoney(root.querySelector('[data-testid="fees"]')?.text);
  const total = parseMoney(root.querySelector('[data-testid="total"]')?.text);

  return {
    store,
    fulfillment: { type, window, address },
    items,
    subtotal,
    fees,
    total,
  };
}
```

- [ ] **Step 6: Run test — expect pass**

Run: `npm test -- src/parsers/cart-review.test.ts`
Expected: PASS (3/3).

- [ ] **Step 7: Commit**

```bash
git add test/fixtures/cart-review.html src/parsers/cart-review.ts src/parsers/cart-review.test.ts package.json package-lock.json
git commit -m "parsers: cart-review DOM extractor with fixture-based canary test"
```

---

## Task 14: Tool — `instacart_resolve_login_code`

**Files:**
- Create: `src/tools/resolve_login_code.ts`

- [ ] **Step 1: Implement**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { InstacartConfig } from "../config.js";
import { resolveLoginCode, type ResendClient } from "../auth/login-code.js";

export const ResolveLoginCodeInput = Type.Object({
  requested_after: Type.String({ description: "ISO-8601 timestamp; codes received before this are ignored." }),
  timeout_ms: Type.Optional(Type.Number()),
});
export type ResolveLoginCodeInputT = Static<typeof ResolveLoginCodeInput>;

export interface ResolveLoginCodeDeps {
  resend: ResendClient;
  config: InstacartConfig;
}

export async function runResolveLoginCode(
  deps: ResolveLoginCodeDeps,
  input: ResolveLoginCodeInputT,
): Promise<{ code?: string; received_at?: string; error?: "timeout" | "not_found" }> {
  const cfg = deps.config.auth;
  const res = await resolveLoginCode({
    resend: deps.resend,
    requestedAfter: input.requested_after,
    senderPattern: cfg.senderPattern,
    codeRegex: cfg.codeRegex,
    timeoutMs: input.timeout_ms ?? cfg.timeoutMs,
    pollIntervalMs: cfg.pollIntervalMs,
  });
  if (res.ok) return { code: res.code, received_at: res.received_at };
  return { error: res.error };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/resolve_login_code.ts
git commit -m "tools: resolve_login_code wrapper with typebox input schema"
```

---

## Task 15: Tool — `instacart_read_memory`

**Files:**
- Create: `src/tools/read_memory.ts`

- [ ] **Step 1: Implement**

```ts
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
```

**Note on `Type.Union`:** OpenClaw's tool-schema guardrail (CLAUDE.md) discourages `Type.Union` in favor of `stringEnum`/`optionalStringEnum`. Since this plugin is standalone (not the OpenClaw monorepo), the guardrail doesn't apply, but prefer `Type.Union(Type.Literal(...))` over raw `anyOf` — which is what the code above does. If a downstream validator complains, replace with `Type.String({ enum: ["carts", ...] })` and a runtime check.

- [ ] **Step 2: Commit**

```bash
git add src/tools/read_memory.ts
git commit -m "tools: read_memory with kind discriminator"
```

---

## Task 16: Tool — `instacart_write_memory`

**Files:**
- Create: `src/tools/write_memory.ts`

- [ ] **Step 1: Implement**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/write_memory.ts
git commit -m "tools: write_memory with zod validation per kind + preferences merge"
```

---

## Task 17: Tool — `instacart_record_cart`

**Files:**
- Create: `src/tools/record_cart.ts`

- [ ] **Step 1: Implement**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { cartSchema } from "../memory/schemas.js";
import { detectStaples } from "../recommendations/staples.js";
import type { InstacartConfig } from "../config.js";

export const RecordCartInput = Type.Object({
  cart: Type.Unknown({ description: "Cart object matching DESIGN §6." }),
});
export type RecordCartInputT = Static<typeof RecordCartInput>;

export async function runRecordCart(
  deps: { store: MemoryStore; config: InstacartConfig },
  input: RecordCartInputT,
): Promise<{ ok: true; staples_recomputed: boolean }> {
  const cart = cartSchema.parse(input.cart);
  await deps.store.appendCart(cart);
  const cartsFile = await deps.store.readCarts();
  const { staples, normalizer_version } = detectStaples({
    carts: cartsFile.carts,
    config: {
      minOccurrences: deps.config.staples.minOccurrences,
      windowSize: deps.config.staples.windowSize,
      maxAgeDays: deps.config.staples.maxAgeDays,
    },
  });
  await deps.store.writeStaples({
    staples,
    computed_at: new Date().toISOString(),
    normalizer_version,
    config: {
      minOccurrences: deps.config.staples.minOccurrences,
      windowSize: deps.config.staples.windowSize,
      maxAgeDays: deps.config.staples.maxAgeDays,
    },
  });
  return { ok: true, staples_recomputed: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/record_cart.ts
git commit -m "tools: record_cart appends then recomputes staples"
```

---

## Task 18: Tool — `instacart_rank_stores`

**Files:**
- Create: `src/tools/rank_stores.ts`

- [ ] **Step 1: Implement**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import type { InstacartConfig } from "../config.js";
import { rankStores, type StoreCandidate } from "../recommendations/stores.js";

export const RankStoresInput = Type.Object({
  candidates: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    distanceMi: Type.Optional(Type.Number()),
    windows: Type.Optional(Type.Array(Type.String())),
    carries: Type.Optional(Type.Array(Type.String())),
  })),
  list: Type.Optional(Type.Array(Type.String())),
});
export type RankStoresInputT = Static<typeof RankStoresInput>;

export async function runRankStores(
  deps: { store: MemoryStore; config: InstacartConfig },
  input: RankStoresInputT,
): Promise<{ ranked: Array<StoreCandidate & { score: number; rationale: string }> }> {
  const prefsFile = await deps.store.readPreferences();
  const cartsFile = await deps.store.readCarts();
  const historyCounts: Record<string, number> = {};
  for (const c of cartsFile.carts) {
    historyCounts[c.store] = (historyCounts[c.store] ?? 0) + 1;
  }
  const { ranked } = rankStores({
    candidates: input.candidates,
    list: input.list ?? [],
    prefs: prefsFile.preferences.stores,
    historyCounts,
    weights: deps.config.ranking,
  });
  return { ranked };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/rank_stores.ts
git commit -m "tools: rank_stores reading prefs + history"
```

---

## Task 19: Tool — `instacart_detect_staples`

**Files:**
- Create: `src/tools/detect_staples.ts`

- [ ] **Step 1: Implement**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import type { InstacartConfig } from "../config.js";
import { detectStaples } from "../recommendations/staples.js";

export const DetectStaplesInput = Type.Object({
  force: Type.Optional(Type.Boolean()),
});
export type DetectStaplesInputT = Static<typeof DetectStaplesInput>;

export async function runDetectStaples(
  deps: { store: MemoryStore; config: InstacartConfig },
  input: DetectStaplesInputT,
): Promise<{ staples: unknown; changed: boolean }> {
  const cartsFile = await deps.store.readCarts();
  const cur = await deps.store.readStaples();
  const { staples, normalizer_version } = detectStaples({
    carts: cartsFile.carts,
    config: deps.config.staples,
  });
  const changed =
    input.force ||
    cur.normalizer_version !== normalizer_version ||
    cur.staples.length !== staples.length ||
    staples.some((s, i) => cur.staples[i]?.key !== s.key);
  if (changed) {
    await deps.store.writeStaples({
      staples,
      computed_at: new Date().toISOString(),
      normalizer_version,
      config: deps.config.staples,
    });
  }
  return { staples, changed: !!changed };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/detect_staples.ts
git commit -m "tools: detect_staples with force + change detection"
```

---

## Task 20: Tool — `instacart_update_preference`

**Files:**
- Create: `src/tools/update_preference.ts`

- [ ] **Step 1: Implement**

```ts
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
  const cur = await deps.store.readPreferences();
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/update_preference.ts
git commit -m "tools: update_preference with pending/one_shot_confirm/manual branches"
```

---

## Task 21: Tool — `instacart_open_list_source`

**Files:**
- Create: `src/tools/open_list_source.ts`

- [ ] **Step 1: Implement**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { openAdhoc } from "../listsource/adhoc.js";
import { openStaples } from "../listsource/staples.js";
import { openRepeat } from "../listsource/repeat.js";
import { openRecipes } from "../listsource/recipes.js";
import type { ListSourceResult } from "../listsource/types.js";

export const OpenListSourceInput = Type.Object({
  kind: Type.Union([
    Type.Literal("adhoc"),
    Type.Literal("staples"),
    Type.Literal("repeat"),
    Type.Literal("recipes"),
  ]),
  args: Type.Optional(Type.Object({
    items: Type.Optional(Type.Array(Type.Object({
      name: Type.String(),
      qty: Type.Optional(Type.Number()),
    }))),
    cart_id: Type.Optional(Type.String()),
  })),
});
export type OpenListSourceInputT = Static<typeof OpenListSourceInput>;

export async function runOpenListSource(
  deps: { store: MemoryStore },
  input: OpenListSourceInputT,
): Promise<ListSourceResult> {
  switch (input.kind) {
    case "adhoc": {
      const prefs = (await deps.store.readPreferences()).preferences;
      return openAdhoc({ items: input.args?.items ?? [], prefs });
    }
    case "staples": {
      const staplesFile = await deps.store.readStaples();
      return openStaples({ staples: staplesFile.staples });
    }
    case "repeat": {
      const carts = (await deps.store.readCarts()).carts;
      return openRepeat({ carts, ref: { cart_id: input.args?.cart_id ?? "last" } });
    }
    case "recipes":
      return openRecipes({ args: input.args ?? {} });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/open_list_source.ts
git commit -m "tools: open_list_source dispatcher over adhoc/staples/repeat/recipes"
```

---

## Task 22: Tools — `start_session` / `update_session` / `end_session`

**Files:**
- Create: `src/tools/start_session.ts`
- Create: `src/tools/update_session.ts`
- Create: `src/tools/end_session.ts`
- Create: `src/tools/sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test — expect failure**

Run: `npm test -- src/tools/sessions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/start_session.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/tools/update_session.ts`**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";
import { sessionSchema } from "../memory/schemas.js";

export const UpdateSessionInput = Type.Object({
  patch: Type.Unknown({ description: "Partial Session to merge into current." }),
});
export type UpdateSessionInputT = Static<typeof UpdateSessionInput>;

export async function runUpdateSession(
  deps: { store: MemoryStore },
  input: UpdateSessionInputT,
): Promise<{ ok: true }> {
  const cur = await deps.store.readSessions();
  if (!cur.current) throw new Error("no current session");
  const merged = sessionSchema.parse({
    ...cur.current,
    ...(input.patch as Record<string, unknown>),
    last_updated: new Date().toISOString(),
  });
  await deps.store.writeSessions({ current: merged, recent: cur.recent });
  return { ok: true };
}
```

- [ ] **Step 5: Implement `src/tools/end_session.ts`**

```ts
import { Type, type Static } from "@sinclair/typebox";
import type { MemoryStore } from "../memory/index.js";

export const EndSessionInput = Type.Object({
  status: Type.Union([Type.Literal("handed_off"), Type.Literal("abandoned")]),
});
export type EndSessionInputT = Static<typeof EndSessionInput>;

export async function runEndSession(
  deps: { store: MemoryStore },
  input: EndSessionInputT,
): Promise<{ ok: true }> {
  const cur = await deps.store.readSessions();
  if (!cur.current) return { ok: true };
  const closed = { ...cur.current, status: input.status, last_updated: new Date().toISOString() };
  await deps.store.writeSessions({
    recent: [closed, ...cur.recent].slice(0, 10),
  });
  return { ok: true };
}
```

- [ ] **Step 6: Run test — expect pass**

Run: `npm test -- src/tools/sessions.test.ts`
Expected: PASS (2/2).

- [ ] **Step 7: Commit**

```bash
git add src/tools/start_session.ts src/tools/update_session.ts src/tools/end_session.ts src/tools/sessions.test.ts
git commit -m "tools: start_session (stale rotation), update_session (merge), end_session (rotate)"
```

---

## Task 23: Plugin entry — `index.ts`

**Files:**
- Create: `index.ts`

- [ ] **Step 1: Implement**

```ts
import { definePluginEntry } from "./api.js";
import { Type } from "@sinclair/typebox";
import { loadConfig, type InstacartConfig } from "./src/config.js";
import { createMemoryStore } from "./src/memory/index.js";

import { ResolveLoginCodeInput, runResolveLoginCode } from "./src/tools/resolve_login_code.js";
import { ReadMemoryInput, runReadMemory } from "./src/tools/read_memory.js";
import { WriteMemoryInput, runWriteMemory } from "./src/tools/write_memory.js";
import { RecordCartInput, runRecordCart } from "./src/tools/record_cart.js";
import { RankStoresInput, runRankStores } from "./src/tools/rank_stores.js";
import { DetectStaplesInput, runDetectStaples } from "./src/tools/detect_staples.js";
import { UpdatePreferenceInput, runUpdatePreference } from "./src/tools/update_preference.js";
import { OpenListSourceInput, runOpenListSource } from "./src/tools/open_list_source.js";
import { StartSessionInput, runStartSession } from "./src/tools/start_session.js";
import { UpdateSessionInput, runUpdateSession } from "./src/tools/update_session.js";
import { EndSessionInput, runEndSession } from "./src/tools/end_session.js";

/**
 * Adapter from whatever shape the host's `resend` skill exposes to our internal
 * `ResendClient`. If the host only ships MCP-style tool calls, we route through those.
 * Keep this narrow on purpose — swap impl without touching auth/login-code.ts.
 */
async function loadResendClient(api: unknown) {
  const anyApi = api as any;
  if (typeof anyApi.callSkill === "function") {
    return {
      list: async () => (await anyApi.callSkill("resend", "emails.receiving.list", {})) as Array<{
        id: string; from: string; receivedAt: string;
      }>,
      get: async (id: string) => (await anyApi.callSkill("resend", "emails.receiving.get", { id })) as {
        id: string; from: string; receivedAt: string; text: string;
      },
    };
  }
  throw new Error("instacart-browser: host does not expose a way to call the resend skill");
}

export default definePluginEntry({
  id: "instacart-browser",
  name: "Instacart Browser",
  description: "Build Instacart carts conversationally. Stops at review — humans place orders.",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      dataDir: { type: "string" },
      profile: { type: "string" },
      loginEmail: { type: "string" },
      auth: { type: "object" },
      staples: { type: "object" },
      ranking: { type: "object" },
    },
  },
  register(api: any) {
    const config: InstacartConfig = loadConfig(api.config ?? {});
    const store = createMemoryStore({ dataDir: config.dataDir });
    const resendPromise = loadResendClient(api);

    const tool = (name: string, description: string, parameters: unknown, fn: (input: any) => Promise<unknown>) => {
      api.registerTool({
        name,
        label: name,
        description,
        parameters,
        async execute(_id: string, params: any) { return fn(params); },
      });
    };

    tool("instacart_resolve_login_code",
      "Poll resend inbound for an Instacart passwordless login code received after requested_after. Never logs the code.",
      ResolveLoginCodeInput,
      async (input) => runResolveLoginCode({ resend: await resendPromise, config }, input));

    tool("instacart_read_memory",
      "Read one of the plugin's persistent JSON files (carts, staples, preferences, sessions).",
      ReadMemoryInput,
      async (input) => runReadMemory({ store }, input));

    tool("instacart_write_memory",
      "Atomically write a persistent JSON file. Preferences support merge=true.",
      WriteMemoryInput,
      async (input) => runWriteMemory({ store }, input));

    tool("instacart_record_cart",
      "Append a finalized Cart to carts.json and recompute staples.json.",
      RecordCartInput,
      async (input) => runRecordCart({ store, config }, input));

    tool("instacart_rank_stores",
      "Rank candidate stores by proximity, history, list match, and window fit (weights from config).",
      RankStoresInput,
      async (input) => runRankStores({ store, config }, input));

    tool("instacart_detect_staples",
      "Recompute staples.json from carts.json using thresholds from config.",
      DetectStaplesInput,
      async (input) => runDetectStaples({ store, config }, input));

    tool("instacart_update_preference",
      "Record a preference override (pending) or promote one (one_shot_confirm / manual).",
      UpdatePreferenceInput,
      async (input) => runUpdatePreference({ store }, input));

    tool("instacart_open_list_source",
      "Open a list source (adhoc | staples | repeat | recipes-stub) and return normalized items.",
      OpenListSourceInput,
      async (input) => runOpenListSource({ store }, input));

    tool("instacart_start_session",
      "Create sessions.json.current, rotating a stale current into recent[] if needed.",
      StartSessionInput,
      async (input) => runStartSession({ store }, input));

    tool("instacart_update_session",
      "Merge a patch into sessions.json.current and bump last_updated.",
      UpdateSessionInput,
      async (input) => runUpdateSession({ store }, input));

    tool("instacart_end_session",
      "Rotate current into recent[] with the given terminal status (handed_off | abandoned).",
      EndSessionInput,
      async (input) => runEndSession({ store }, input));
  },
});
```

**Note:** the `api: any` type is intentional — the host surface isn't typed for standalone plugins outside the openclaw monorepo. Narrow to `OpenClawPluginApi` from `openclaw/plugin-sdk/plugin-entry` once install resolves it.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add index.ts
git commit -m "index: definePluginEntry registering 11 instacart.* tools"
```

---

## Task 24: SKILL.md

**Files:**
- Create: `SKILL.md`

- [ ] **Step 1: Write `SKILL.md`**

````markdown
---
name: instacart_browser
description: >
  Use when the user wants to build an Instacart cart — start shopping, add items,
  do the usuals, repeat last cart, schedule delivery/pickup, or review the cart.
  Handles passwordless login via the resend skill, persists carts/staples/preferences,
  and stops at the review screen. Does NOT place orders — humans do.
metadata:
  openclaw:
    os: ["darwin", "linux"]
    requires:
      skills: ["resend"]
      tools: ["browser"]
inputs:
  - name: INSTACART_EMAIL
    description: Login email for Instacart (passwordless). Falls back to plugin config `loginEmail`.
    required: false
references:
  - auth.md
  - stores.md
  - cart.md
  - fulfillment.md
  - review.md
  - troubleshooting.md
---

# Instacart Browser

You help the household build Instacart carts in a browser session, end-to-end, and then **stop at the review screen** so a human places the order. You never click Place Order — it is not in your tool set and it is not in this skill.

## When to use this

The user says things like:
- "Let's do groceries."
- "Do the usuals."
- "Repeat last week's cart, skip the ice cream."
- "Add milk, eggs, and bananas."
- "Compare stores."
- "Schedule delivery for Saturday morning."
- "Check my cart."

## Flow

1. **Decide the list source.** Classify the user's intent → one of `adhoc | staples | repeat | recipes`. Call `instacart_open_list_source({ kind, args? })`.

2. **Session probe.** Use the `browser` tool to navigate to `https://www.instacart.com`. Check for the logged-in indicator (see `auth.md`). If logged in, continue. If not, go to step 3.

3. **Auth.** Capture the current ISO timestamp as `requested_after`. Use `browser` to enter the configured email and request a code. Then call `instacart_resolve_login_code({ requested_after })`. Enter the returned code. Re-probe login state. If captcha — **halt and tell the user**.

4. **Store selection.** If the user asked to compare stores, call `instacart_rank_stores` with the candidates the page exposes. Otherwise use the last-used store (from `instacart_read_memory({ kind: "carts" })`'s most recent entry).

5. **Session start.** Call `instacart_start_session({ list_source, list_source_ref? })`.

6. **Cart building.** For each list item, search in Instacart, apply user preferences, and add. On overrides (different brand/size than preference), call `instacart_update_preference({ field, key, from, to, reason: "pending" | "one_shot_confirm" | "manual" })`. After each material change, call `instacart_update_session({ patch: { cart: [...] } })`.

7. **Fulfillment.** Set delivery or pickup; pick a window. See `fulfillment.md`.

8. **Review — STOP.** Navigate to the review page. Extract the cart state (store, window, items, totals) via the `browser` tool. Present the summary to the user. Say:

   > "Cart is ready — **review and place it yourself on Instacart**."

   **Never click Place Order. Never call a tool to place an order — there is none.**

9. **Record.** Call `instacart_record_cart({ cart })` with the extracted state, then `instacart_end_session({ status: "handed_off" })`.

## Key rules

- **No Place Order path.** There is no tool, instruction, or helper in this skill that places the order. If asked, respond: *"I don't place orders — you do, in Instacart."*
- **Resume within 24 hours.** Before starting fresh, call `instacart_read_memory({ kind: "sessions" })`. If `current` exists and `last_updated` is within 24 hours, offer to resume.
- **Preference evolution is explicit.** One-shot changes use `reason: "one_shot_confirm"` or `"manual"`. Record-only overrides use `reason: "pending"` and are auto-promoted after 2 consecutive agreeing overrides.
- **Never log the login code.** Don't echo it in any message, tool log, or reply.
- **Captcha halts.** If a captcha or challenge appears, stop and tell the user.
- **DOM drift: stop loudly.** When selector ladders fail, say the UI may have changed; never click a random-looking button.

See `references/` for details.
````

- [ ] **Step 2: Commit**

```bash
git add SKILL.md
git commit -m "SKILL.md: agent-facing instructions for instacart-browser"
```

---

## Task 25: References — `auth.md`

**Files:**
- Create: `references/auth.md`

- [ ] **Step 1: Write**

````markdown
# auth.md

## Logged-in indicator ladder

Try in order; stop at the first match:

1. `aria-label="Account menu"` — reliable.
2. `[data-testid="user-menu-trigger"]`
3. `nav button:has-text("Account")`
4. CSS: `header [data-qa="account-menu"]`

If none match after the page is loaded, treat as **not logged in**.

## Request-code selectors

1. Email field: `input[type="email"]`, `[data-testid="email-input"]`, `input[name="email"]`.
2. Continue/send code: `button:has-text("Continue")`, `[data-testid="send-code"]`.
3. Code field (after request): `input[autocomplete="one-time-code"]`, `input[inputmode="numeric"]`, `[data-testid="code-input"]`.
4. Submit: `button:has-text("Verify")`, `button[type="submit"]`, `[data-testid="verify-code"]`.

## Flow

1. Capture `requested_after = new Date().toISOString()` **before** clicking Continue.
2. Click Continue/send-code.
3. Call `instacart_resolve_login_code({ requested_after })`.
4. If `error === "timeout"`: try once more (click "resend code"), recapture `requested_after`, retry.
5. If the response returns a code, type it into the code field and submit.
6. Re-probe the logged-in indicator.

## Retry / timeout

- Default `timeout_ms` comes from plugin config (120_000). Don't exceed it.
- One resend attempt max. Then hand control back to the user: *"I couldn't get the code — want to paste it?"*

## Captcha

If any of these appear, **halt and message the user**. Do not attempt to solve.

- iframe from `hcaptcha.com`, `recaptcha.net`, `google.com/recaptcha`
- Text: "Verify you're a human", "Press and hold", "Complete the challenge"
- Any slider/puzzle element

## 2FA

If a second code field appears after login, repeat the auth sub-flow with a new `requested_after`.
````

- [ ] **Step 2: Commit**

```bash
git add references/auth.md
git commit -m "references/auth.md: selector ladders and retry policy"
```

---

## Task 26: References — `stores.md`

**Files:**
- Create: `references/stores.md`

- [ ] **Step 1: Write**

````markdown
# stores.md

## Enumerating retailers at the delivery address

1. Navigate to `https://www.instacart.com/store` (or follow the "Change address" affordance from the home page).
2. Extract the list: `[data-testid="retailer-card"]`, fallback `[class*="retailer"]` or aria-role=link with "Shop at" text.
3. For each card, capture:
   - `id`: the href segment, e.g. `/store/harris-teeter/storefront`
   - `name`: card title
   - `distanceMi`: numeric prefix of distance line, fallback undefined
   - `windows`: from card's "Delivery by …" microcopy (may be empty)

## Windows at the retailer level

- Open retailer storefront → "Change delivery" / "Change pickup" modal.
- List `[data-testid="delivery-window"]` entries; each has a date + time range.
- Extract as strings (`"Sat, Apr 18, 10:00 AM – 12:00 PM"`).

## Address-picker quirks

- Address autocomplete sometimes debounces; wait ~500ms after typing.
- "Use current location" requires OS permission — skip it and type the saved address.
- If the Instacart account has multiple addresses, prefer the one matching configured delivery (not in config yet — ask user once and stash as a preference override with `reason: "manual"`).

## Calling `instacart_rank_stores`

Pass the extracted candidates + current list keys (if known) + user preferences. Example:

```json
{
  "candidates": [
    { "id": "harris-teeter", "name": "Harris Teeter - Wake Forest", "distanceMi": 1.4, "windows": ["Sat 10–12"], "carries": ["milk","eggs"] },
    { "id": "publix", "name": "Publix - Wake Forest", "distanceMi": 2.8, "windows": ["Sat 12–2"] }
  ],
  "list": ["milk","eggs","bread"]
}
```

The tool returns `{ ranked, rationale }`. Present top 3 to the user with rationales.
````

- [ ] **Step 2: Commit**

```bash
git add references/stores.md
git commit -m "references/stores.md: retailer enumeration and rank_stores input shape"
```

---

## Task 27: References — `cart.md`

**Files:**
- Create: `references/cart.md`

- [ ] **Step 1: Write**

````markdown
# cart.md

## Search

1. Search input: `[data-testid="search-input"]`, fallback `input[placeholder*="Search"]`.
2. Submit with Enter or button `[data-testid="search-submit"]`.

## Disambiguation

Preference order when choosing a search result:

1. **Exact brand match** against `preferences.brands[key]`.
2. **Exact size match** against `preferences.sizes[key]`.
3. **Highest availability** — skip "Out of stock" cards.
4. Fallback: the first result that matches the normalized item name.

If none match well, ask the user instead of guessing.

## Adding

1. Add button: `[data-testid="add-item"]`, `button:has-text("Add")`, `button[aria-label*="Add"]`.
2. Qty stepper: `[data-testid="qty-increase"]` / `[data-testid="qty-decrease"]`.
3. After adding, confirm the cart icon increments (or poll `[data-testid="cart-count"]`).

## OOS / substitutions

If the card shows an OOS indicator or offers a substitution:

- If `preferences.substitutions.allow === false`: skip the item; note it in `session.flags.oos`.
- If `allow === true && ask_first === true`: ask the user about the offered sub.
- If `allow === true && ask_first === false`: accept the offered sub; record in `session.flags.substitutions`.

## Preference overrides

When the user picks something different from the preference:

```
instacart_update_preference({
  field: "brand",
  key: "<normalized item key>",
  from: "<previous pref>",
  to: "<new choice>",
  reason: "pending" | "one_shot_confirm" | "manual"
})
```

- `"pending"` — record to the streak buffer; the tool auto-promotes after 2 agreeing overrides.
- `"one_shot_confirm"` — user confirmed "remember this" inline.
- `"manual"` — user directly stated a preference, not in response to a cart action.

## Extracting cart state (mid-flow)

- Cart tray: `[data-testid="cart-tray"]` / `[aria-label="Cart"]`.
- Item rows: `[data-testid="cart-item"]`.
- Per row: name, qty, unit price, line total, size, substitution hint.

Prefer the review page for the final snapshot (see `review.md`); mid-flow extraction is only for progress updates.
````

- [ ] **Step 2: Commit**

```bash
git add references/cart.md
git commit -m "references/cart.md: search, disambiguation, OOS/sub handling, override recording"
```

---

## Task 28: References — `fulfillment.md`

**Files:**
- Create: `references/fulfillment.md`

- [ ] **Step 1: Write**

````markdown
# fulfillment.md

## Choosing delivery vs pickup

1. Navigate to the fulfillment modal: "Checkout" → "Change delivery" / "Change pickup".
2. Toggle: `[data-testid="fulfillment-toggle"]`, fallback tabs with text "Delivery" / "Pickup".

## Picking a window

- Window list: `[data-testid="delivery-window"]` (delivery) or `[data-testid="pickup-window"]` (pickup).
- Each window exposes: date line + time range line.
- Preserve the shown format when recording (`"Sat, Apr 18, 10:00 AM – 12:00 PM"`).

## Record in session

After confirming a window:

```
instacart_update_session({
  patch: {
    fulfillment: {
      type: "delivery" | "pickup",
      window: "<as-shown>",
      window_start: "<ISO if parseable>",
      window_end: "<ISO if parseable>",
      address: "<only for delivery>"
    }
  }
})
```

## No windows

- If the list is empty, offer: another day, a different store, or pickup instead.
- Don't auto-pick — ask the user.
````

- [ ] **Step 2: Commit**

```bash
git add references/fulfillment.md
git commit -m "references/fulfillment.md: delivery/pickup + window selection + session update"
```

---

## Task 29: References — `review.md` (the stop)

**Files:**
- Create: `references/review.md`

- [ ] **Step 1: Write**

````markdown
# review.md

## The stop

This plugin **does not place orders**. At the review page you:

1. Extract the cart state.
2. Present it to the user.
3. Say exactly: *"Cart is ready. Review and place it yourself on Instacart."*
4. **Stop.** Do not click Place Order. Do not click any primary CTA on the review page.

## Extraction

Selector ladder:

- Container: `[data-testid="review-page"]`, `main:has-text("Review your order")`.
- Store: `[data-testid="store-name"]`.
- Fulfillment:
  - Type: `[data-testid="fulfillment-type"]` (text "Delivery" / "Pickup").
  - Window: `[data-testid="fulfillment-window"]`.
  - Address: `[data-testid="delivery-address"]` (delivery only).
- Items: `[data-testid="cart-item"]` with sub-selectors `item-name`, `item-size`, `item-qty`, `item-unit`, `item-price`.
- Totals: `[data-testid="subtotal"]`, `[data-testid="fees"]`, `[data-testid="total"]`.

The parser `src/parsers/cart-review.ts` handles this shape deterministically. If you have the page HTML, call it; otherwise drive the browser and mirror what the parser expects.

## What to say

Template:

> Cart is ready at **{store}** — **{fulfillment.type}** {fulfillment.window}{address ? " to " + address : ""}.
>
> **Items ({N}):**
> - {qty}× {name}{size ? " (" + size + ")" : ""} — ${price}
> ...
>
> Subtotal: ${subtotal}. Fees: ${fees}. Total: ${total}.
>
> **Review and place it yourself on Instacart.** I'll stop here.

## Recording

After presenting:

```
instacart_record_cart({ cart: <extracted snapshot> })
instacart_end_session({ status: "handed_off" })
```

## What NOT to do

- Never click `button:has-text("Place Order")`, `[data-testid="place-order"]`, or the primary CTA on the review page.
- If the user says "yeah go ahead place it" — decline: *"I don't place orders. You'll need to click Place Order yourself."*
- If you think you're on the review page but none of the selectors resolve, **stop and report** — don't keep clicking.
````

- [ ] **Step 2: Commit**

```bash
git add references/review.md
git commit -m "references/review.md: the stop — extraction, what to say, what not to click"
```

---

## Task 30: References — `troubleshooting.md`

**Files:**
- Create: `references/troubleshooting.md`

- [ ] **Step 1: Write**

````markdown
# troubleshooting.md

## Session expired mid-flow

- Symptom: login-modal elements reappear or a 401 redirect occurs.
- Action: pause, run the auth sub-flow (`references/auth.md`) with a fresh `requested_after`.
- After re-auth: **re-extract the cart state from Instacart** and reconcile with `sessions.json.current.cart`. Instacart's server typically preserves the cart but don't assume — compare and fix discrepancies before continuing.

## Captcha

**Halt.** Tell the user; never auto-solve. See `auth.md` for detection.

## 2FA

Separate code field after login → repeat the auth sub-flow.

## Item not found

- Symptom: empty results.
- Action: ask the user for an alternative name, or skip and note in `session.flags.oos`.

## Out of stock

See `cart.md` — honor `preferences.substitutions`.

## No windows

- Offer: another day, another store, or pickup instead.
- Don't auto-pick.

## Rate limiting

- Symptom: 429-style UI or persistent errors.
- Action: back off with jitter (1s, 2s, 4s), cap at 3 retries.
- If still failing: stop and report.

## DOM drift

- Symptom: selector ladder exhausted.
- Action: log URL + accessible tree (via `browser` tool's accessibility snapshot), then stop. Tell the user the UI may have changed; suggest they file an issue in `@dtiemann/openclaw-instacart-browser`.

## Duplicate current session

- Symptom: `sessions.json.current` exists on a new "let's do groceries" invocation.
- If `last_updated` is within 24 hours: offer to resume.
- Else: `start_session` auto-rotates it to `recent[]` as `abandoned`.

## resend skill missing

- Symptom: plugin load fails with "host does not expose a way to call the resend skill".
- Fix: `openclaw skills install resend` (or check `~/.openclaw/openclaw.json.plugins.entries.resend.enabled`).

## Browser tool not attached

- Symptom: CDP attach errors.
- Fix: check `~/.openclaw/openclaw.json.browser.profiles.openclaw.cdpPort` (18800) and that Chrome is running with `--remote-debugging-port=18800`, or set `attachOnly: false` for the session to have the tool launch Chrome itself.
````

- [ ] **Step 2: Commit**

```bash
git add references/troubleshooting.md
git commit -m "references/troubleshooting.md: error matrix mirroring DESIGN §9"
```

---

## Task 31: README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write**

````markdown
# @dtiemann/openclaw-instacart-browser

OpenClaw plugin that builds Instacart carts conversationally and **stops at the review screen** — humans place the orders.

## Install

```
openclaw plugins install ~/Desktop/Repos/instacart-browser
```

Or add to `~/.openclaw/openclaw.json`:

```jsonc
{
  "plugins": {
    "entries": { "instacart-browser": { "enabled": true } },
    "load": { "paths": ["/Users/<you>/Desktop/Repos/instacart-browser"] }
  }
}
```

Requires the `resend` skill and the built-in `browser` tool.

## Config

```jsonc
{
  "plugins": {
    "entries": {
      "instacart-browser": {
        "enabled": true,
        "config": {
          "dataDir": "~/.openclaw/workspace/instacart-browser",
          "profile": "openclaw",
          "loginEmail": "you@example.com",
          "staples": { "minOccurrences": 3, "windowSize": 5 }
        }
      }
    }
  }
}
```

See `DESIGN.md` for the full schema.

## Tools

`instacart_resolve_login_code`, `instacart_read_memory`, `instacart_write_memory`, `instacart_record_cart`, `instacart_rank_stores`, `instacart_detect_staples`, `instacart_update_preference`, `instacart_open_list_source`, `instacart_start_session`, `instacart_update_session`, `instacart_end_session`.

## What it does NOT do

- Place orders.
- Manage payment methods.
- Handle marketing email.
- Support per-person preference profiles.

## Dev

```
npm install
npm test
npm run typecheck
```

See `PLAN.md` for the implementation plan and `DESIGN.md` for the architecture.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "README.md: install, config, tool list, non-goals"
```

---

## Task 32: Install locally and smoke test

**Files:** none — validation only.

- [ ] **Step 1: Run the full test suite**

Run: `cd ~/Desktop/Repos/instacart-browser && npm test`
Expected: all test files pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Register the plugin path with OpenClaw**

Read `~/.openclaw/openclaw.json`. If `plugins.load.paths` does not already include `/Users/dtiemann/Desktop/Repos/instacart-browser`, add it (keep existing `imessage-photon` entry), and add `"instacart-browser": { "enabled": true }` under `plugins.entries`.

- [ ] **Step 4: Load the plugin in the OpenClaw CLI**

Run: `openclaw plugins status`
Expected: `instacart-browser` appears as enabled. If it fails, copy the error and fix the root cause (do not disable the plugin).

- [ ] **Step 5: Verify tools registered**

Run: `openclaw tools list | grep instacart.`
Expected: 11 `instacart.*` tool names listed.

- [ ] **Step 6: Smoke test the data dir**

Run: `ls -la ~/.openclaw/workspace/instacart-browser/` (directory may not exist yet — that's fine; it's created on first write).

- [ ] **Step 7: Smoke-call one tool**

Run the CLI agent with a prompt like: *"Use instacart_read_memory to show me my staples."*

Expected: returns `{ data: { staples: [], computed_at: "...", normalizer_version: "0", config: {} } }` (empty default).

- [ ] **Step 8: Commit smoke-test evidence**

If you made any config edits, commit them to the openclaw config repo or note them in PLAN.md. Otherwise no commit.

```bash
# optional, only if any in-repo files changed during validation
git status
```

---

## Self-Review (run before handoff)

**1. Spec coverage check** — map each DESIGN.md section to tasks:

- §2 Platform primitives → Task 1 (manifest requires), Task 11 (resend), Task 14 (resolve_login_code).
- §3 Manifest shape → Task 1 (openclaw.plugin.json).
- §4 Boundaries → Tasks 23 (index.ts only registers, tools never touch browser), Tasks 24–30 (SKILL.md + references own DOM flow).
- §5 File layout → Tasks 1–31 map 1:1 to every file listed.
- §6 Data model → Task 4 (schemas), Task 5 (facade), Task 13 (parser → Cart shape).
- §7 Tool surface → Tasks 14–22 (one tool each, 11 total).
- §8 SKILL.md → Task 24.
- §9 Flows + error matrix → Task 24 (flow), Task 30 (error matrix).
- §10 Testing → Tasks 2,3,4,5,7,8,9,10,11,12,13,22 each ship a test; Task 13 is the fixture canary.
- §11 Security → Task 3 (0700 perms), Task 11 (no-log test), Task 24 (never-place-order), Task 29 (review.md the-stop).
- §12 Extensibility → hooks live in config (Task 1) and `recipes.ts` (Task 12).

**2. Placeholder scan** — no "TBD", "TODO", "implement later". Every code step shows the code.

**3. Type consistency:**
- `Cart`, `CartItem`, `Staple`, `Preferences`, `PreferenceOverrides`, `Session`, `SubstitutionFlag`, `HistoryEntry` — defined once in `src/memory/schemas.ts` (Task 4), re-used everywhere downstream.
- `runFoo(deps, input)` naming consistent across all 11 tools.
- `InstacartConfig` shape threaded through `record_cart`, `rank_stores`, `detect_staples`, `resolve_login_code`.
- Tool input types use typebox (`Type.Object({...})`); persisted JSON uses zod. Boundary is clean.
- `historyEntry.reason` enum (`one_shot_confirm | n_consistent_overrides | manual`) ≠ `update_preference.reason` input enum (`pending | one_shot_confirm | manual`) — matches DESIGN.md §6.

**4. Explicit non-negotiables:**
- No `place_order` tool anywhere.
- No "place order" instruction in SKILL.md or any reference.
- `review.md` explicitly declines if the user asks the agent to place.

---

## Execution Handoff

Plan complete and saved to `~/Desktop/Repos/instacart-browser/PLAN.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
