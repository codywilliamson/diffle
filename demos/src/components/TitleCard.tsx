// intro / outro bookend: animated mark + wordmark + line, fading in and out over the brand background.
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { THEME } from "../theme";
import { Mark } from "./Mark";

export function TitleCard({
  title,
  subtitle,
  durationInFrames,
}: {
  title: string;
  subtitle: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 10, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pop = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });
  const scale = interpolate(pop, [0, 1], [0.94, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bg,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        fontFamily: THEME.fontFamily,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <Mark size={112} delay={4} />
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -3,
            color: THEME.text,
          }}
        >
          diffle
        </div>
        {subtitle && (
          <div style={{ marginTop: 14, fontSize: 30, color: THEME.muted, fontWeight: 500 }}>
            {subtitle}
          </div>
        )}
        <div
          style={{
            marginTop: 40,
            display: "inline-block",
            height: 2,
            width: 120,
            background: `linear-gradient(90deg, transparent, ${THEME.accent}, transparent)`,
          }}
        />
        {title && (
          <div style={{ marginTop: 22, fontSize: 22, color: THEME.muted, fontFamily: THEME.monoFamily }}>
            {title}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
