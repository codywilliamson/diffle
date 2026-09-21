import type { ComponentType } from "react";
import { Composition } from "remotion";
import { Take } from "./takes/Take";
import { LongReel, REEL_FRAMES } from "./LongReel";
import { TAKES } from "./takeList";
import { FPS, WIDTH, HEIGHT } from "./scenes";

// remotion can't infer per-take props through the dynamic map; the defaultProps object is built
// from typed TakeMeta, so a loose cast here is safe.
const TakeComp = Take as unknown as ComponentType<Record<string, unknown>>;

// one standalone short per take (id "take-<id>"), plus the stitched "LongReel".
export function Root() {
  return (
    <>
      {TAKES.map((t) => (
        <Composition
          key={t.id}
          id={`take-${t.id}`}
          component={TakeComp}
          durationInFrames={Math.round(t.durationSec * FPS)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ src: `footage/${t.id}.webm`, zooms: t.zooms, captions: t.captions }}
        />
      ))}
      <Composition id="LongReel" component={LongReel} durationInFrames={REEL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    </>
  );
}
