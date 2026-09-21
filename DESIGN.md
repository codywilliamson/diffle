# Design

The design system lives in [`docs/diffle/design.md`](docs/diffle/design.md) — the D5
blended-indigo, dark-first brand and its canonical light/dark semantic variables.

The old warm "proof desk" palette that used to live here was retired (it read too close
to Claude/Anthropic's own brand). Do not reintroduce it. `docs/diffle/design.md` is the
single source of truth for color, typography, and craft; the client's D5 variables in
`client/src/styles/tokens.css` implement it, and Tailwind/shadcn tokens alias those.
