import { describe, expect, test } from "bun:test";
import { formatNextSteps, NO_MCP_ACTIVITY, updateNextSteps } from "../src/core/updateNextSteps";

const has = (steps: string[], text: string) => steps.some((step) => step.includes(text));

describe("updateNextSteps", () => {
  test("no servers: restart reviews and verify the version only", () => {
    const steps = updateNextSteps(NO_MCP_ACTIVITY);
    expect(steps).toHaveLength(2);
    expect(has(steps, "restart any open diffle review")).toBe(true);
    expect(has(steps, "diffle --version")).toBe(true);
  });

  test("stopped servers: reconnect agents, no manual restart", () => {
    const steps = updateNextSteps({ ...NO_MCP_ACTIVITY, found: 2, stopped: 2 });
    expect(has(steps, "/mcp → reconnect")).toBe(true);
    expect(has(steps, "diffle mcp restart")).toBe(false);
  });

  test("live reviews blocked the restart: run mcp restart once they finish", () => {
    const steps = updateNextSteps({ ...NO_MCP_ACTIVITY, found: 1, blockedByLive: 1 });
    expect(has(steps, "once your live reviews finish")).toBe(true);
    expect(has(steps, "/mcp → reconnect")).toBe(false);
  });

  test("servers that could not be stopped, or a failed check, point at mcp restart", () => {
    const failed = updateNextSteps({ ...NO_MCP_ACTIVITY, found: 2, stopped: 1, failed: 1 });
    expect(has(failed, "/mcp → reconnect")).toBe(true);
    expect(has(failed, "run `diffle mcp restart`")).toBe(true);
    expect(has(updateNextSteps({ ...NO_MCP_ACTIVITY, checkFailed: true }), "run `diffle mcp restart`")).toBe(true);
  });

  test("formats a numbered list", () => {
    const text = formatNextSteps(["a", "b"]);
    expect(text).toBe("[diffle] next steps:\n  1. a\n  2. b");
  });
});
