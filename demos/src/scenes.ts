// single source of truth for the demo: each scene's capture id, on-screen caption, and hold
// time. the playwright capture writes public/captures/<id>.png; the remotion composition
// sequences the same ids. keep this list and the capture steps in capture.ts in lockstep.

export interface Scene {
  id: string;
  caption: string;
  seconds: number;
}

export const SCENES: Scene[] = [
  { id: "overview", caption: "Review any local git diff", seconds: 3 },
  { id: "comment", caption: "Leave inline comments on the code", seconds: 3 },
  { id: "thread", caption: "Threads track exactly what to fix", seconds: 2.5 },
  { id: "side-by-side", caption: "Unified or side-by-side, your call", seconds: 2.5 },
  { id: "summary", caption: "Summarize the review", seconds: 2.5 },
  { id: "feedback", caption: "Export structured feedback for your agent", seconds: 3 },
];

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 800;

// bookend title cards, in seconds
export const INTRO_SECONDS = 2;
export const OUTRO_SECONDS = 2.5;
