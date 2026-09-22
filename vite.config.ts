import { defineConfig, type ProxyOptions } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import type { IncomingMessage } from "node:http";
import { isLoopbackHttpOrigin } from "./src/utils/origin.ts";

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

function isDevUiOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin || req.socket.localPort === undefined) return false;
  try {
    const url = new URL(origin);
    return isLoopbackHttpOrigin(url, req.socket.localPort)
      && url.host === req.headers.host
      && origin === url.origin;
  } catch {
    return false;
  }
}

// vite rewrites Host for the backend; only requests from its own UI need Origin rewritten too.
function createApiProxy(target: string): ProxyOptions {
  const backendOrigin = new URL(target).origin;
  return {
    target,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq, req) => {
        if (isDevUiOrigin(req)) proxyReq.setHeader("origin", backendOrigin);
      });
    },
  };
}

export default defineConfig({
  root: clientDir,
  plugins: [tailwindcss(), svelte()],
  resolve: { alias: aliases },
  server: {
    // allow importing shared contracts and identity that live outside the vite root
    fs: { allow: [rootDir] },
    proxy: { "/api": createApiProxy(apiTarget) },
  },
  build: {
    outDir: resolve(rootDir, "dist/client"),
    emptyOutDir: true,
  },
});
