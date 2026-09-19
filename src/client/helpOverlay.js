// keyboard-shortcut reference, opened with "?" or the top-bar help button.
import { html } from "/preact.js";
import { shortcutsFor } from "/shortcuts.js";
import { X } from "/icons.js";
import { Modal } from "/modal.js";

// "?" toggles the help, so while open it closes it — through the animated exit, like escape
const CLOSE_KEYS = ["Escape", "?"];

export function HelpOverlay({ onClose, radar = false }) {
  return html`<${Modal} onClose=${onClose} labelledBy="help-title" class="help-modal" closeKeys=${CLOSE_KEYS}>
    ${(close) => [
      html`<header class="modal-head">
        <h2 id="help-title">Keyboard shortcuts</h2>
        <button class="btn-icon" aria-label="Close keyboard shortcuts" onClick=${close}><${X} /></button>
      </header>`,
      html`<div class="help-grid">
        ${shortcutsFor(radar).map(
          ([key, what]) => html`<div class="help-row" key=${key}>
            <kbd>${key}</kbd>
            <span>${what}</span>
          </div>`
        )}
      </div>`,
    ]}
  <//>`;
}
