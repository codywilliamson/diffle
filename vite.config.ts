import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const rootDir = import.meta.dirname;
export const clientDir = resolve(rootDir, "client");

// the client's allowed cross-boundary aliases: shared contracts/identity and its own $lib.
export const aliases = {
  // the single shared client/server contract — never redefine these shapes
  $types: resolve(rootDir, "src/types.ts"),
  // the single user-facing product identity source
  $product: resolve(rootDir, "src/core/product.ts"),
  $lib: resolve(clientDir, "src/lib"),
};

// dev proxies /api to the real bun review backend; `bun run dev` sets DIFFLE_API_TARGET.
const apiTarget = process.env.DIFFLE_API_TARGET ?? "http://localhost:0";

export default defineConfig({
  root: clientDir,
  plugins: [tailwindcss(), svelte()],
  resolve: { alias: aliases },
  server: {
    // allow importing shared contracts and identity that live outside the vite root
    fs: { allow: [rootDir] },
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
  build: {
    outDir: resolve(rootDir, "dist/client"),
    emptyOutDir: true,
  },
});
