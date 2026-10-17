import { afterAll, describe, expect, test } from "bun:test";
import { registryStore } from "../src/core/migration/installDirWinPath";

// exercises the powershell registry store against a scratch key (never HKCU\Environment)
const subkey = `Software\\nittle-test-${process.pid}-${Date.now()}`;
const env = { ...process.env, NITTLE_ENV_REG_SUBKEY: subkey };

afterAll(() => {
  if (process.platform === "win32") Bun.spawnSync(["reg", "delete", `HKCU\\${subkey}`, "/f"], { stdout: "ignore", stderr: "ignore" });
});

describe.skipIf(process.platform !== "win32")("registryStore", () => {
  test("reads empty, then round-trips a value with an unexpanded %VAR% token", () => {
    const store = registryStore(env);
    expect(store.read()).toBe("");
    store.write("C:\\a;%USERPROFILE%\\bin;D:\\ünï");
    expect(store.read()).toBe("C:\\a;%USERPROFILE%\\bin;D:\\ünï");
  }, 60_000);
});
