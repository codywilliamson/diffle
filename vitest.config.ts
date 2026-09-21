import { defineConfig } from "vitest/config";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { aliases, clientDir } from "./vite.config.ts";

// client unit + component tests. the `browser` condition gives svelte's client build,
// which @testing-library/svelte needs to mount components under jsdom. preprocess is
// passed inline because vitest runs from the repo root, where the client svelte.config
// is not auto-discovered.
export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  resolve: { alias: aliases, conditions: ["browser"] },
  test: {
    root: clientDir,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
  },
});
