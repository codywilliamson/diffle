// mobile overflow menu: the view/utility tools live here once the header washes are hidden below 700px.
import { html, useState, useRef, useEffect, useCallback } from "/preact.js";
import { useDismissablePopover } from "/popover.js";
import { Popover } from "/popoverSurface.js";
import { MoreHorizontal } from "/icons.js";

function items(ctx) {
  return [
    { key: "r", label: "Re-run the diff", onClick: ctx.onRefresh },
    { key: "o", label: ctx.viewMode === "single" ? "All-files view" : "Single-file view", onClick: ctx.onToggleView },
    !ctx.browse && { key: "s", label: ctx.splitView ? "Unified (all files)" : "Side-by-side (all files)", onClick: ctx.onToggleSplit },
    { key: "w", label: ctx.wrap ? "No wrap" : "Wrap lines", onClick: ctx.onToggleWrap },
    { key: "t", label: "Toggle theme", onClick: ctx.onToggleTheme },
    { key: "n", label: "What's new", onClick: ctx.onWhatsNew },
    { key: "?", label: "Keyboard shortcuts", onClick: ctx.onHelp },
  ].filter(Boolean);
}

export function OverflowMenu(ctx) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const closeRef = useRef(null); // the menu's animated close, once it is mounted

  // close plays the menu's exit and hands focus back; the menu unmounts once the exit has finished
  const close = () => { closeRef.current?.(); triggerRef.current?.focus(); };
  const onClosed = useCallback(() => setIsOpen(false), []);
  useDismissablePopover({ isOpen, close, panelRef });
  // focus the first item, not the menu container, so arrow keys work immediately
  useEffect(() => { if (isOpen) menuRef.current?.querySelector('[role="menuitem"]')?.focus(); }, [isOpen]);

  const choose = (onClick) => { onClick(); close(); };

  // roving focus: Arrow keys move among items (wrapping), Home/End jump to the ends. Tab is left native.
  const onMenuKeyDown = (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const menuItems = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const at = menuItems.indexOf(document.activeElement);
    const next =
      e.key === "ArrowDown" ? menuItems[(at + 1) % menuItems.length] :
      e.key === "ArrowUp" ? menuItems[(at - 1 + menuItems.length) % menuItems.length] :
      e.key === "Home" ? menuItems[0] : menuItems[menuItems.length - 1];
    e.preventDefault();
    next?.focus();
  };

  return html`<span class="overflow-wash" ref=${panelRef}>
    <button type="button" class="btn-icon icon-btn overflow-trigger" ref=${triggerRef}
      aria-haspopup="menu" aria-expanded=${isOpen} aria-controls="overflow-menu" aria-label="More tools" onClick=${() => (isOpen ? close() : setIsOpen(true))}>
      <${MoreHorizontal} />
    </button>
    ${isOpen && html`<${Popover} id="overflow-menu" class="overflow-menu" origin="top-right" role="menu" aria-label="More tools"
      surfaceRef=${menuRef} onKeyDown=${onMenuKeyDown} onClosed=${onClosed} closeRef=${closeRef}>
      ${items(ctx).map((item) => html`<button type="button" role="menuitem" class="overflow-item" onClick=${() => choose(item.onClick)}>
        <span>${item.label}</span><kbd>${item.key}</kbd>
      </button>`)}
    <//>`}
  </span>`;
}
