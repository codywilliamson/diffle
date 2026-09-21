// the walkthrough composition: intro bookend, one SceneCard per real capture, outro bookend,
// and a thin top progress bar. all timing derives from scenes.ts.
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { SCENES, FPS, INTRO_SECONDS, OUTRO_SECONDS } from "./scenes";
import { THEME } from "./theme";
import { SceneCard } from "./components/SceneCard";
import { TitleCard } from "./components/TitleCard";

const introFrames = Math.round(INTRO_SECONDS * FPS);
const outroFrames = Math.round(OUTRO_SECONDS * FPS);
const sceneFrames = SCENES.map((s) => Math.round(s.seconds * FPS));

export const WALKTHROUGH_FRAMES =
  introFrames + sceneFrames.reduce((a, b) => a + b, 0) + outroFrames;

export function ReviewWalkthrough() {
  let offset = 0;
  const blocks: { from: number; duration: number; node: React.ReactNode }[] = [];

  blocks.push({
    from: offset,
    duration: introFrames,
    node: (
      <TitleCard
        title="a local git diff viewer"
        subtitle="review changes, comment, hand off to your agent"
        durationInFrames={introFrames}
      />
    ),
  });
  offset += introFrames;

  SCENES.forEach((scene, i) => {
    const duration = sceneFrames[i];
    blocks.push({
      from: offset,
      duration,
      node: (
        <SceneCard
          src={`captures/${scene.id}.png`}
          caption={scene.caption}
          durationInFrames={duration}
        />
      ),
    });
    offset += duration;
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
      <ProgressBar />
    </AbsoluteFill>
  );
}

function ProgressBar() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = Math.min(1, frame / durationInFrames);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", pointerEvents: "none" }}>
      <div style={{ height: 4, width: "100%", backgroundColor: "transparent" }}>
        <div style={{ height: 4, width: `${pct * 100}%`, backgroundColor: THEME.accent }} />
      </div>
    </AbsoluteFill>
  );
}
