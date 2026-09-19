import { describe, expect, test } from "bun:test";
import type { RadarPacket } from "../src/types";
import { askJev, providerFromEnv } from "../src/radar/provider";

const packet: RadarPacket = { schemaVersion: 1, questionSetVersion: "radar-q1", model: "jev",
  file: { path: "a.ts", oldPath: null, language: "ts", changeType: "modified", additions: 1, deletions: 1 },
  unit: { id: "u", hunk: 0, line: 1, side: "new", patch: "+return true", contextTruncated: false, evidence: [] } };
const result = { model: "jev-1.13", answers: {
  attention: { type: "noul", noul: 0.8 }, impact: { type: "score", score: 2, probabilities: { "0": 0, "1": 0.1, "2": 0.7, "3": 0.2 } },
  kind: { type: "choice", choice: "control_flow", probabilities: { control_flow: 1 } }, evidence_sufficient: { type: "noul", noul: 0.75 },
} };

describe("Radar providers", () => {
  test("requires explicit Radar enablement even when a provider key exists", () => {
    expect(providerFromEnv({ OPENROUTER_API_KEY: "secret" })).toBeNull();
    expect(providerFromEnv({ LOUPE_RADAR: "1", OPENROUTER_API_KEY: "secret" })?.provider).toBe("openrouter");
    expect(() => providerFromEnv({ LOUPE_RADAR_PROVIDER: "unknown" })).toThrow("unsupported Radar provider");
    expect(() => providerFromEnv({ LOUPE_RADAR_PROVIDER: "openrouter" })).toThrow("openrouter Radar credentials");
    expect(() => providerFromEnv({ LOUPE_RADAR_PROVIDER: "cloudflare" })).toThrow("cloudflare Radar credentials");
  });

  test("sends the OpenRouter decisions protocol", async () => {
    let request: RequestInit | undefined;
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => { request = init; return Response.json(result); }) as typeof fetch;
    const config = providerFromEnv({ LOUPE_RADAR_PROVIDER: "openrouter", OPENROUTER_API_KEY: "secret" })!;
    expect((await askJev(config, packet, fetchFn)).answers.attention?.noul).toBe(0.8);
    const body = JSON.parse(String(request?.body));
    expect(body.model).toBe("typesafe/jev-1.13");
    expect(body.state.unit.id).toBe("u");
    expect(body.questions.attention.type).toBe("noul");
    expect(body.input).toBeUndefined();
  });

  test("wraps Cloudflare input and accepts its REST envelope", async () => {
    let body: Record<string, unknown> = {};
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => { body = JSON.parse(String(init?.body)); return Response.json({ result, success: true }); }) as typeof fetch;
    const config = providerFromEnv({ LOUPE_RADAR_PROVIDER: "cloudflare", CLOUDFLARE_API_TOKEN: "secret", CLOUDFLARE_ACCOUNT_ID: "account" })!;
    expect((await askJev(config, packet, fetchFn)).model).toBe("jev-1.13");
    expect(body.model).toBe("typesafe/jev");
    expect((((body.input as Record<string, unknown>).state as RadarPacket).unit).id).toBe("u");
  });

  test("rejects a successful response missing required typed answers", async () => {
    const fetchFn = (async () => Response.json({ model: "jev", answers: { attention: { type: "noul", noul: 0.5 } } })) as unknown as typeof fetch;
    const config = providerFromEnv({ LOUPE_RADAR_PROVIDER: "openrouter", OPENROUTER_API_KEY: "secret" })!;
    expect(askJev(config, packet, fetchFn)).rejects.toThrow("required typed answer");
  });
});
