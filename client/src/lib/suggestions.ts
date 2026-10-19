// the suggestion-fence parser is shared pure logic. the client reuses the server-core module
// directly (Vite bundles it). change the behavior in src/core/suggestions.ts, never here.
export * from "../../../src/core/suggestions";
