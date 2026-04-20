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
