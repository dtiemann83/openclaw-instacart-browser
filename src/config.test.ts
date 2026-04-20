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
    expect(() => loadConfig({ bogus: 1 } as any)).toThrow(/unrecognized|unknown/i);
  });

  it("defaults maxAgeDays to undefined", () => {
    expect(DEFAULT_CONFIG.staples.maxAgeDays).toBeUndefined();
  });

  it("DEFAULT_CONFIG matches loadConfig({}) with expanded dataDir", () => {
    expect(DEFAULT_CONFIG.dataDir).toBe(loadConfig({}).dataDir);
    expect(DEFAULT_CONFIG.dataDir.startsWith("~")).toBe(false);
  });
});
