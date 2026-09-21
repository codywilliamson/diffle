# diffle demos

Product demo footage for diffle. This is an **isolated, build-only package** (its own
`package.json`, like `web/`) — React and Remotion are demo dependencies and never touch the
app's runtime deps.

Everything is captured from the **real running app** and composited; nothing hand-authors UI
that could drift from the shipping product. Two pipelines share the same live-backend harness:

```
VIDEO (record.ts)                              STILLS (capture.ts)
─────────────────                              ───────────────────
drive the real app with a visible cursor       screenshot each review state
+ paced typing, one take per driver        →   (overview, comment, side-by-side, …)
record video + zoom/caption metadata           → docs/screenshots/*.png (guide images)
    │
    ▼  Remotion (Take + LongReel)
per-take shorts + one stitched reel, with
screen-studio zooms, silent captions,      →   docs/screenshots/walkthrough.{mp4,gif}
and branded intro/outro                        web/public/media/walkthrough.mp4 (site hero)
```

## Layout

- `src/scenes.ts` — dimensions/fps + the stills scene list.
- `src/drivers.ts` — one driver per take: scripts real interactions, returns zoom windows + captions.
- `src/record.ts` — runs each driver in its own recording (fresh backend/fixture) → `public/footage/<id>.{webm,json}`.
- `src/capture.ts` — the stills pipeline (screenshots for the docs guide images).
- `src/lib/` — `backend.ts` (launches the real backend on a temp fixture), `fixture.ts` (the deterministic diff).
- `src/meta.ts` — shared metadata shapes (rects, zoom segments, captions).
- `src/takes/Take.tsx` — Remotion: plays a take's footage with its zooms + captions.
- `src/LongReel.tsx` — intro + every take + outro, stitched.
- `src/components/TitleCard.tsx` — branded bookends. `src/theme.ts` — D5 tokens.
- `scripts/render.mjs` — renders the shorts, the reel, and the README gif.
- `scripts/publish-media.mjs` — copies the final renders + stills into `docs/screenshots/` and `web/public/media/`.

## Run

Prereq: build the app client once so the backend serves the current UI:

```bash
cd .. && bun run client:build && cd demos
npm install
```

Then, from `demos/`:

```bash
npm run capture         # → public/captures/*.png   (stills for docs guides)
npm run record          # → public/footage/*.{webm,json}   (real motion takes)
npm run record comment  # …or a single take by id
npm run render          # → out/*.mp4 shorts + out/walkthrough.{mp4,gif}
npm run publish-media   # → copies finals into docs/screenshots/ and web/public/media/
npm run build           # all four in order
npm run studio          # interactive Remotion preview while iterating
```

`public/captures/`, `public/footage/`, and `out/` are gitignored intermediate media. Only the
published copies under `docs/screenshots/` and `web/public/media/` are committed.

> Node only — never run capture/record under Bun (Playwright + Bun on Windows hangs).
