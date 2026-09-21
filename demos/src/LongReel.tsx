// the long UI reel: branded intro, every take stitched in order, branded outro. each take plays
// its own footage (with its zooms + captions) inside a Sequence at its recorded duration.
import { AbsoluteFill, Sequence } from "remotion";
import { TAKES } from "./takeList";
import { Take } from "./takes/Take";
import { TitleCard } from "./components/TitleCard";
import { FPS, INTRO_SECONDS, OUTRO_SECONDS } from "./scenes";
import { THEME } from "./theme";

const introFrames = Math.round(INTRO_SECONDS * FPS);
const outroFrames = Math.round(OUTRO_SECONDS * FPS);
const takeFrames = TAKES.map((t) => Math.round(t.durationSec * FPS));

export const REEL_FRAMES = introFrames + takeFrames.reduce((a, b) => a + b, 0) + outroFrames;

export function LongReel() {
  const blocks: { from: number; duration: number; node: React.ReactNode }[] = [];
  let offset = 0;

  blocks.push({
    from: 0,
    duration: introFrames,
    node: <TitleCard title="a local git diff viewer" subtitle="review, comment, hand off to your agent" durationInFrames={introFrames} />,
  });
  offset += introFrames;

  TAKES.forEach((t, i) => {
    blocks.push({
      from: offset,
      duration: takeFrames[i],
      node: <Take src={`footage/${t.id}.webm`} zooms={t.zooms} captions={t.captions} />,
    });
    offset += takeFrames[i];
  });

  blocks.push({
    from: offset,
    duration: outroFrames,
    node: <TitleCard title="diffle.dev" subtitle="one self-contained binary" durationInFrames={outroFrames} />,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      {blocks.map((b, i) => (
        <Sequence key={i} from={b.from} durationInFrames={b.duration}>
          {b.node}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
