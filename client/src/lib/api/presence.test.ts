import { afterEach, describe, expect, it, vi } from "vitest";
import { connectPresence } from "./presence";

describe("connectPresence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens one stream to /api/presence and closes it on pagehide", () => {
    const close = vi.fn();
    const ctor = vi.fn(function (this: { close: () => void }) { this.close = close; });
    vi.stubGlobal("EventSource", ctor);
    const source = connectPresence();
    expect(source).not.toBeNull();
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith("/api/presence");
    expect(close).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pagehide"));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does nothing where EventSource is unavailable", () => {
    vi.stubGlobal("EventSource", undefined);
    expect(connectPresence()).toBeNull();
  });
});
