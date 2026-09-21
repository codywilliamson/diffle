// plays one recorded take: the raw footage with screen-studio zoom windows and silent lower-third
// captions layered on. all timing/rects come from the take's <id>.json (see meta.ts).
import { AbsoluteFill, OffthreadVideo, staticFile, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { ZoomSegment, Caption } from "../meta";
import { THEME } from "../theme";

const RAMP = 0.55; // seconds to ease a zoom in / out
const DEFAULT_SCALE = 1.7;

export interface TakeProps {
  src: string;
  zooms: ZoomSegment[];
  captions: Caption[];
}

export function Take({ src, zooms, captions }: TakeProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = frame / fps;

  // combine disjoint zoom windows: each contributes 0 outside its window, so summing is safe.
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  let scale = 1;
  let tx = 0;
  let ty = 0;
  for (const z of zooms) {
    const S = z.scale ?? DEFAULT_SCALE;
    const p = interpolate(s, [z.inSec, z.inSec + RAMP, z.outSec, z.outSec + RAMP], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    if (p <= 0) continue;
    const cx = z.rect.x + z.rect.width * 0.34;
    const cy = z.rect.y + z.rect.height * 0.35;
    const txFull = clamp(width / 2 - cx * S, width - width * S, 0);
    const tyFull = clamp(height / 2 - cy * S, height - height * S, 0);
    scale += (S - 1) * p;
    tx += txFull * p;
    ty += tyFull * p;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg, overflow: "hidden" }}>
      <div style={{ width, height, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        <OffthreadVideo src={staticFile(src)} style={{ width, height }} />
      </div>
      {captions.map((c, i) => (
        <CaptionBar key={i} caption={c} />
      ))}
    </AbsoluteFill>
  );
}

function CaptionBar({ caption }: { caption: Caption }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const opacity = interpolate(s, [caption.fromSec, caption.fromSec + 0.3, caption.toSec - 0.3, caption.toSec], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 48, pointerEvents: "none" }}>
      <div
        style={{
          opacity,
          backgroundColor: "rgba(11,14,22,0.86)",
          borderLeft: `3px solid ${THEME.accent}`,
          color: THEME.text,
          fontFamily: THEME.fontFamily,
          fontSize: 27,
          fontWeight: 600,
          letterSpacing: -0.2,
          padding: "13px 22px",
          borderRadius: 11,
          backdropFilter: "blur(3px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        {caption.text}
      </div>
    </AbsoluteFill>
  );
}
