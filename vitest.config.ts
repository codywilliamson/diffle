import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { aliases, clientDir } from "./vite.config";

// client unit + component tests. the `browser` condition gives svelte's client build,
// which @testing-library/svelte needs to mount components under jsdom.
export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: aliases, conditions: ["browser"] },
  test: {
    root: clientDir,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
  },
});
