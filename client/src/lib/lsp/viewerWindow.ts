// the read-only viewer draws a window of lines around its target instead of the whole file: a
// generated .d.ts can run to tens of thousands of lines, and one row per line would stall the page.

export const VIEWER_WINDOW_LINES = 3000;

export interface ViewerWindow {
  lines: string[];
  first: number; // 1-based number of lines[0]
  last: number; // 1-based number of the last drawn line
  total: number;
}

export function windowAround(content: string, target: number, size = VIEWER_WINDOW_LINES): ViewerWindow {
  const all = content.split(/\r?\n/);
  // a trailing newline is not another line
  if (all.length > 1 && all[all.length - 1] === "") all.pop();
  const total = all.length;
  const begin = Math.max(0, Math.min(target - 1 - Math.floor(size / 2), total - size));
  const start = Math.max(0, begin);
  const end = Math.min(total, start + size);
  return { lines: all.slice(start, end), first: start + 1, last: end, total };
}
