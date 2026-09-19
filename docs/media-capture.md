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

Set `OPENROUTER_API_KEY` in `.env`, then run `bun run docs:capture-radar-social`. The
script creates an isolated Git repository and captures the production Radar flow using
live Jev decisions through OpenRouter; secret-shaped demo code remains local.
It writes `radar-social.mp4`, `radar-social.webm`, and `radar-social.png` under
`docs/screenshots/`. The clip is 1920×1080, silent, under 60 seconds, and includes
text overlays for timeline viewing without audio.

If Chromium is missing, rerun `bunx playwright install chromium`. If port `43127` is occupied, stop the existing process before capturing again. The script never commits the generated demo repository.
