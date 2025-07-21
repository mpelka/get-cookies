import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],

    setupFiles: ["./vitest.setup.ts"],

    globals: true,

    environment: "node",

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "__mocks__/**/*"],
      thresholds: {
        functions: 70,
        lines: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
