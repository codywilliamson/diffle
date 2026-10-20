import { describe, expect, it, vi } from "vitest";
import { handlePickerKey } from "./pickerKey";

function setup(open = false, overlay = false) {
  const deps = { isOpen: () => open, close: vi.fn(), open: vi.fn(), overlayOpen: () => overlay };
  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent("keydown", { key: "p", cancelable: true, ...init });
    return { event, consumed: handlePickerKey(event, deps) };
  };
  return { deps, press };
}

describe("picker chord", () => {
  it("Cmd+p opens the picker and blocks print", () => {
    const h = setup();
    const { event, consumed } = h.press({ metaKey: true });
    expect(consumed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(h.deps.open).toHaveBeenCalledTimes(1);
  });

  it("a held Cmd+p opens once, then repeats are dropped but still block print", () => {
    const h = setup();
    h.press({ metaKey: true });
    const { event, consumed } = h.press({ metaKey: true, repeat: true });
    expect(consumed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(h.deps.open).toHaveBeenCalledTimes(1);
  });

  it("a held Ctrl+p does not toggle an open picker closed", () => {
    const h = setup(true);
    const { event, consumed } = h.press({ ctrlKey: true, repeat: true });
    expect(consumed).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(h.deps.close).not.toHaveBeenCalled();
  });

  it("a fresh press closes an open picker", () => {
    const h = setup(true);
    h.press({ ctrlKey: true });
    expect(h.deps.close).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    expect(setup().press({ key: "o", ctrlKey: true }).consumed).toBe(false);
  });
});
