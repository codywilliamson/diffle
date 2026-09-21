# MCPB packaging

`bun run mcpb:stage` compiles diffle for the current operating system and generates
`manifest.json`, the native server binary, browser assets, and package metadata.

Validate with `bun run mcpb:validate` and create `dist/diffle.mcpb` with
`bun run mcpb:pack`. Build once on each target platform; generated staging files
stay out of source control.
