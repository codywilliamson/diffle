// Records the demo's motion as data (never drawn into the recording): cursor keyframes, click
// pulses, camera keyframes, and caption spans. All times are ms from the clapperboard origin, so
// Remotion can composite the cursor/zoom/captions over the clean recording at output resolution.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class Timeline {
  constructor({ fps, width, height }) {
    this.fps = fps;
    this.video = { width, height };
    this.cursor = [];
    this.clicks = [];
    this.camera = [];
    this.captions = [];
    this.origin = 0;
  }

  // call once, immediately after the clapperboard is removed; all later times are relative to it.
  start() { this.origin = Date.now(); return this.now(); }
  now() { return Date.now() - this.origin; }

  cursorKey(t, x, y) { this.cursor.push({ t: Math.round(t), x: Math.round(x), y: Math.round(y) }); }
  click(t, x, y) { this.clicks.push({ t: Math.round(t), x: Math.round(x), y: Math.round(y) }); }
  cameraKey(t, cam) { this.camera.push({ t: Math.round(t), scale: cam.scale, cx: Math.round(cam.cx), cy: Math.round(cam.cy) }); }

  // captions run back-to-back: opening a new one closes the previous span at the same instant.
  caption(t, text, placement) {
    const prev = this.captions[this.captions.length - 1];
    if (prev && prev.end == null) prev.end = Math.round(t);
    this.captions.push({ t: Math.round(t), end: null, text, placement });
  }

  // close the final caption and record the total run length.
  finish(t) {
    const last = this.captions[this.captions.length - 1];
    if (last && last.end == null) last.end = Math.round(t);
    this.durationMs = Math.round(t);
  }

  write(path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
      fps: this.fps, video: this.video, durationMs: this.durationMs,
      cursor: this.cursor, clicks: this.clicks, camera: this.camera, captions: this.captions,
    }, null, 2));
  }
}
