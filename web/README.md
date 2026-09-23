# diffle docs site

The [diffle.dev](https://diffle.dev) site — an [Astro](https://astro.build) + [Starlight](https://starlight.astro.build) docs site, themed with the D5 tokens so it reads as one system with the app. It's a **separate package** from the app so its build-only dependencies never touch the app's narrow runtime deps.

## Develop

```sh
cd web
bun install
bun run dev       # local dev server with live reload
bun run build     # static build → web/dist
```

`bun run build`/`dev` first copy the repo-root `install.sh`/`install.ps1` and the client's brand icons (`client/public/favicon.svg`, `apple-touch-icon.png`) into `public/` (via `scripts/copy-shared-assets.mjs`), so the built site serves them at `/install`, `/install.ps1`, and as its favicon — `/install` is what `curl -fsSL https://diffle.dev/install | sh` hits. The originals stay the single source of truth; the copies under `public/` are generated and gitignored.

## Deploy — Cloudflare Pages

Two options. **The Git integration is recommended for this public repo** because it needs no secrets in the repository at all.

### Option A — Cloudflare Pages Git integration (recommended, zero secrets)

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, pick this repo and set:

| setting | value |
| --- | --- |
| Production branch | `main` |
| Build command | `cd web && bun install && bun run build` |
| Build output directory | `web/dist` |
| Root directory | `/` (repo root) |

Then map the custom domain `diffle.dev` to the Pages project. Cloudflare rebuilds on every push to `main` — no API tokens, no GitHub secrets. This is the simplest and safest path for a public repo.

### Option B — GitHub Actions + Wrangler (CI-gated deploys)

If you'd rather deploy from CI (e.g. to gate on the app's tests first), use [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action) with `wrangler pages deploy web/dist`. It needs two **GitHub repository secrets**:

- `CLOUDFLARE_API_TOKEN` — a scoped token with **Account → Cloudflare Pages → Edit** only
- `CLOUDFLARE_ACCOUNT_ID`

**On secrets in a public repo:** GitHub encrypts repository secrets and does **not** expose them to workflows triggered by pull requests from forks, so a public repo is safe as long as the deploy job runs on `push` to `main` (not on `pull_request` from forks) and the token is minimally scoped. Rotate the token if it's ever printed to logs. Given that, Option A is still preferable here since it keeps zero credentials in the repo.
