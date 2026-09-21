// shared shapes for the video pipeline: a recorded take's footage is paired with a <id>.json of
// this shape (emitted by record.ts, consumed by the Remotion Take component + the long reel).

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// a screen-studio-style zoom window: ease in to `rect` at inSec, hold, ease out by outSec.
export interface ZoomSegment {
  rect: Rect;
  inSec: number;
  outSec: number;
  scale?: number; // default 1.7
}

// a silent lower-third caption, shown [fromSec, toSec].
export interface Caption {
  text: string;
  fromSec: number;
  toSec: number;
}

export interface TakeMeta {
  id: string;
  durationSec: number;
  zooms: ZoomSegment[];
  captions: Caption[];
}
