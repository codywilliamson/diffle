import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverflowMenu from "./OverflowMenu.svelte";

const actions = {
  onRefresh: vi.fn(),
  onToggleFileView: vi.fn(),
  onToggleSplit: vi.fn(),
  onToggleWrap: vi.fn(),
  onToggleTheme: vi.fn(),
  onWhatsNew: vi.fn(),
  onHelp: vi.fn(),
};

function renderMenu(overrides: Partial<{ fileView: "all" | "single"; split: boolean; wrap: boolean }> = {}) {
  return render(OverflowMenu, {
    fileView: "all",
    split: false,
    wrap: false,
    ...actions,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
});

describe("OverflowMenu", () => {
  it("opens on the first action and exposes the mobile tool parity set", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More tools" });

    await fireEvent.click(trigger);
    const menu = await screen.findByRole("menu", { name: "More tools" });
    const menuItems = within(menu).getAllByRole("menuitem");

    await waitFor(() => expect(menuItems[0]).toHaveFocus());
    expect(menuItems.map((item) => item.textContent)).toEqual([
      "Re-run the diff r",
      "Single-file view o",
      "Side-by-side (all files) s",
      "Wrap lines w",
      "Toggle theme t",
      "What's new n",
      "Keyboard shortcuts ?",
    ]);

    await fireEvent.click(within(menu).getByRole("menuitem", { name: /Single-file view/ }));
    expect(actions.onToggleFileView).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses labels that describe how active toggles will change", async () => {
    renderMenu({ fileView: "single", split: true, wrap: true });
    await fireEvent.click(screen.getByRole("button", { name: "More tools" }));
    const menu = await screen.findByRole("menu", { name: "More tools" });

    expect(within(menu).getByRole("menuitem", { name: /All-files view/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Unified \(all files\)/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /No wrap/ })).toBeInTheDocument();
  });

  it("supports arrow, boundary, and escape keyboard navigation", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More tools" });
    await fireEvent.click(trigger);
    const menu = await screen.findByRole("menu", { name: "More tools" });
    const menuItems = within(menu).getAllByRole("menuitem");
    const first = menuItems[0]!;
    const second = menuItems[1]!;
    const last = menuItems.at(-1)!;

    await waitFor(() => expect(first).toHaveFocus());
    await fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    await fireEvent.keyDown(second, { key: "End" });
    expect(last).toHaveFocus();
    await fireEvent.keyDown(last, { key: "ArrowDown" });
    expect(first).toHaveFocus();
    await fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(last).toHaveFocus();
    await fireEvent.keyDown(last, { key: "Home" });
    expect(first).toHaveFocus();
    await fireEvent.keyDown(first, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("dismisses on an outside press and restores trigger focus", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More tools" });
    await fireEvent.click(trigger);
    await screen.findByRole("menu", { name: "More tools" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
