import { untrack } from "svelte";
import { getAppState } from "./context";

// keep the cursor on its line (or the nearest one) whenever a fresh diff lands. call during init.
export function useCursorReconcile(): void {
  const { diff, cursor } = getAppState();
  $effect(() => {
    void diff.files;
    untrack(() => cursor.reconcile());
  });
}
