// "what's new" highlights: the auto-pop trigger hook + the modal. content comes from
// whatsNew.js; the version comes from /api/update. the seen-version lives in ~/.loupe/state.json
// (server-side) — not localStorage — so it survives across launches, each of which picks a
// random port and would otherwise get a fresh, empty per-origin store (and re-pop the modal).
import { html, useState, useEffect } from "/preact.js";
import { getState, saveState } from "/api.js";
import { WHATS_NEW, whatsNewFor, shouldAutoShow } from "/whatsNew.js";
import { X, Sparkles } from "/icons.js";
import { Modal } from "/modal.js";

// owns the seen-version + open state. auto-opens once per new version; reopen() is manual.
// seen starts null (not loaded) so the auto-show check waits for the server before deciding.
export function useWhatsNew(current) {
  const [seen, setSeen] = useState(null);
  const [open, setOpen] = useState(false);
  // running version's entry, else the newest, so the manual button always has content.
  const entry = (current && whatsNewFor(current)) || WHATS_NEW[0] || null;
  useEffect(() => {
    getState()
      .then((s) => setSeen(s.seenVersion ?? ""))
      .catch(() => setSeen(""));
  }, []);
  useEffect(() => {
    if (seen !== null && shouldAutoShow(current, seen)) setOpen(true);
  }, [current, seen]);
  const close = () => {
    setOpen(false);
    if (current) {
      setSeen(current);
      saveState({ seenVersion: current }).catch(() => {});
    }
  };
  return { entry, open, close, reopen: () => setOpen(true) };
}

export function WhatsNewModal({ entry, onClose }) {
  if (!entry) return null;
  return html`<${Modal} onClose=${onClose} labelledBy="whatsnew-title" class="whatsnew-modal">
    ${(close) => [
      html`<header class="whatsnew-head">
        <span class="whatsnew-spark"><${Sparkles} /></span>
        <div class="whatsnew-titles">
          <h2 id="whatsnew-title">What's new</h2>
          <span class="whatsnew-sub">loupe ${entry.version}${entry.date ? ` · ${entry.date}` : ""}</span>
        </div>
        <button class="btn-icon" aria-label="Close what's new" onClick=${close}><${X} /></button>
      </header>`,
      html`<ul class="whatsnew-list">
        ${entry.items.map(
          (item) => html`<li class="whatsnew-item" key=${item.title}>
            <span class="whatsnew-item-title">${item.title}</span>
            <span class="whatsnew-item-body">${item.body}</span>
          </li>`
        )}
      </ul>`,
      html`<footer class="modal-foot">
        <button class="btn-primary" onClick=${close}>Got it</button>
      </footer>`,
    ]}
  <//>`;
}
