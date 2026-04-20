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
