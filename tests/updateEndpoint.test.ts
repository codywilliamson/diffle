import { describe, it, expect, afterEach } from "bun:test";
import { join } from "node:path";
import { handleGetUpdate, type ServerContext } from "../src/server/handlers";
import { currentVersion, resetUpdateCache } from "../src/core/updateCheck";

const root = join(import.meta.dir, "..");
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.NITTLE_NO_UPDATE_CHECK;
  resetUpdateCache();
});

describe("GET /api/update", () => {
  it("never calls out when the update check is opted out", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response("[]");
    }) as unknown as typeof fetch;
    process.env.NITTLE_NO_UPDATE_CHECK = "1";
    resetUpdateCache();

    const res = await handleGetUpdate({ productRoot: root } as ServerContext);
    const current = currentVersion(root);
    expect(await res.json()).toEqual({ behind: false, current, latest: current });
    expect(calls).toBe(0);
  });
});
