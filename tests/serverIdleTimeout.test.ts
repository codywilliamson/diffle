import { expect, test } from "bun:test";
import { INITIALIZE_TIMEOUT_MS } from "../src/core/lsp/bridge";
import { PROGRESS_MAX_WAIT_MS } from "../src/core/lsp/idle";
import { BUN_MAX_IDLE_TIMEOUT_S, SERVER_IDLE_TIMEOUT_S } from "../src/server/idleTimeout";

const BUN_DEFAULT_IDLE_S = 10;
const HOLD_PAST_DEFAULT_MS = (BUN_DEFAULT_IDLE_S + 1) * 1000;

test("idle timeout covers the lsp waits and stays under bun's max", () => {
  expect(SERVER_IDLE_TIMEOUT_S * 1000).toBeGreaterThan(INITIALIZE_TIMEOUT_MS + PROGRESS_MAX_WAIT_MS);
  expect(SERVER_IDLE_TIMEOUT_S).toBeLessThanOrEqual(BUN_MAX_IDLE_TIMEOUT_S);
});

test("a response held past bun's 10s default still arrives", async () => {
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    idleTimeout: SERVER_IDLE_TIMEOUT_S,
    fetch: async () => {
      await new Promise((resolve) => setTimeout(resolve, HOLD_PAST_DEFAULT_MS));
      return new Response("late but whole");
    },
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(await res.text()).toBe("late but whole");
  } finally {
    await server.stop(true);
  }
}, 20_000);
