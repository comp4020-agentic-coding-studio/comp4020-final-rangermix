import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// The client and server come from one build: Vite stamps an id into the client
// and writes it next to index.html, where the server reads it, so a tab left
// open across a deploy reloads (design.md, "Real-time").
const buildId = process.env.BUILD_ID ?? Date.now().toString(36);

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  server: {
    fs: { allow: [".."] },
    proxy: {
      "/api": "http://localhost:8080",
      "/readme": "http://localhost:8080",
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
  plugins: [
    {
      name: "write-build-id",
      writeBundle(options) {
        writeFileSync(resolve(options.dir ?? "dist", "build-id.txt"), buildId);
      },
    },
  ],
});
