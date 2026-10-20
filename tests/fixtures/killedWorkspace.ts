// a run that dies mid-creation: `bun killedWorkspace.ts <repo> <ref> <add|link>` exits hard (no
// handlers, no cleanup) right before the worktree is added or right before it is linked.

import { LspWorkspace } from "../../src/core/lsp/workspace";

const [repo, ref, stage] = process.argv.slice(2);
const die = (): never => process.exit(137);
new LspWorkspace(repo!, stage === "add" ? { beforeAdd: die } : { beforeLink: die }).rootFor("new", ref!, 0);
