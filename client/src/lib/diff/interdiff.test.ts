import { describe, expect, it } from "vitest";
import { runInterdiff } from "./interdiffHarness.svelte";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createInterdiff", () => {
  it("stays idle and does not fetch while disabled", () => {
    const calls: string[] = [];
    const { loader, stop } = runInterdiff(false, async (path) => (calls.push(path), { path, file: null }));
    expect(loader.state.status).toBe("idle");
    expect(calls).toEqual([]);
    stop();
  });

  it("fetches when enabled and exposes the result", async () => {
    const { loader, stop } = runInterdiff(true, async (path) => ({ path, file: null }));
    expect(loader.state.status).toBe("loading");
    await tick();
    expect(loader.state).toEqual({ status: "ready", file: null });
    stop();
  });

  it("surfaces fetch errors", async () => {
    const { loader, stop } = runInterdiff(true, () => Promise.reject(new Error("nope")));
    await tick();
    expect(loader.state).toEqual({ status: "error", message: "nope" });
    stop();
  });
});
