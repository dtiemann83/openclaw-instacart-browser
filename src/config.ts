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
  loginEmail: z.string().default("chef@tiemannfamily.us"),
  auth: authSchema.default({}),
  staples: staplesSchema.default({}),
  ranking: rankingSchema.default({}),
}).strict();

export type InstacartConfig = z.infer<typeof configSchema>;

function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function loadConfig(raw: unknown): InstacartConfig {
  const parsed = configSchema.parse(raw ?? {});
  return { ...parsed, dataDir: expandHome(parsed.dataDir) };
}

export const DEFAULT_CONFIG: InstacartConfig = loadConfig({});
