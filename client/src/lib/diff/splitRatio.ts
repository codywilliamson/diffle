export const MIN_SPLIT_RATIO = 20;
export const MAX_SPLIT_RATIO = 80;
export const DEFAULT_SPLIT_RATIO = 50;

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPLIT_RATIO;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}
