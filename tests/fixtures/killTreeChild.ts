// run by lspSecurity.test.ts under a PATH with a planted taskkill.cmd: starts a sleeper and kills it
import { killTreeNow } from "../../src/core/lsp/processGroup";

const sleeper = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdio: ["ignore", "ignore", "ignore"] });
killTreeNow(sleeper.pid);
await sleeper.exited;
console.log("killed");
