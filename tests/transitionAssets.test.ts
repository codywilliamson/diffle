import { describe, expect, test } from "bun:test";
import { carriesTransitionAssets, TRANSITION_ASSET_RELEASES, transitionAssetName } from "../src/core/transitionAssets";

const history = ["v0.27.0", "v0.28.0", "v0.28.1"];

describe("publishedReleaseTags", () => {
  test("only published, non-draft, non-prerelease releases count; an unreadable API is null", async () => {
    const { publishedReleaseTags } = await import("../scripts/publishedReleases");
    const body = [{ tag_name: "v0.29.0" }, { tag_name: "v0.29.1", draft: true }, { tag_name: "v0.29.2", prerelease: true }, {}];
    expect(await publishedReleaseTags(async () => new Response(JSON.stringify(body)), "t")).toEqual(["v0.29.0"]);
    expect(await publishedReleaseTags(async () => new Response("", { status: 403 }), "t")).toBeNull();
    expect(await publishedReleaseTags(async () => { throw new Error("offline"); }, "t")).toBeNull();
  });
});

describe("transitionAssetName", () => {
  test("swaps the product prefix for the legacy one", () => {
    expect(transitionAssetName("nittle-linux-x64")).toBe("diffle-linux-x64");
    expect(transitionAssetName("nittle-windows-arm64.exe")).toBe("diffle-windows-arm64.exe");
  });
});

describe("carriesTransitionAssets", () => {
  test("the first nittle release carries them", () => {
    expect(carriesTransitionAssets("0.29.0", history)).toBe(true);
    expect(carriesTransitionAssets("0.29.0", [...history, "v0.29.0"])).toBe(true);
  });

  test("the first TRANSITION_ASSET_RELEASES releases after 0.28.1 carry them, the next does not", () => {
    const tags = [...history];
    for (let release = 1; release <= TRANSITION_ASSET_RELEASES; release++) {
      expect(carriesTransitionAssets(`0.29.${release - 1}`, tags)).toBe(true);
      tags.push(`v0.29.${release - 1}`);
    }
    expect(carriesTransitionAssets(`0.29.${TRANSITION_ASSET_RELEASES}`, tags)).toBe(false);
  });

  test("a rebuild of an older release still carries them even when later tags exist", () => {
    expect(carriesTransitionAssets("0.29.0", [...history, "v0.29.0", "v0.29.1", "v0.29.2", "v0.29.3"])).toBe(true);
  });

  test("a missing tag list errs towards publishing", () => {
    expect(carriesTransitionAssets("0.29.0", [])).toBe(true);
  });

  test("pre-rename versions and junk tags are ignored", () => {
    expect(carriesTransitionAssets("0.28.1", history)).toBe(true);
    expect(carriesTransitionAssets("0.29.0", ["nonsense", "v0.29.0-rc.1", ...history])).toBe(true);
  });
});
