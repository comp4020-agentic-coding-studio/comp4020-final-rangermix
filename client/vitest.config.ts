import { defineConfig } from "vitest/config";

// The client's own unit tests; spec/ (the root's Vitest) checks the running app.
export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify("test") },
  test: { include: ["test/**/*.test.ts"], environment: "jsdom" },
});
