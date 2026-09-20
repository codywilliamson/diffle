// Registers the RadarDemo composition. The recorder's timeline (passed as an input prop at render
// time) sets the clip length; width/height/fps match the 1920x1080 30fps recording.
import React from "react";
import { Composition } from "remotion";
import { DemoClip, type Timeline } from "./DemoClip";

const EMPTY: Timeline = {
  fps: 30,
  video: { width: 1920, height: 1080 },
  durationMs: 30000,
  cursor: [],
  clicks: [],
  camera: [],
  captions: [],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RadarDemo"
    component={DemoClip}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ timeline: EMPTY }}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round((props.timeline.durationMs / 1000) * 30)),
      fps: 30,
      width: 1920,
      height: 1080,
    })}
  />
);
