# Rename loupe to diffle

"loupe" is too collided to carry a public OSS developer tool: the bare npm name is owned by `chaijs/loupe`, an active agent-review CLI uses the same name, and GNOME's image viewer is named Loupe. We rename the product to **diffle**, an invented `diff` + `-le` name carried under the backronym **Deterministic Inspection & Feedback Framework for Language-model Engineering**. The implementation name is decided; the public identity switch remains gated on registering the chosen domain, a software-trademark search, and securing `difflehq` or `usediffle` before the repository is renamed or a release is published.

Availability was rechecked on 2026-09-20: the npm package was unclaimed, `diffle.sh` returned no RDAP registration, `difflehq` and `usediffle` were unclaimed on GitHub, and the bare `/diffle` handle remained an unrelated user. These checks are time-sensitive and must run again at the public-release gate. A non-developer Wordle-style game also uses the name; that collision was accepted.

## Compatibility consequences

The rebrand must not strand existing Review Records, preferences, plugins, or scripts. `diffle` becomes the primary command, while a deprecated `loupe` command alias and legacy `LOUPE_*` environment variables remain supported for one minor release. New users store data under `~/.diffle`; an existing installation with `~/.loupe` and no `~/.diffle` keeps using the legacy directory without copying or deleting it. Browser preferences migrate from `loupe-*` to `diffle-*` keys on first read.

One machine-readable product configuration supplies runtime labels, binary/package names, manifest metadata, and URLs to generation or validation scripts. Prose is updated deliberately rather than generated. External changes such as domain registration, organization creation, repository rename, deployment, and release remain explicit user actions.
