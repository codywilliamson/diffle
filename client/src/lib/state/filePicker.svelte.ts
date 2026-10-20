// Ctrl+p: a fuzzy picker over the changed files. the matcher is the symbol picker's, run over the
// whole path, so `kmp` style initials work across folders (`ak` finds app/keymap.ts).

import { rankByName } from "$lib/lsp/fuzzy";

export const MAX_PICKER_ROWS = 200;

export interface FilePickerDeps {
  files: () => string[];
  jump: (path: string) => void;
}

export interface PickerRow {
  path: string;
  indices: number[];
}

export function createFilePicker({ files, jump }: FilePickerDeps) {
  let open = $state(false);
  let query = $state("");
  let selected = $state(0);

  const rows = $derived<PickerRow[]>(
    open ? rankByName(files(), query, (path) => path).slice(0, MAX_PICKER_ROWS).map(({ item, match }) => ({ path: item, indices: match.indices })) : [],
  );

  return {
    get open(): boolean {
      return open;
    },
    get query(): string {
      return query;
    },
    get selected(): number {
      return selected;
    },
    get rows(): PickerRow[] {
      return rows;
    },
    show(): void {
      open = true;
      query = "";
      selected = 0;
    },
    close(): boolean {
      const was = open;
      open = false;
      return was;
    },
    setQuery(value: string): void {
      query = value;
      selected = 0;
    },
    move(delta: number): void {
      if (rows.length === 0) return;
      selected = Math.min(rows.length - 1, Math.max(0, selected + delta));
    },
    activate(index = selected): void {
      const row = rows[index];
      if (!row) return;
      open = false;
      jump(row.path);
    },
  };
}

export type FilePicker = ReturnType<typeof createFilePicker>;
