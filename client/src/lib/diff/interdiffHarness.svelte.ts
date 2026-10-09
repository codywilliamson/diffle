import { flushSync } from "svelte";
import type { InterdiffResponse } from "$types";
import { createInterdiff } from "./interdiff.svelte";

// test-only: runs the loader inside an effect root, since runes need a .svelte.ts module.
export function runInterdiff(enabled: boolean, fetcher: (path: string) => Promise<InterdiffResponse>) {
  let loader!: ReturnType<typeof createInterdiff>;
  const stop = $effect.root(() => {
    loader = createInterdiff(() => ({ path: "a.cs", enabled, version: 1 }), fetcher);
  });
  flushSync();
  return { loader, stop };
}
