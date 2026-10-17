import { afterEach, describe, expect, it, vi } from "vitest";
import { connectPresence } from "./presence";

// captures the window listeners connectPresence registers, so each test drives only its own.
function setup() {
  const closes: Array<ReturnType<typeof vi.fn>> = [];
  const ctor = vi.fn(function (this: { close: () => void }) {
    const close = vi.fn();
    closes.push(close);
    this.close = close;
  });
  vi.stubGlobal("EventSource", ctor);
  const handlers: Record<string, (event: Event) => void> = {};
  vi.spyOn(window, "addEventListener").mockImplementation(((type: string, handler: (event: Event) => void) => {
    handlers[type] = handler;
  }) as typeof window.addEventListener);
  return { ctor, closes, handlers };
}

describe("connectPresence", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("opens one stream to /api/presence and closes it on pagehide", () => {
    const { ctor, closes, handlers } = setup();
    expect(connectPresence()).not.toBeNull();
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith("/api/presence");
    expect(closes[0]).not.toHaveBeenCalled();
    handlers.pagehide!(new Event("pagehide"));
    expect(closes[0]).toHaveBeenCalledTimes(1);
  });

  it("reconnects when the page returns from the back/forward cache", () => {
    const { ctor, closes, handlers } = setup();
    connectPresence();
    handlers.pagehide!(new Event("pagehide"));
    handlers.pageshow!(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(ctor).toHaveBeenCalledTimes(2);
    handlers.pagehide!(new Event("pagehide"));
    expect(closes[1]).toHaveBeenCalledTimes(1);
  });

  it("does not open a second stream on a normal pageshow", () => {
    const { ctor, handlers } = setup();
    connectPresence();
    handlers.pageshow!(Object.assign(new Event("pageshow"), { persisted: false }));
    handlers.pagehide!(new Event("pagehide"));
    handlers.pageshow!(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it("does nothing where EventSource is unavailable", () => {
    vi.stubGlobal("EventSource", undefined);
    expect(connectPresence()).toBeNull();
  });
});
