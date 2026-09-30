export const MIN_SPLIT_RATIO = 20;
export const MAX_SPLIT_RATIO = 80;
export function clampSplitRatio(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value)) : 50;
}
