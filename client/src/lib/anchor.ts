// the anchors + stale-comment partition transform is shared pure logic. the client reuses
// the server-core module directly (Vite bundles it) instead of mirroring it as the buildless
// client had to. change the behavior in src/core/anchor.ts, never here.
export * from "../../../src/core/anchor";
