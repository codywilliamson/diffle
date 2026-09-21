import { Composition } from "remotion";
import { ReviewWalkthrough, WALKTHROUGH_FRAMES } from "./ReviewWalkthrough";
import { FPS, WIDTH, HEIGHT } from "./scenes";

export function Root() {
  return (
    <Composition
      id="ReviewWalkthrough"
      component={ReviewWalkthrough}
      durationInFrames={WALKTHROUGH_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}
