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
