// diffle "hunk" mark, frame-driven so renders stay deterministic: the context lines draw in,
// then the reviewed band sweeps across. geometry mirrors client/public/favicon.svg.
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "../theme";

const LINE_DELAY = 3;
const BAND_DELAY = 10;

export function Mark({ size, delay = 0 }: { size: number; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = (at: number) =>
    spring({ frame: frame - delay - at, fps, config: { damping: 200 }, durationInFrames: 18 });
  const scaleFromLeft = (s: number) => ({ transformBox: "fill-box" as const, transformOrigin: "0% 50%", transform: `scaleX(${s})` });

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6.5" stroke={THEME.text} strokeWidth="2" />
      <rect x="8.5" y="9" width="11" height="2.75" rx="1.375" fill={THEME.text} fillOpacity="0.55" style={scaleFromLeft(grow(0))} />
      <rect x="7" y="13.75" width="18" height="4.5" rx="2.25" fill={THEME.accent} style={scaleFromLeft(grow(BAND_DELAY))} />
      <rect x="8.5" y="20.25" width="7.5" height="2.75" rx="1.375" fill={THEME.text} fillOpacity="0.55" style={scaleFromLeft(grow(LINE_DELAY))} />
    </svg>
  );
}
