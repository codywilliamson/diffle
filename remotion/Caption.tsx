// Caption cards in canvas space (unaffected by the camera). Placement keeps them clear of the
// evidence drawer (right) and proof rows. Each span fades in and out at its edges.
import React from "react";
import { interpolate } from "remotion";
import type { CaptionSpan } from "./camera";

const FADE = 200;

const font = '"DM Sans","Segoe UI",system-ui,-apple-system,sans-serif';

function place(placement: CaptionSpan["placement"]): React.CSSProperties {
  if (placement === "top") return { top: 70, left: "50%", transform: "translateX(-50%)", maxWidth: 1200 };
  if (placement === "left") return { bottom: 76, left: 96, textAlign: "left", maxWidth: 760 };
  return { bottom: 76, left: "50%", transform: "translateX(-50%)", maxWidth: 1200 };
}

export const Caption: React.FC<{ captions: CaptionSpan[]; frame: number; fps: number }> = ({
  captions,
  frame,
  fps,
}) => {
  const t = (frame / fps) * 1000;
  const span = captions.find((c) => t >= c.t && t < c.end);
  if (!span) return null;
  const opacity = interpolate(t, [span.t, span.t + FADE, span.end - FADE, span.end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(t, [span.t, span.t + FADE], [12, 0], { extrapolateRight: "clamp" });
  const base = place(span.placement);
  return (
    <div
      style={{
        position: "absolute",
        ...base,
        transform: `${base.transform ?? ""} translateY(${rise}px)`.trim(),
        opacity,
        padding: "20px 34px",
        borderRadius: 16,
        background: "rgba(24,24,23,0.82)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        color: "#f4f2ea",
        font: `600 34px/1.35 ${font}`,
        letterSpacing: "-0.01em",
      }}
    >
      {span.text}
    </div>
  );
};
