# diffle demos

Product demo footage for diffle. This is an **isolated, build-only package** (its own
`package.json`, like `web/`) — React and Remotion are demo dependencies and never touch the
app's runtime deps.

The pipeline captures **real product states** and composites them; it never hand-authors UI
that could drift from the shipping app.

```
capture (Playwright)                 composite (Remotion)
─────────────────────                ────────────────────
launch the real diffle backend       import public/captures/*.png
against a throwaway git fixture   →   ken-burns + captions + bookends   →  out/walkthrough.{mp4,gif}
screenshot each review scene          (timing from src/scenes.ts)          → published to the site + docs
```

## Layout

- `src/scenes.ts` — the single source of truth: scene ids, captions, hold times, fps/size.
- `src/capture.ts` — Playwright driver: drives one review and screenshots each scene.
- `src/lib/backend.ts` — launches the real backend against a temp fixture (mirrors `e2e/harness.ts`).
- `src/lib/fixture.ts` — the deterministic diff shown in the demo.
- `src/Root.tsx` / `src/ReviewWalkthrough.tsx` / `src/components/` — the Remotion composition.
- `scripts/publish-media.mjs` — copies the final renders + stills into `docs/screenshots/` and `web/public/media/`.

## Run

Prereq: build the app client once so the backend serves the current UI:

```bash
cd .. && bun run client:build && cd demos
npm install
```

Then, from `demos/`:

```bash
npm run capture        # → public/captures/*.png  (real product screenshots)
npm run render         # → out/walkthrough.mp4 + out/walkthrough.gif
npm run publish-media  # → copies into docs/screenshots/ and web/public/media/
# or all three:
npm run build
npm run studio         # interactive Remotion preview while iterating
```

`public/captures/` and `out/` are gitignored intermediate media. Only the published copies
under `docs/screenshots/` and `web/public/media/` are committed.

> Node only — never run the capture under Bun (Playwright + Bun on Windows hangs).
