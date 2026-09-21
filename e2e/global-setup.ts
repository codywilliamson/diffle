import { execSync } from "node:child_process";

// build the production client once so the tracer serves dist/client through the real backend.
export default function globalSetup(): void {
  execSync("bun run client:build", { stdio: "inherit" });
}
