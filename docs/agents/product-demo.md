# Product demo capture

Turns a real Loupe flow into a polished, launch-quality demo video. The look — a floating window
on a studio backdrop, spring-eased zoom-on-action, motion-free but crisp vector cursor, and clean
caption cards — comes from the industry-standard pattern: **record a clean flow, composite the
polish in post.** Nothing is drawn into the recording.

## Two phases

1. **Record** (`scripts/demo-record.mjs`, Playwright): seeds the isolated repo, serves Loupe with
   live Jev, and drives real interactions (`scripts/product-demo/radar-flow.mjs`). It never injects
   overlays; instead it logs cursor / camera / caption / click events to `out/product-demo/
   timeline.json` and records a clean 1920×1080 screencast. A pure-black **clapperboard** frame
   marks the timeline origin so post can sync frame-accurately. It trims + normalises the footage to
   `remotion/public/radar.mp4`.
2. **Composite** (`scripts/demo-render.mjs` + `remotion/`, Remotion): renders the studio backdrop,
   the floating window, the zoom camera, the vector cursor, click ripples, and captions over the
   clean recording at output resolution, then delivers `docs/screenshots/radar-social.{mp4,webm,png}`
   (H.264 yuv420p 30fps fast-start, VP9, and a poster still).

```text
bun run docs:capture-radar-social   # record + render (needs OPENROUTER_API_KEY in .env)
bun run demo:record                 # phase 1 only (re-run when the flow changes)
bun run demo:render                 # phase 2 only (fast iteration on the compositor)
```

## Why it's split this way

The recording carries no cursor, no zoom, no captions — so the cursor is a vector at output
resolution (never a blurry screen-grab pointer), the camera zooms clean pixels with no reflow, and
every element stays crisp. Because there is no in-page transform, real clicks always land on
on-screen controls (the old baked-overlay approach pushed buttons off-frame).

## Adding or changing a flow

- The choreography lives in `scripts/product-demo/radar-flow.mjs` and uses the primitives in
  `actions.mjs`: `moveTo` / `hoverFor` / `click` (real interactions), `focus` / `reset` (the
  post-production camera), and `caption`. Target **selectors**, never screen coordinates.
- Before clicking a control that sits at the edge of a zoomed region (e.g. the drawer's Evidence or
  Close button), `reset` the camera so it stays inside the output frame.
- Captions run back-to-back; each stays up while the beat's motion plays (that motion is the read
  time). Use `placement: "left"` when the evidence drawer occupies the right.
- The compositor is `remotion/DemoClip.tsx` (backdrop + window + camera + cursor + captions), with
  `remotion/camera.ts` interpolating the tracks. Keep every module ≤200 lines.

## Requirements

`OPENROUTER_API_KEY` in `.env` (live Jev), FFmpeg on `PATH`, the Playwright Chromium build
(`bunx playwright install chromium`), and the Remotion dev dependencies (installed). Remotion
downloads a headless Chrome shell on first render. Run the scripts with `node`, not Bun. Set
`DEMO_GL=swiftshader` if GPU rendering fails in a headless environment.
