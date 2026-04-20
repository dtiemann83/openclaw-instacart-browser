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
