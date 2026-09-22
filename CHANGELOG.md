# Changelog

All notable changes to diffle are documented here. This project follows [semantic versioning](https://semver.org).

## [0.20.1](https://github.com/codywilliamson/diffle/compare/v0.20.0...v0.20.1) (2026-09-22)


### Bug Fixes

* **build:** build release PR after publishing assets ([b7e2604](https://github.com/codywilliamson/diffle/commit/b7e26041af4306ecce09ad5c3a82c87ee234ef24))
* **server:** preserve dev proxy post origin guard ([b0c9b9a](https://github.com/codywilliamson/diffle/commit/b0c9b9a11e83b00c2264da5613260cb24d212f71))
* **server:** reject cross-origin post requests ([0e5be0b](https://github.com/codywilliamson/diffle/commit/0e5be0b6fd269097570892b758c19375f0ce3861))
* **server:** validate post origin against listener ([3fabcca](https://github.com/codywilliamson/diffle/commit/3fabccad1305e0c43262e374773a2bf1834e9aac))

## [0.20.0](https://github.com/codywilliamson/diffle/compare/v0.19.1...v0.20.0) (2026-09-22)


### Features

* **cli:** add mcp list and mcp restart ([f3f682f](https://github.com/codywilliamson/diffle/commit/f3f682f43eb673bbd21def5d0007d0ed16579588))
* **cli:** stop old mcp servers after update when no review is live ([ca2bec2](https://github.com/codywilliamson/diffle/commit/ca2bec2dc106db12e0bc11c102e16c4e3905ce65))


### Bug Fixes

* **cli:** swap the windows binary while mcp servers hold it open ([83108a0](https://github.com/codywilliamson/diffle/commit/83108a0260af0dcf1268549fceec3e0b3ca0f86d))

## [0.19.1](https://github.com/codywilliamson/diffle/compare/v0.19.0...v0.19.1) (2026-09-22)


### Bug Fixes

* **build:** stop the windows installer cleanly when diffle is running ([4aa86a2](https://github.com/codywilliamson/diffle/commit/4aa86a2424a2b6946db1c9d8ca5bb090a32ca703))
* **tests:** pin diff fixtures to lf line endings ([7cc550e](https://github.com/codywilliamson/diffle/commit/7cc550e4f870d96f4278d05c2f9d93c8f0bd0e27))

## [0.19.0](https://github.com/codywilliamson/diffle/compare/v0.18.0...v0.19.0) (2026-09-22)


### Features

* **cli:** announce new releases at launch and add update --check ([c823027](https://github.com/codywilliamson/diffle/commit/c823027371065128c2584f1c871b788365583f49))
* **ui:** polish comment box accessibility and spacing ([f31ed64](https://github.com/codywilliamson/diffle/commit/f31ed643c18385d7e3bd1349bc9efdb3dea09623))

## [0.18.0](https://github.com/codywilliamson/diffle/compare/v0.17.1...v0.18.0) (2026-09-22)


### Features

* **cli:** add diffle doctor for stale loupe-review plugins ([a4c7591](https://github.com/codywilliamson/diffle/commit/a4c7591814a3c8a29cda97f4e96263bd2adc43ae)), closes [#45](https://github.com/codywilliamson/diffle/issues/45)

## [0.17.1](https://github.com/codywilliamson/diffle/compare/v0.17.0...v0.17.1) (2026-09-22)


### Bug Fixes

* **build:** persist path and add leveled output in install.sh ([d983315](https://github.com/codywilliamson/diffle/commit/d98331527cc41cb1643f12a0a3453c62209b8d00)), closes [#39](https://github.com/codywilliamson/diffle/issues/39)
* **build:** revamp install.ps1 path handling and logging ([afba01f](https://github.com/codywilliamson/diffle/commit/afba01f0c3350e71ae221fc067b75932165fb919)), closes [#38](https://github.com/codywilliamson/diffle/issues/38)

## [0.17.0](https://github.com/codywilliamson/diffle/compare/v0.16.0...v0.17.0) (2026-09-22)


### Features

* add durable agent review workflow ([077a6de](https://github.com/codywilliamson/diffle/commit/077a6de84631cbc79ec1774abdfa12f5a98cdf84))
* **build:** installer scripts + Release Please release workflow ([83146cf](https://github.com/codywilliamson/diffle/commit/83146cfee0d397f8db1804126e75ceca9412ce85))
* **build:** set diffle.dev as the product homepage ([31a9bac](https://github.com/codywilliamson/diffle/commit/31a9bac4e7799eea3dee8fa0cd58d912baa28bb7))
* **cli:** --help, --version, --port, --no-open flags and a styled launch banner ([8e7a889](https://github.com/codywilliamson/diffle/commit/8e7a8893b6f428f6f05daed634dba5f75b2d4536))
* **cli:** add 'diffle update' to self-install the latest release ([92865a5](https://github.com/codywilliamson/diffle/commit/92865a5f18e1702d3797824ed8077d37d0154e90))
* **client:** compose domain stores via typed context ([da96cb4](https://github.com/codywilliamson/diffle/commit/da96cb4f68aed0b533d801efdfd337e09aace9f8))
* **client:** d5 design tokens, tailwind/shadcn aliases, themed surfaces ([534625b](https://github.com/codywilliamson/diffle/commit/534625b5588a01438de38379871337a094461447))
* **client:** diff rune store (load/refresh, keep-last-good) ([e8544dc](https://github.com/codywilliamson/diffle/commit/e8544dc4bb805e70413f3cd03a8d876d642231cd))
* **client:** prefs rune store with key + theme migration ([ae9edbd](https://github.com/codywilliamson/diffle/commit/ae9edbd26e93e97bf5298be32f9e7b2314f327ee))
* **client:** pure diff transforms — tree, word ranges, anchor reuse ([795e93d](https://github.com/codywilliamson/diffle/commit/795e93dd59b7a5a06381306528d18e94ab3147fa))
* **client:** review + comments rune stores ([5f79ead](https://github.com/codywilliamson/diffle/commit/5f79ead1988c79cd936b12dd1d75db7d8db056f2))
* **client:** shell renders loading, diff context, and error states ([6fd6b26](https://github.com/codywilliamson/diffle/commit/6fd6b26fba162511288dcec45a6c39616497ad14))
* **client:** typed /api/diff adapter with server error text ([610c3c8](https://github.com/codywilliamson/diffle/commit/610c3c848376321a08bcde9cd0cecf5f6d10fb00))
* **client:** typed adapters for every browser endpoint ([6d4e0cd](https://github.com/codywilliamson/diffle/commit/6d4e0cdffd9d68dd58c38355d7e33cb73283cd4d))
* **client:** ui rune store (overlays, selection, drawer) ([48cef99](https://github.com/codywilliamson/diffle/commit/48cef99b10270cd7cefb5c308f6787de209e13bd))
* **client:** viewed toggle + per-file unresolved counts ([65850d2](https://github.com/codywilliamson/diffle/commit/65850d229d6c7572bd44c18b2e35e207453e7b0d))
* **cli:** expose a global loupe bin and summarize the review in the launch banner ([ce9f0b6](https://github.com/codywilliamson/diffle/commit/ce9f0b6bc5337cc2280550c56643d5a3f6825069))
* **cli:** launch browse mode from the entry point ([3b61a66](https://github.com/codywilliamson/diffle/commit/3b61a666e3a469a620b9bd7bcb60e76561bb0401))
* **cli:** parse the browse command and optional path scope ([5e1ce83](https://github.com/codywilliamson/diffle/commit/5e1ce83547204105a40685ce7731cf8261468e02))
* **cli:** rebrand to diffle with a loupe-compatible command + product config ([cc88de2](https://github.com/codywilliamson/diffle/commit/cc88de2ea8e0d85d0771e631f13f0d37399088da))
* **cli:** resolve refs, run diff, serve, and open browser ([af7b389](https://github.com/codywilliamson/diffle/commit/af7b38936cfba87290dc3ec162a676797593f09c))
* **cli:** session registry with sessions and cleanup commands ([14a9e1a](https://github.com/codywilliamson/diffle/commit/14a9e1a326932bfea84bf09abb62cc22296f6884)), closes [#14](https://github.com/codywilliamson/diffle/issues/14)
* comment resolution, markdown compile preview, and review ux upgrades ([48118c7](https://github.com/codywilliamson/diffle/commit/48118c7e51c22a846a2ac5e3f7cb26e8b23fe62f))
* comment tags (nit/issue/question/praise) carried into the compiled prompt ([a1e93b0](https://github.com/codywilliamson/diffle/commit/a1e93b0fec31d28c8f19b153f1a7de9aa99527b8))
* **compiler:** compile a self-contained binary with embedded client + version ([e31e4cb](https://github.com/codywilliamson/diffle/commit/e31e4cbcecb97839557b6db6fdb3c0b051b9f8d0))
* **compiler:** compile review comments into an llm prompt ([ccefaec](https://github.com/codywilliamson/diffle/commit/ccefaecc01f081714d4c363d55db28074df23d0e))
* **compiler:** cross-target release build with a sha-256 manifest ([ce1647d](https://github.com/codywilliamson/diffle/commit/ce1647db140b87c163e97eb9ddffb5fa77dcddf9))
* **compiler:** exclude orphaned comments from the compiled prompt ([b1e130f](https://github.com/codywilliamson/diffle/commit/b1e130f8d94ad1eddc8420fd810f596e5ea1279c))
* **compiler:** include reply threads in compiled feedback ([fb8d0b1](https://github.com/codywilliamson/diffle/commit/fb8d0b1a31039d822fcafa2b30c0ce0912b2f35a)), closes [#10](https://github.com/codywilliamson/diffle/issues/10)
* **core:** add staleness predicate for orphaned comments ([a3d3f4c](https://github.com/codywilliamson/diffle/commit/a3d3f4c874d8ac38fcd0709bef3138cbf5ebbd06))
* **core:** DIFFLE_* env and ~/.diffle data dir with loupe fallbacks ([dbb7b56](https://github.com/codywilliamson/diffle/commit/dbb7b56a01e1ec0d19b517a94b9eb539222b455d))
* **demos:** add range + bigger file-tree takes, crossfade the reel ([3ea0e02](https://github.com/codywilliamson/diffle/commit/3ea0e0216716e75d26ec2534793a55e1e8f18969))
* **demos:** docs screenshot pipeline + curated gallery ([88ce190](https://github.com/codywilliamson/diffle/commit/88ce19064395ce87a68999b5cba24e958ea5a8f2))
* **demos:** playwright-captured, remotion-composited product walkthrough ([eb4e937](https://github.com/codywilliamson/diffle/commit/eb4e9376e11b66081f895128f50c4970db919327))
* **demos:** real screen-recorded video takes with zoom + captions ([1da8402](https://github.com/codywilliamson/diffle/commit/1da840267faad08e35432e0fbd0da1a46508f07f))
* **docs:** embed the product walkthrough + screenshots on the site ([64c1468](https://github.com/codywilliamson/diffle/commit/64c1468eef90e982e9d96bae5d1ee3edd0c7ada6))
* **docs:** give the Starlight docs the D5 treatment ([0ee0ca8](https://github.com/codywilliamson/diffle/commit/0ee0ca836ad7325c7017f8301085789e7e3de1c4))
* **docs:** rebuild the landing page in the D5 galley world ([c5ccd24](https://github.com/codywilliamson/diffle/commit/c5ccd248371e4460ec9c8e792b7035eafc4dc35c))
* hide .review from the review, with a settings toggle ([97b8cbe](https://github.com/codywilliamson/diffle/commit/97b8cbe8fd80255c15272ece523dde4fb8d20d21)), closes [#5](https://github.com/codywilliamson/diffle/issues/5)
* **parser:** parse unified git diff into structured json ([2ddbc89](https://github.com/codywilliamson/diffle/commit/2ddbc89306a741c9ab9aedcdcafe077239835ec5))
* **parser:** scan tracked files into an all-context diff for browse mode ([8612869](https://github.com/codywilliamson/diffle/commit/8612869f0d68c20d26584024e00586262c3c8b06))
* review context and both-sided comments ([d499b2d](https://github.com/codywilliamson/diffle/commit/d499b2d3811d8289d5d23aa3c70a5473a567580e))
* **server:** add router, handlers, and api tests ([812d725](https://github.com/codywilliamson/diffle/commit/812d725d5f768a998ec1b8995d4230b92d6ef2c5))
* **server:** check for updates via the GitHub Releases channel ([94605b6](https://github.com/codywilliamson/diffle/commit/94605b642d597b5a6fffab15f4cea8f46a49bae6))
* **server:** gzip api and static responses ([8f61f1a](https://github.com/codywilliamson/diffle/commit/8f61f1a9a20912c44c7ce9c18282ec4f78800c23))
* **server:** re-scan the codebase on refresh in browse mode ([9886416](https://github.com/codywilliamson/diffle/commit/98864164a6f3cd67be71ca1eb7dec779410597df))
* **server:** serve raw repo file bytes for markdown media ([c41f689](https://github.com/codywilliamson/diffle/commit/c41f689a558d25dee630cb9aced50bf648a88c55))
* **site:** enlarge motion gifs to a 2-up grid + click-to-expand lightbox ([093a7c6](https://github.com/codywilliamson/diffle/commit/093a7c669ced4526d0c5e43b112336fdf6ea941f))
* **store:** read/write .review and manage .gitignore ([171afa5](https://github.com/codywilliamson/diffle/commit/171afa560bb21fb0ea7502846ed78f883d285412))
* **store:** reopen approved review on rereview request ([99e3acf](https://github.com/codywilliamson/diffle/commit/99e3acfa2ad11de98141a85b5b74f3cd0f99f7c4)), closes [#7](https://github.com/codywilliamson/diffle/issues/7)
* **types:** add compile + file response shapes to the contract ([8186d44](https://github.com/codywilliamson/diffle/commit/8186d44056c732d2d448d2ae6897ce214241eecd))
* **ui:** adapt the review chrome for browse mode ([b1d9981](https://github.com/codywilliamson/diffle/commit/b1d9981ec01ad22efe23dff9c679aece65d8d687))
* **ui:** add a what's-new modal with auto-pop and a top-bar button ([ba8e9bb](https://github.com/codywilliamson/diffle/commit/ba8e9bb242446ea70ae7de5d8a75057a2bc2fe6d))
* **ui:** add transitions.dev motion tokens and shared helpers ([70f1fc0](https://github.com/codywilliamson/diffle/commit/70f1fc04d24779f8666f91f56b5bf2b23e9b735e))
* **ui:** add what's-new highlights data and selectors ([86b2d16](https://github.com/codywilliamson/diffle/commit/86b2d16d86b7b89d3b8e13c677b06fd0de15bb8b))
* **ui:** app shell, top bar, and file index (phase 2 slice 1) ([62879ea](https://github.com/codywilliamson/diffle/commit/62879ea34a1def2a44df8e5f51e485e2a94a242c))
* **ui:** build buildless preact diff-review frontend ([5bf875c](https://github.com/codywilliamson/diffle/commit/5bf875ca1496b6d583c2556275b72f1cef959358))
* **ui:** claude theme — warm ivory + charcoal variants on a four-way theme cycle ([93750f4](https://github.com/codywilliamson/diffle/commit/93750f4ac484b58d666e5088c0483923131763ce))
* **ui:** comment unchanged lines on either pane in side-by-side ([61a0b7d](https://github.com/codywilliamson/diffle/commit/61a0b7d471d8245fb23b0a5486792cd4431b1403))
* **ui:** dark mode, markdown preview, resizable sidebar, and diff fixes ([0692701](https://github.com/codywilliamson/diffle/commit/0692701cbd6c88cc9fe3f72ce44853146735d841))
* **ui:** drag across lines to select a range for a comment ([9f36dda](https://github.com/codywilliamson/diffle/commit/9f36dda59d14ed4d6dc96e530d83bc01956ce91d))
* **ui:** draggable sidebar resize handle ([e574fd3](https://github.com/codywilliamson/diffle/commit/e574fd384ac190f5a555da9923fc2d8c3dc09e08))
* **ui:** file tree filter box and viewed-progress bar ([113c4dd](https://github.com/codywilliamson/diffle/commit/113c4dd45089ccd5855b5694c2caa91b2179378d))
* **ui:** global view toggles, sticky headers, single-file view, update badge ([9b4f79d](https://github.com/codywilliamson/diffle/commit/9b4f79db7ba69cd35f6513ed03fb8eceb6cef5bf))
* **ui:** help, what's new, update badge, legacy prompt, shortcuts (slice 4) ([8f0bd71](https://github.com/codywilliamson/diffle/commit/8f0bd71c65922ed2cb20090780c936544997b080))
* **ui:** independent per-pane scroll in side-by-side + word-wrap toggle ([9f118ba](https://github.com/codywilliamson/diffle/commit/9f118baee3db319041c366e6ac2776d3bb266bae))
* **ui:** inline diff commenting — bubbles, ranges, threads (slice 2b) ([b515d08](https://github.com/codywilliamson/diffle/commit/b515d08f69f798578e5135460e117958b98dbccf))
* **ui:** intra-line word diff highlights on modified line pairs ([85204cf](https://github.com/codywilliamson/diffle/commit/85204cfda600b8057b9c4911b9c934db284d9043))
* **ui:** introduce proof desk design system ([98a89fe](https://github.com/codywilliamson/diffle/commit/98a89fe34bba6fe47f255027625c891d0412a51a))
* **ui:** keep shift-click to extend a comment range alongside drag ([6e44c42](https://github.com/codywilliamson/diffle/commit/6e44c423fdc60437c28f0d85b1c0c1523a50488e))
* **ui:** keyboard shortcuts (j/k/v/s/o/t/r/c) with a ? help overlay ([3ecb08c](https://github.com/codywilliamson/diffle/commit/3ecb08c1a0216b290c668f6937e6b7ed4613f9fd))
* **ui:** large-file lazy mount + manual load gate (slice 2c) ([301cfe8](https://github.com/codywilliamson/diffle/commit/301cfe8a59322a363eef127dc215abaa5a3957fa))
* **ui:** lazy-mount file bodies and guard giant files behind load-diff ([e51c682](https://github.com/codywilliamson/diffle/commit/e51c68285055898eeed29159ed32331e47d89bd3))
* **ui:** live diff refresh — re-run git diff per fetch plus a top-bar button ([8e326e2](https://github.com/codywilliamson/diffle/commit/8e326e2328383a50758cb564559d50664b5dc484))
* **ui:** live review sync with agent activity notice ([b044705](https://github.com/codywilliamson/diffle/commit/b0447059097144403c204365fc6d2686480ac332)), closes [#7](https://github.com/codywilliamson/diffle/issues/7) [#9](https://github.com/codywilliamson/diffle/issues/9)
* **ui:** make review workflow the homepage ([bb423bd](https://github.com/codywilliamson/diffle/commit/bb423bd7f584c40725ddffd8d9feeb61001c69a4))
* **ui:** motion + accessibility pass (phase 3) ([3f8a6fb](https://github.com/codywilliamson/diffle/commit/3f8a6fb82d0bca086fa91b941ecf6328901e5366))
* **ui:** motion pass — theme crossfade, tree slide, richer transitions ([700e91d](https://github.com/codywilliamson/diffle/commit/700e91df378710a625c7d515d6b320b113fe3a58))
* **ui:** multiline range comments and resizable side-by-side panes ([feaac51](https://github.com/codywilliamson/diffle/commit/feaac51633a5b2e003e0b0fe9e26ab5400a31ffe))
* **ui:** overlay motion from transitions.dev recipes ([cca12b2](https://github.com/codywilliamson/diffle/commit/cca12b21acd59e34d3222bab271d7b3f1890b590))
* **ui:** regroup the review header per direction c ([5b834bf](https://github.com/codywilliamson/diffle/commit/5b834bf7418de5b244343f310f4eb37ee62436f7)), closes [#13](https://github.com/codywilliamson/diffle/issues/13)
* **ui:** restore feedback preview modal + review popover reveal ([99e820c](https://github.com/codywilliamson/diffle/commit/99e820c60a62438f330efc45c5bab1ac19c87fdf))
* **ui:** review feedback motion from transitions.dev recipes ([5854e8e](https://github.com/codywilliamson/diffle/commit/5854e8ea59328c55cfe175dfaa0d610ba544cb39))
* **ui:** review outcome menu as a real popover with legible state ([3634beb](https://github.com/codywilliamson/diffle/commit/3634beb330fd76614e87c0071a8c782b35a5c7b1)), closes [#8](https://github.com/codywilliamson/diffle/issues/8)
* **ui:** review panel, outcomes, feedback copy, sync notice (slice 4) ([5cb4299](https://github.com/codywilliamson/diffle/commit/5cb4299f4010d8ed325940d0add18bde41bdbf26))
* **ui:** shell motion from transitions.dev recipes ([fdc7c25](https://github.com/codywilliamson/diffle/commit/fdc7c25f0c3ce60a621ed9537d6ff410a46160cd))
* **ui:** side-by-side, wrap, single-file, markdown preview, stale comments (slice 3) ([be093b4](https://github.com/codywilliamson/diffle/commit/be093b442e82699d5c4267310965185b2be0ddf0))
* **ui:** spin the refresh icon while re-running the diff ([f9ff41f](https://github.com/codywilliamson/diffle/commit/f9ff41f145c76fb40b8a4f6b100fb021cc3b65b6))
* **ui:** style the side-by-side scrollbars + shift-wheel horizontal scroll ([4cb3a16](https://github.com/codywilliamson/diffle/commit/4cb3a16b4cb52d6eba7aa4f159f3407eb7163f77))
* **ui:** surface orphaned comments in the compile modal ([1f682d1](https://github.com/codywilliamson/diffle/commit/1f682d18d8413749002db26f506660be9fbf4e1d))
* **ui:** threaded reviewer replies on comments ([af3c272](https://github.com/codywilliamson/diffle/commit/af3c2725405a59d8414eaf430c90da6d9b3f897b)), closes [#10](https://github.com/codywilliamson/diffle/issues/10)
* **ui:** unified diff view with syntax + word highlighting (slice 2a) ([a724c17](https://github.com/codywilliamson/diffle/commit/a724c17160a7a20734eb8a1d97c8ad29aa6b5764))


### Bug Fixes

* **build:** build client before source start ([42b0169](https://github.com/codywilliamson/diffle/commit/42b0169ddbcec2921450c8d90d0c409692086c3c))
* **build:** harden release installers ([7757090](https://github.com/codywilliamson/diffle/commit/77570907496fdfbad71bc2a98e0170fd47716246))
* **cli:** dev launcher reads both streams and strips vite's ansi ([3207e71](https://github.com/codywilliamson/diffle/commit/3207e71f20a71a82554507e0c1aeddf5b6cf6f24))
* **compiler:** fence the review context block so it renders as code ([056ce27](https://github.com/codywilliamson/diffle/commit/056ce273c64ae97c30fb3484f1a11ec16bb5bf87)), closes [#21](https://github.com/codywilliamson/diffle/issues/21)
* **demos:** drop the goofy outro tagline, clean sign-off ([43024ad](https://github.com/codywilliamson/diffle/commit/43024adefa6fd7061b33072a4c8e1b148d214e47))
* **hooks:** scope active reviews to agent chats ([72ef2d4](https://github.com/codywilliamson/diffle/commit/72ef2d4feae51a2445c88c8442ca37134c18597e))
* **mcp:** harden agent review handoff ([3f47525](https://github.com/codywilliamson/diffle/commit/3f47525c14c3bf8a1afbb54e795b11079440ab14))
* refresh pane scrolling and resolve origin refs ([7001fc1](https://github.com/codywilliamson/diffle/commit/7001fc12a1a605c0f860365ed2ae311bf75d6012)), closes [#1](https://github.com/codywilliamson/diffle/issues/1) [#2](https://github.com/codywilliamson/diffle/issues/2)
* **server:** preserve agent replies and status on comment save ([180bedd](https://github.com/codywilliamson/diffle/commit/180bedd968316ab07fbae45cc88b20aa55394ba8))
* **server:** reject absolute and symlinked paths outside the repo ([49c016c](https://github.com/codywilliamson/diffle/commit/49c016caf141cd314f3e6d6be659394c28600fd1))
* skip deleted tracked files in browse mode ([35637a1](https://github.com/codywilliamson/diffle/commit/35637a18910245e9c28066ebe5fb2bbcf3f4587c)), closes [#3](https://github.com/codywilliamson/diffle/issues/3)
* **store:** allow summary-only feedback and compile the reviewer summary ([c96e690](https://github.com/codywilliamson/diffle/commit/c96e690184083681d7ec659023d84d0d7d501676)), closes [#12](https://github.com/codywilliamson/diffle/issues/12)
* **store:** create .review lazily, only once there's a comment ([24cd33d](https://github.com/codywilliamson/diffle/commit/24cd33d724a229c57eb8b238652636f0d578bfa7))
* **ui:** align browse-mode comments under the code column ([9d8ae56](https://github.com/codywilliamson/diffle/commit/9d8ae5656d23ddf2dbbb80e038937166d17223ed)), closes [#4](https://github.com/codywilliamson/diffle/issues/4)
* **ui:** clear close timers on unmount and key notices by content ([a72915a](https://github.com/codywilliamson/diffle/commit/a72915aea1fe50f0f93f2e9fb74c7e846e1f362e))
* **ui:** collapse to a single line-number gutter in browse mode ([9611ee6](https://github.com/codywilliamson/diffle/commit/9611ee60e25344b14c34ba2929b04b292342827b))
* **ui:** comment editor padding, pinned comment box, readable tag badges ([2bee110](https://github.com/codywilliamson/diffle/commit/2bee11030e501e83632e64095156e51e978b887e))
* **ui:** give the split diff one scrollbar and side-anchored comments ([f687293](https://github.com/codywilliamson/diffle/commit/f687293c83e19d8552462add2bafde6c51fd8e04))
* **ui:** hide badge, delta, and split toggle in the browse diff-pane header ([2a95118](https://github.com/codywilliamson/diffle/commit/2a95118cd8d3a683e4ad001069ff7fd004fdac4c))
* **ui:** keep added and deleted files in unified view ([9b3de4a](https://github.com/codywilliamson/diffle/commit/9b3de4ad7726b863a609c7c6e4a968c870720000)), closes [#11](https://github.com/codywilliamson/diffle/issues/11)
* **ui:** keep narrow top-bar actions from shrinking ([502952f](https://github.com/codywilliamson/diffle/commit/502952f26753d49187072d777cd92a0ab85d1b36))
* **ui:** markdown preview layout, embedded images, and skeleton reveal ([e37436b](https://github.com/codywilliamson/diffle/commit/e37436bfb1f6e4a04acfe2c1c2aabc81e8627d3f))
* **ui:** preserve failed reply drafts ([8877a2d](https://github.com/codywilliamson/diffle/commit/8877a2d5cb8c2246974c26fe5d59b7c69103bec6))
* **ui:** render diff rows without the unsupported fragment shorthand ([fee95ef](https://github.com/codywilliamson/diffle/commit/fee95ef9844c1c30f547fc4485845e597141dde5))
* **ui:** responsive top-bar and code-cell layout ([9fccf76](https://github.com/codywilliamson/diffle/commit/9fccf76f962425bbecf79530a5ab0025d165ea68))
* **ui:** restore mobile tool overflow ([fb9a659](https://github.com/codywilliamson/diffle/commit/fb9a6596fabb7b7e9bf69c86fde35a258ff22fd3))
* **ui:** restore per-file view parity ([5584694](https://github.com/codywilliamson/diffle/commit/5584694e84464a7e42a5b4740fb3dba6f19504ce))
* **ui:** restore review workflow correctness ([87728be](https://github.com/codywilliamson/diffle/commit/87728be2f589822ddb814fc26d7e7091af80e3d6))
* **ui:** scroll side-by-side panes as one unit via uniform transform (no per-line clamping) ([ee04070](https://github.com/codywilliamson/diffle/commit/ee0407081d6fa030192cebbfd428a87daa5a7732))
* **ui:** send acknowledgeUnresolved as a boolean when approving ([1bc7f4d](https://github.com/codywilliamson/diffle/commit/1bc7f4daa81a42e464e1391c239afe7089ad271d))
* **ui:** side-by-side panes stay 50/50, long lines scroll within the pane ([7c957d3](https://github.com/codywilliamson/diffle/commit/7c957d32877d3f8fdb765ce6233e04cc0f61c522))
* **ui:** smooth the sidebar resize handle ([a958ff4](https://github.com/codywilliamson/diffle/commit/a958ff401e6450ba0632c4cb142f7d651b5b8bdf))
* **ui:** sticky file headers, collapse deleted files by default, diff reveal ([96271f7](https://github.com/codywilliamson/diffle/commit/96271f7b86231d492aae0e7a5b5e1338f8f8ed00))
* **ui:** stop the what's-new modal re-popping every launch ([d9809ca](https://github.com/codywilliamson/diffle/commit/d9809cac66a6e92407586570952a1414411f2f53))
* **ui:** tolerate query strings in markdown image targets and stop the hidden skeleton pulse ([69d1cd7](https://github.com/codywilliamson/diffle/commit/69d1cd782e3b0d3c7d43ebe9e72ce87db09b706b))


### Performance Improvements

* **server:** reuse the launch diff for the first /api/diff ([e4216c2](https://github.com/codywilliamson/diffle/commit/e4216c20ffbd009c990a3e9c28c7e77c63795b9f))

## [Unreleased]

## [0.15.a] — 2026-09-20

### Removed

- **Completion-hook review** — the optional completion hook for Loupe review has been removed.

## [0.15.1] — 2026-09-15

### Fixed

- **Feedback preview code blocks** — the diff context around a commented line rendered as a blockquote of run-together text instead of a code block, because the `>` markers on commented lines were read as Markdown quoting. The context block is now fenced, so line numbers, `+`/`-` markers, and the `>` highlight render as aligned code.

## [0.15.0] — 2026-09-15

### Added

- **Motion layer** — transitions.dev recipes across the review desk, timed from one motion-token scale in `motion.css`: modals and popovers scale and fade open and close faster than they open on every path, tooltips wait an intent delay, the open-comment badge pops and its digits re-enter on change, labels swap in place (Copy → Copied, Ready → Feedback sent), comment editors, saved cards and reply threads reveal with a cross-blur, a failed send shakes the composer, the sync notice grows in like a toast, tree folders expand as accordions with flipping chevrons, the viewed checkbox draws its check, the theme toggle cross-fades sun and moon, the loading label shimmers, and the mobile file drawer slides in. Everything honors reduced motion.
- **Session registry and cleanup** — every running Loupe server is recorded under the data directory, `loupe sessions` lists live and stale ones with their review status, `loupe cleanup` removes stale entries and stops finished servers after confirmation, the MCP server stops everything it launched on exit, and `start_review` reports stale sessions so agents can suggest cleanup.

### Fixed

- **Markdown preview** — rendered `.md` files had no padding, headings at body size, and broken repo-relative images. The preview now has a readable measure and heading scale, bordered code and tables, images served through `GET /api/raw`, external links that open in a new tab, and a skeleton loader that cross-fades into the content.
- **Completion-hook review ownership** — agent hooks now deduplicate only the review belonging to the same agent chat, so a review in one chat no longer blocks a new chat using the same repository; human-originated and legacy reviews remain unclaimed until explicitly handed off.

## [0.14.0] — 2026-09-04

### Changed

- **Review header regrouped** — file counts join the orientation side in a tonal wash, the review trigger and a neutral Preview button share one segment, view tools and utilities sit in washes instead of behind dividers, and phones get a single overflow menu so nothing scrolls off-screen.

### Fixed

- **Terminal reviews drop the open-count badge** — approved and cancelled reviews no longer show a red unresolved count beside their pill.
- **Cancel asks first** — cancelling a review with open comments or a drafted summary now confirms, matching Approve.
- **Count badge contrast** — the open-count digit clears AA in light mode.

## [0.13.1] — 2026-09-02

### Fixed

- **Summary-only feedback** — a reviewer summary with no comments can now be returned: the button enables, the record stores the summary as feedback, and the compiled Markdown carries a Reviewer summary section.

## [0.13.0] — 2026-09-01

### Added

- **Loupe proof-desk identity** — a custom split-aperture mark, editorial site typography, and one shared paper-and-ink design system now span the review app, overview, docs, and favicon.
- **Mobile file drawer** — narrow screens keep file filtering, viewed progress, directory navigation, and 44px touch targets instead of dropping the navigator.
- **Live review sync** — the review page polls its Review Record while visible, so agent replies, addressed marks, and rereview requests appear without a reload, with a quiet notice bar and a one-click diff refresh.
- **Reopen after approval** — an agent calling `request_rereview` on an approved review reopens it for another pass instead of failing, keeping the full activity trail in one record.
- **Threaded replies** — reviewers can answer directly under a comment; agent and reviewer replies render as one authored, timestamped thread and flow into the compiled Markdown feedback.

### Changed

- **Two complete appearance modes** — the old four-theme cycle is replaced by focused light-paper and dark-charcoal modes with OS fallback, persisted preference, accessible diff semantics, and legacy-setting migration.
- **Review workspace hierarchy** — repository context, view tools, feedback actions, inline comments, dialogs, focus states, and responsive behavior now use the proof-desk component language.
- **Overview and documentation site** — both static pages now demonstrate the real review loop in the same brand system, with refreshed screenshots, walkthrough media, and keyboard-accessible image inspection.
- **Interactive homepage review** — the homepage now demonstrates inspect, mark, return, and rereview as one accessible stateful artifact, with a dedicated mobile composition and shell-neutral installation copy.
- **Review outcome menu** — the review panel is a real popover that closes on Escape, click-outside, and after an action, returns focus to its trigger, and shows the review state and open-comment count as legible pills in the top bar.

### Fixed

- **Walkthrough capture selector** — the reproducible media script follows the current reviewer-summary field again.
- **Single-sided files stay unified** — added and deleted files never render side-by-side and hide the per-file split toggle, since only one side has content.
- **Approving with unresolved comments** — the acknowledgement flag is now sent as a boolean, so approving over open comments no longer fails.
- **Comment saves keep agent replies** — saving reviewer comments merges by id and preserves replies and addressed marks the agent wrote in the meantime.
- **Narrow top bar** — action buttons no longer shrink below their labels on phones; the strip scrolls instead.

## [0.12.0] — 2026-08-29

### Added

- **Durable Review Records** — reviews now live under the user's Loupe data directory with summaries, agent replies, addressed/resolved comments, explicit outcomes, and retained history.
- **Local MCP server** — six structured review tools power Codex and Claude Code integrations while keeping approval and resolution reviewer-owned.
- **Native and MCPB packaging** — Loupe compiles to a local executable and stages a validated platform bundle with its browser assets.
- **Manual feedback formats** — copy unresolved feedback as structured JSON or context-rich Markdown.
- **0.12 What's New** — the in-app release summary now introduces the agent loop, durable history, and optional completion hooks.
- **Agent walkthrough** — a reproducible Playwright capture uses a real Claude Code edit to demonstrate comment, feedback return, agent reply, rereview, resolution, and approval in WebM, MP4, and GIF formats.

### Changed

- **Loupe-native product language** — refreshed product copy and internal design tokens around Loupe's own review model.
- **Legacy `.review` handling** — existing files are never migrated automatically; reviewers choose import, confirmed removal, or ignore.
- **Release-quality review workflow** — review state uses plain-language labels, agent/manual next-step guidance sits beside the outcome controls, and feedback actions lead the toolbar.
- **Responsive review workspace** — mobile uses the full viewport for the diff, moves controls into a two-row toolbar, and presents review actions in a fitted sheet.
- **Legacy setting removed** — the obsolete `.review` visibility gear, persisted option, and supporting code are gone; legacy files stay hidden until explicitly imported.

### Fixed

- **Current-change agent reviews** — `HEAD` now resolves to the working tree, the MCP contract explicitly directs agents to `working`, and empty comparisons fail with an actionable error instead of opening a blank review.
- **Rereview summary authorship** — agent updates are stored on the agent's activity entry and shown read-only, while each reviewer outcome starts with a blank reviewer-owned summary field.
- **Codex plugin installation** — marketplace plugins now live at the repository root where Codex resolves them, and the documented repository-root install command works on a clean machine.

## [0.11.0] — 2026-08-17

### Added

- **Settings menu** — a gear in the top bar, holding one setting: **Review the `.review` file**. Settings live in `~/.loupe/state.json`, so they stick across launches even though each one picks a fresh port.

### Changed

- **`.review` stays out of the review** — it was only filtered from the untracked listing in working-tree mode, so a `.review` committed to the repo before loupe ever ran showed up as a reviewable file in branch, range, staged and browse listings. One filter now covers every mode. Turn the new setting on to review it like any other file.
- **`.review` is excluded via `.git/info/exclude`, not `.gitignore`** — `.gitignore` is tracked, so appending to it created a working-tree change that surfaced in the very review you were running. The exclude file is per-clone and never committed, and loupe writes it whether or not a `.gitignore` exists (it skips the write entirely when `.gitignore` already covers `.review`). Existing `.gitignore` entries are left alone.

## [0.10.3] — 2026-08-06

### Fixed

- **Browse-mode comments sit under the code again** — browse hides the old-line-number column, which dropped a `<td>` from every row while the comment row still spanned four columns. The comment box landed in a phantom column to the right of the code. The row and its comment row now derive their column count from the same place.

## [0.10.2] — 2026-08-06

### Fixed

- **`loupe browse` no longer dies on deleted files** — `git ls-files` reads the index, so it still lists tracked files that have been deleted from the working tree; reading the first one threw `ENOENT` and took the whole browse down. Deleted files are now dropped from the scan, and any other unreadable path (broken symlink, permissions) is skipped instead of aborting it.

## [0.10.1] — 2026-08-04

### Fixed

- **Fresh long lines can always scroll in side-by-side view** — re-running a diff now remeasures each changed pane even when the file path is unchanged, so a newly introduced long line gets the correct independent horizontal scrollbar.
- **Remote-only branches resolve automatically** — when a ref is not available locally, loupe now tries the matching `origin/<ref>` for both branch and range reviews.

## [0.10.0] — 2026-07-05

Performance overhaul for large diffs and large codebases. Baseline: a 150-file / 40k-line diff froze the tab for minutes and shipped 11 MB of JSON. Now it paints in ~3 seconds, stays smooth, and ships ~1 MB.

### Added

- **Giant-file guard** — files over 2,000 diff lines start collapsed behind a "Load diff (N lines)" note, so one monster lockfile can't stall the whole review. One click loads it.

### Changed

- **Lazy-mounted file bodies** — file sections render as height-preserving placeholders until you scroll near them (with a generous lookahead), then mount for real and unmount again when far away. The DOM stays small no matter how big the diff; open comment editors pin their section so drafts survive scrolling away and back.
- **Isolated re-renders** — commenting, drag-selecting, and selecting files now re-render only the file section you're touching instead of every file in the diff; drag-select is also frame-throttled. Large diffs no longer stutter while you work.
- **Gzipped responses** — the server now gzips API and static responses (~10× smaller diff payloads on the wire).
- **Faster startup** — the pinned CDN modules are preconnected and module-preloaded so the first paint isn't gated on a discovery waterfall.

## [0.9.1] — 2026-06-24

### Fixed

- **"What's new" modal no longer reappears every launch** — the dismissed version was remembered in `localStorage`, but loupe serves on a random port each run, so every launch was a fresh origin with no memory. The seen version now persists per-user in `~/.loupe/state.json`, so once you've dismissed it, it stays dismissed across repos and launches.
- **Couldn't drag the resizers** — because the what's-new modal popped on every launch, its full-screen backdrop quietly intercepted the very first resize drag (sidebar and side-by-side panes). With the modal fixed, both resizers grab as expected.

### Changed

- **Restyled the "what's new" modal** — it no longer borrows the wide compile-modal frame; it's a compact 460px card with a sparkles badge, version/date subtitle, and accent-marked highlights.

## [0.9.0] — 2026-06-24

### Added

- **Codebase browse mode** — `loupe browse [path]` opens the whole tracked codebase (optionally scoped to a subtree) in the same review UI, so you can read every file and leave inline questions/notes, then **Compile Review Prompt** to feed an LLM for onboarding or learning. Comments share the existing `.review` store.
- **"What's new" modal** — on the first run of a new version, loupe pops a curated highlights modal; reopen it anytime from the top-bar sparkles button or the `n` shortcut.
- **Independent side-by-side scrolling** — each side-by-side pane now has its own slim horizontal scrollbar (drag it, or **Shift**+scroll over the pane), so a long line scrolls that pane on its own without shoving the other. Fixes long lines overlapping across panes.
- **Word-wrap toggle** — a top-bar button (and the `w` shortcut) turns line wrapping on/off in both unified and side-by-side; off by default. Applies in browse mode too.
- **Comment either pane in side-by-side** — unchanged lines can now be commented on the left (old) pane too, not just the right; the comment remembers its side.

## [0.8.1] — 2026-06-23

### Fixed

- **Top-bar layout at narrow viewports** — left side now shrinks and truncates the ref label instead of colliding with the right side; file count and delta hidden below 640px (visible in the file tree anyway)
- **Code cells no longer wrap** — diff lines scroll horizontally instead of reflowing onto multiple rows
- **"Compile Review Prompt" button stays on one line** — no longer wraps at small widths

### Added

- **Multiline comment gestures in the shortcuts help** — drag the gutter or shift-click to select a range, now documented in the `?` overlay

## [0.8.0] — 2026-06-16

### Added

- **Orphaned-comment cleanup** — when the code moves on and a comment's line or file leaves the current diff, the comment used to disappear from the view while still bloating the compiled prompt. Such orphaned comments are now gathered in the *Compile Review Prompt* dialog under **From earlier reviews**, each with resolve and delete, so every saved comment stays reachable

### Fixed

- **Stale comments no longer leak into the compiled prompt** — comments whose anchor is absent from the current diff are excluded (like resolved ones), so prompts only contain notes about code you're actually reviewing

## [0.7.0] — 2026-06-16

### Added

- **Resolve comments** — mark a comment resolved instead of deleting it; it stays in the thread (dimmed, with a badge) but drops out of the compiled prompt and the open-comment counts, and reopens with one click
- **Markdown preview in the compile dialog** — *Compile Review Prompt* now renders as formatted markdown by default, with a toggle to the raw source; the copy button reads **Copy as Markdown**
- **Loading screen** — an animated indicator while the initial diff loads, instead of a bare "Loading…" line

### Changed

- **Range comments from the line numbers** — drag across the line-number gutter (or shift-click a second line) to select a range; the hover bubble still works too
- **Markdown opens as a diff** — `.md` files now show their changes by default so edits are obvious; the per-file Preview toggle still renders them
- **`.review` is created lazily** — only your first comment writes the file and appends it to `.gitignore`; just browsing or marking files viewed no longer touches your repo
- Site redesigned as a self-demonstrating review session — the landing page is a diff under review (hunk pills, struck-through deletions, comment-card copy), with a mobile-first layout, active-section highlighting, and a scrollable nav on the docs page

### Performance

- Faster initial load on large diffs: the launch-time diff is served for the first request instead of re-running `git diff`, and syntax highlighting is computed once per hunk (no per-line language auto-detection)

## [0.6.0] — 2026-06-09

### Added

- **Claude themes** — the theme button now cycles light → dark → claude → claude dark; the new pair are warm Anthropic-inspired palettes (ivory paper / soft charcoal, terracotta accents)
- **Word-level diff highlights** — the changed segment inside a modified line pair is tinted in both unified and side-by-side views
- **Keyboard shortcuts** — `j`/`k` walk files, `v` toggles viewed, `s` split, `o` single-file view, `t` theme, `r` refresh, `c` compile, `?` opens a shortcut overlay, `Esc` closes dialogs
- **Comment tags** — label a comment `nit`, `issue`, `question`, or `praise`; pills in the UI, `**[tag]**` prefixes in the compiled prompt
- File-tree **filter box** and a **viewed-progress bar** in the sidebar
- CLI flags: `--port <n>`, `--no-open`, `--version`, `--help` — plus a styled launch banner
- **Landing + docs site** on GitHub Pages ([codywilliamson.github.io/loupe](https://codywilliamson.github.io/loupe/)), deployed by a workflow

### Changed

- Selecting a file in the tree now tracks the current file in all-files view too (powers `j`/`k`/`v`)

## [0.5.0] — 2026-06-04

### Added

- Untracked files now appear in the working-tree view, rendered as additions you can comment on — previously `git diff` hid new, un-added files
- Diff-context header in the top bar: the repo, the diff mode (working tree / staged / branch / range), and the source → target refs, so you always know what you're reviewing
- Comment on **both sides** in side-by-side view, and on removed (old) lines in unified view too — comments remember their side and the exported prompt labels them `Old line N`
- Styled, state-aware hover tooltips on the top-bar icon buttons

### Fixed

- Multi-line comment selection (drag or shift-click) works again when a file has scrolled under the sticky header
- The global side-by-side toggle no longer gets stuck — switching all files is reliable in both directions
- The inline comment box now opens under the side you clicked instead of always the left
- loupe no longer lists its own `.review` file as a changed file
- Side-by-side comments no longer store a broken line reference

## [0.4.0] — 2026-06-03

### Added

- Global view toggles in the top bar: switch **all** files between unified and side-by-side at once, and a **single-file view** that shows one file at a time (click a file in the tree to swap). Both choices persist across reloads, like dark mode
- Sticky file headers: the file name stays pinned at the top while you scroll through its diff
- Update-available badge: a pulsing dot appears next to the wordmark when a newer loupe release exists on origin; click it for the `git pull` command to update
- Diff refresh: a top-bar button re-runs `git diff` in place (and a browser reload now picks up repo changes too), so you can review continuously while an agent edits

### Changed

- Multi-line comments: click-and-drag across lines to highlight a range, then comment — shift-click a second line still extends a range too

## [0.3.0] — 2026-06-02

### Added

- Dark mode with a top-bar toggle (persisted; follows the OS preference by default)
- Markdown files render as a preview by default, with a toggle to the raw diff
- Multiline (range) comments — shift-click a second line to extend the selection; the compiled prompt renders `Lines A–B`
- Resizable sidebar and resizable side-by-side panes (draggable dividers)
- PowerShell syntax highlighting (`.ps1` / `.psm1` / `.psd1`)

### Fixed

- Side-by-side view no longer collapses the right-hand pane
- The inline-comment bubble no longer shifts the line on hover

## [0.2.1] — 2026-06-02

### Documentation

- Document the Windows PowerShell `$PROFILE` install for the global `loupe` command

## [0.2.0] — 2026-06-02

### Added

- Installable `loupe` command — `bin` entry + `#!/usr/bin/env bun` shebang, so `bun link` (macOS/Linux) or a shell function (Windows) runs loupe from any git repo
- Launch banner now summarizes the ref and changed-file count

## [0.1.0] — 2026-06-02

### Added

- Unified and side-by-side git diff viewer with a focused review UI
- Inline line-level and file-level comments, persisted to `.review`
- Viewed-file tracking in the sidebar
- **Compile Review Prompt** — export all comments as a structured LLM prompt
- CLI modes: working tree, staged, branch, and commit-range diffs
