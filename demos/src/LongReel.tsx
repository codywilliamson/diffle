// the long UI reel: branded intro, every take, branded outro — stitched with crossfades between
// each segment (not hard cuts) so it reads as one cohesive piece. each take plays its own footage
// (with its zooms + captions) at its recorded duration.
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { TAKES } from "./takeList";
import { Take } from "./takes/Take";
import { TitleCard } from "./components/TitleCard";
import { FPS, INTRO_SECONDS, OUTRO_SECONDS } from "./scenes";
import { THEME } from "./theme";

const introFrames = Math.round(INTRO_SECONDS * FPS);
const outroFrames = Math.round(OUTRO_SECONDS * FPS);
const takeFrames = TAKES.map((t) => Math.round(t.durationSec * FPS));
const CROSSFADE = 18; // frames of crossfade at each boundary (~0.6s)

// transitions overlap adjacent segments, so the reel is shorter than the raw sum by one crossfade
// per boundary (intro + N takes + outro ⇒ N+1 boundaries).
const segmentFrames = [introFrames, ...takeFrames, outroFrames];
export const REEL_FRAMES = segmentFrames.reduce((a, b) => a + b, 0) - CROSSFADE * (segmentFrames.length - 1);

export function LongReel() {
  const children: ReactNode[] = [];
  const transition = (key: string) => (
    <TransitionSeries.Transition key={key} presentation={fade()} timing={linearTiming({ durationInFrames: CROSSFADE })} />
  );

  children.push(
    <TransitionSeries.Sequence key="intro" durationInFrames={introFrames}>
      <TitleCard title="a local git diff viewer" subtitle="review, comment, hand off to your agent" durationInFrames={introFrames} />
    </TransitionSeries.Sequence>,
  );

  TAKES.forEach((t, i) => {
    children.push(transition(`x-${t.id}`));
    children.push(
      <TransitionSeries.Sequence key={t.id} durationInFrames={takeFrames[i]}>
        <Take src={`footage/${t.id}.webm`} zooms={t.zooms} captions={t.captions} />
      </TransitionSeries.Sequence>,
    );
  });

  children.push(transition("x-outro"));
  children.push(
    <TransitionSeries.Sequence key="outro" durationInFrames={outroFrames}>
      <TitleCard title="diffle.dev" subtitle="" durationInFrames={outroFrames} />
    </TransitionSeries.Sequence>,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
}
