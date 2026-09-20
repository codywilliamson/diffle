// The studio composite: a gradient backdrop, the clean recording in a floating rounded window, a
// spring-eased zoom camera that pans/zooms the content inside that window, a crisp vector cursor,
// click ripples, and caption cards. The recording itself carries none of this — it is all rendered
// here at output resolution, which is why it reads as a product launch demo rather than a screen grab.
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { sampleCamera, sampleCursor } from "./camera";
import type { CaptionSpan, ClickKey, CameraKey, CursorKey } from "./camera";
import { Cursor } from "./Cursor";
import { Caption } from "./Caption";

export type Timeline = {
  fps: number;
  video: { width: number; height: number };
  durationMs: number;
  cursor: CursorKey[];
  clicks: ClickKey[];
  camera: CameraKey[];
  captions: CaptionSpan[];
};

const BASE = 0.94; // floating-window inset
const RIPPLE_MS = 460;
const BACKDROP = "radial-gradient(130% 120% at 50% -10%, #262624 0%, #161615 52%, #0d0d0c 100%)";

export const DemoClip: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame / fps) * 1000;

  const cam = sampleCamera(timeline.camera, frame, fps);
  const cur = sampleCursor(timeline.cursor, frame, fps);

  const Wd = width * BASE;
  const Hd = height * BASE;
  const S = cam.scale;
  const tx = Wd / 2 - S * ((cam.cx / width) * Wd);
  const ty = Hd / 2 - S * ((cam.cy / height) * Hd);
  const project = (vx: number, vy: number) => ({
    x: S * ((vx / width) * Wd) + tx,
    y: S * ((vy / height) * Hd) + ty,
  });

  const cursorWin = project(cur.x, cur.y);
  const ripples = timeline.clicks
    .filter((c) => t >= c.t && t <= c.t + RIPPLE_MS)
    .map((c) => ({ ...project(c.x, c.y), progress: (t - c.t) / RIPPLE_MS }));
  const lastClick = [...timeline.clicks].reverse().find((c) => t >= c.t && t - c.t < 180);
  const press = lastClick
    ? Math.min(1, Math.max(0.8, 0.8 + Math.abs(t - lastClick.t - 90) / 90 * 0.2))
    : 1;

  return (
    <AbsoluteFill style={{ background: BACKDROP }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: Wd,
            height: Hd,
            borderRadius: 18,
            overflow: "hidden",
            position: "relative",
            background: "#111110",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 50px 110px rgba(0,0,0,0.6), 0 12px 30px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ width: Wd, height: Hd, transform: `translate(${tx}px,${ty}px) scale(${S})`, transformOrigin: "0 0" }}>
            <OffthreadVideo src={staticFile("radar.mp4")} style={{ width: Wd, height: Hd }} />
          </div>
          <Cursor x={cursorWin.x} y={cursorWin.y} press={press} ripples={ripples} />
        </div>
      </AbsoluteFill>
      <Caption captions={timeline.captions} frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};
