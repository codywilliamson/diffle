import type { ChangeType } from "$types";

// letter + label + D5 token classes for a file's change kind, used by the index badge.
const BADGE: Record<ChangeType, { letter: string; label: string; cls: string }> = {
  added: { letter: "A", label: "Added", cls: "bg-add-gutter text-add-text" },
  modified: { letter: "M", label: "Modified", cls: "bg-mod-badge-bg text-mod-badge-text" },
  deleted: { letter: "D", label: "Deleted", cls: "bg-del-gutter text-del-text" },
  renamed: { letter: "R", label: "Renamed", cls: "bg-ren-badge-bg text-ren-badge-text" },
};

export function changeBadge(type: ChangeType): { letter: string; label: string; cls: string } {
  return BADGE[type] ?? { letter: "?", label: "Unknown", cls: "bg-surface-2 text-muted" };
}
