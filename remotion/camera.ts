// Samples the recorded motion tracks at a given frame. Each move is a keyframe pair spanning its
// duration, so eased interpolation between neighbours yields smooth zooms and cursor glides; holds
// (equal-valued neighbours) stay put. Pure functions — no React.
import { Easing, interpolate } from "remotion";

export type CameraKey = { t: number; scale: number; cx: number; cy: number };
export type CursorKey = { t: number; x: number; y: number };
export type ClickKey = { t: number; x: number; y: number };
export type CaptionSpan = { t: number; end: number; text: string; placement: "bottom" | "top" | "left" };

const ease = Easing.bezier(0.4, 0, 0.2, 1);

function segment<T extends { t: number }>(keys: T[], tMs: number): [T, T, number] | null {
  if (keys.length === 0) return null;
  if (tMs <= keys[0].t) return [keys[0], keys[0], 0];
  const last = keys[keys.length - 1];
  if (tMs >= last.t) return [last, last, 1];
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= tMs) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  return [a, b, span === 0 ? 1 : (tMs - a.t) / span];
}

function lerp(a: number, b: number, p: number): number {
  return interpolate(p, [0, 1], [a, b], { easing: ease });
}

export function sampleCamera(keys: CameraKey[], frame: number, fps: number): CameraKey {
  const seg = segment(keys, (frame / fps) * 1000);
  if (!seg) return { t: 0, scale: 1, cx: 960, cy: 540 };
  const [a, b, p] = seg;
  return { t: 0, scale: lerp(a.scale, b.scale, p), cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p) };
}

export function sampleCursor(keys: CursorKey[], frame: number, fps: number): { x: number; y: number } {
  const seg = segment(keys, (frame / fps) * 1000);
  if (!seg) return { x: 960, y: 540 };
  const [a, b, p] = seg;
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
}
