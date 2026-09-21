import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server";
import { productEnv } from "../utils/env";
import type { McpRootProvider, ReviewOperations } from "./operations";

// stops every server this process launched exactly once, however the process ends
// (the client closing the stdio transport, or the process receiving a signal).
function stopAllOnce(operations: ReviewOperations): () => void {
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    operations.stopAll();
  };
}

export async function serveMcp(operations: ReviewOperations, roots: McpRootProvider, version?: string): Promise<void> {
  const server = createMcpServer(operations, roots, version);
  const stopAll = stopAllOnce(operations);
  server.server.onclose = stopAll;
  process.on("SIGINT", () => { stopAll(); process.exit(0); });
  process.on("SIGTERM", () => { stopAll(); process.exit(0); });
  process.on("exit", stopAll);
  await server.connect(new StdioServerTransport());
}

export function configuredRoots(fallback: string): McpRootProvider {
  const root = productEnv("ROOT");
  return { getRoots: async () => (root ? [root] : [fallback]) };
}
