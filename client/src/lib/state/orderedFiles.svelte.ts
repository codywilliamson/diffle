import type { DiffFile } from "$types";
import { getAppState } from "./context";
import { reviewOrder } from "$lib/diff/reviewOrder";

// the files in the order the active sidebar lists them. call during component init.
export function useOrderedFiles(): { readonly files: DiffFile[] } {
  const { diff, prefs, analysis } = getAppState();
  const files = $derived(prefs.fileOrder === "review" ? reviewOrder(diff.files, analysis.scorecard) : diff.files);
  return {
    get files() {
      return files;
    },
  };
}
