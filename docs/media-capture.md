# Regenerate the agent walkthrough media

The capture script builds an isolated Git repository, runs a real Claude Code edit, records the Loupe browser flow with Playwright, and produces the documentation assets.

## Install the capture tools

You need authenticated Claude Code, FFmpeg on `PATH`, and the Playwright Chromium build:

```text
bun install
bunx playwright install chromium
```

## Record the walkthrough

Run:

```text
bun run docs:capture-agent-walkthrough
```

The first run asks Claude Code to apply the review feedback and caches that verified edit under `out/`. Later runs reuse the cached result, reset the demo repository, and remain deterministic.

The command writes these files:

```text
docs/screenshots/agent-review-walkthrough.webm
docs/screenshots/agent-review-walkthrough.mp4
docs/screenshots/agent-review-walkthrough.gif
docs/screenshots/agent-review-walkthrough.png
```

The GIF is rendered at half speed so each review step remains readable in the README. The MP4 and WebM retain the capture's normal pacing.

## Record the Radar social demo

Set `OPENROUTER_API_KEY` in `.env`, then run `bun run docs:capture-radar-social`. It seeds an
isolated Git repository with a six-file agent change (one file carries a secret-shaped literal),
serves the production Radar flow, and records it live through OpenRouter with `typesafe/jev-1.13`.
Secret-shaped demo code is blocked locally and never transmitted, and the outbound packet never
contains the API key.

This is a **Playwright → Remotion** pipeline (record a clean flow, composite the polish in post):

- `bun run demo:record` drives real interactions and logs a motion timeline, writing a clean
  screencast to `remotion/public/radar.mp4` and `out/product-demo/timeline.json`.
- `bun run demo:render` composites the studio backdrop, floating window, zoom camera, vector
  cursor, and captions with Remotion, delivering `radar-social.mp4` (H.264, yuv420p, 30 fps,
  fast-start), `radar-social.webm` (VP9), and `radar-social.png` (poster) under `docs/screenshots/`.

The full architecture, how to add a flow, and requirements live in
[`docs/agents/product-demo.md`](agents/product-demo.md). The clip is 1920×1080, dark, silent, and
about 22–30 seconds — a deliberate product demo, not an automated test run. The recording carries
no overlays, so product UI and accessibility behavior are untouched.

If Chromium is missing, rerun `bunx playwright install chromium`. Remotion downloads a headless
Chrome shell on first render; set `DEMO_GL=swiftshader` if GPU rendering fails. If port `43128` is
occupied, stop the existing process before capturing again. The scripts never commit the demo repo.
