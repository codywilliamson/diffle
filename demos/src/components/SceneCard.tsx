// one walkthrough scene: a real product screenshot with a subtle ken-burns push and a
// fade at both edges (so neighbouring scenes cross-dissolve through the brand background),
// plus a lower-third caption pill.
import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { THEME } from "../theme";

const FADE = 12; // frames of fade in / out at each edge

export function SceneCard({
  src,
  caption,
  durationInFrames,
}: {
  src: string;
  caption: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, FADE, durationInFrames - FADE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg, opacity }}>
      <AbsoluteFill style={{ padding: 44 }}>
        <div
          style={{
            flex: 1,
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid ${THEME.border}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              transform: `scale(${scale})`,
              transformOrigin: "top center",
            }}
          />
        </div>
      </AbsoluteFill>

      <Caption text={caption} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
}

function Caption({ text, durationInFrames }: { text: string; durationInFrames: number }) {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [FADE, FADE + 10], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = interpolate(
    frame,
    [FADE, FADE + 10, durationInFrames - FADE - 6, durationInFrames - FADE],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 64 }}
    >
      <div
        style={{
          transform: `translateY(${rise}px)`,
          opacity: fade,
          backgroundColor: "rgba(20,24,38,0.92)",
          borderLeft: `3px solid ${THEME.accent}`,
          color: THEME.text,
          fontFamily: THEME.fontFamily,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: -0.2,
          padding: "16px 26px",
          borderRadius: 12,
          backdropFilter: "blur(4px)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
