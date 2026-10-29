// every way a console or terminal can ask this process to end. sigint and sigterm were always
// handled; ctrl+break (sigbreak, windows only) and closing the console window or terminal tab
// (sighup) would otherwise kill the process outright and skip teardown, leaving the detached lsp
// worktrees behind. windows gives a closing console about five seconds, so handlers must be quick.

export const SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] =
  process.platform === "win32" ? ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"] : ["SIGINT", "SIGTERM", "SIGHUP"];

interface SignalHost {
  on(signal: NodeJS.Signals, handler: (signal: NodeJS.Signals) => void): unknown;
  off(signal: NodeJS.Signals, handler: (signal: NodeJS.Signals) => void): unknown;
}

// runs `handler` for each shutdown signal; returns a function that removes the handlers again.
export function onShutdownSignals(handler: (signal: NodeJS.Signals) => void, host: SignalHost = process): () => void {
  for (const signal of SHUTDOWN_SIGNALS) host.on(signal, handler);
  return () => { for (const signal of SHUTDOWN_SIGNALS) host.off(signal, handler); };
}
