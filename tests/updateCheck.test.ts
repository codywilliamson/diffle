import { describe, it, expect, beforeEach } from "bun:test";
import { join } from "node:path";
import { checkForUpdate, latestVersion, releasesApiUrl, resetUpdateCache } from "../src/core/updateCheck";

const root = join(import.meta.dir, ".."); // currentVersion reads this repo's package.json

describe("latestVersion", () => {
  it("returns a higher tag when one exists", () => {
    expect(latestVersion("0.3.0", ["v0.1.0", "v0.3.0", "v0.4.0"])).toBe("0.4.0");
  });

  it("ignores non-semver tags", () => {
    expect(latestVersion("0.3.0", ["nightly", "v0.3.0", "latest"])).toBe("0.3.0");
  });

  it("stays at current when nothing is newer", () => {
    expect(latestVersion("1.2.3", ["v1.0.0", "v1.2.3"])).toBe("1.2.3");
  });

  it("compares numerically, not lexically", () => {
    expect(latestVersion("0.9.0", ["v0.10.0"])).toBe("0.10.0");
  });

  it("accepts tags with or without a v prefix", () => {
    expect(latestVersion("0.3.0", ["0.4.0"])).toBe("0.4.0");
  });

  it("returns current when there are no tags", () => {
    expect(latestVersion("0.3.0", [])).toBe("0.3.0");
  });
});

describe("checkForUpdate", () => {
  beforeEach(() => resetUpdateCache());

  it("targets the configured repo's releases api", () => {
    expect(releasesApiUrl()).toMatch(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases/);
  });

  it("reports behind when a newer release is published", async () => {
    const status = await checkForUpdate(root, async () => ["v999.0.0"]);
    expect(status.behind).toBe(true);
    expect(status.latest).toBe("999.0.0");
  });

  it("reports up to date and never throws when the channel is unreachable", async () => {
    const status = await checkForUpdate(root, async () => []);
    expect(status.behind).toBe(false);
    expect(status.latest).toBe(status.current);
  });
});
