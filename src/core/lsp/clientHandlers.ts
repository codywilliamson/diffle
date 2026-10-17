// the minimal answers we give when a server sends requests of its own. we have no settings and
// no dynamic capabilities, so these mostly acknowledge; configuration answers are keyed by
// section so we can opt a server out of side effects on the user's checkout.

import type { JsonRpcConnection } from "./jsonRpc";

// roslyn restores projects automatically, which writes obj/ into the checkout; say no.
const CONFIGURATION_ANSWERS: Record<string, unknown> = {
  "dotnet.projects.enableAutomaticRestore": false,
};

interface ConfigurationItem { section?: string }

export function installClientHandlers(connection: JsonRpcConnection, rootUri: string): void {
  connection.onRequest("workspace/configuration", (params) => {
    const items = (params as { items?: ConfigurationItem[] } | undefined)?.items ?? [];
    return items.map((item) => CONFIGURATION_ANSWERS[item.section ?? ""] ?? null);
  });
  connection.onRequest("client/registerCapability", () => null);
  connection.onRequest("client/unregisterCapability", () => null);
  connection.onRequest("window/workDoneProgress/create", () => null);
  connection.onRequest("workspace/workspaceFolders", () => [{ uri: rootUri, name: "root" }]);
}
