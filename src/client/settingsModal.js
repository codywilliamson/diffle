// User-level settings persisted by Loupe's server so they survive random local ports.
import { html, useEffect, useRef, useState } from "/preact.js";
import { getState, saveState } from "/api.js";
import { Modal } from "/modal.js";
import { X } from "/icons.js";
import { RADAR_MODE_EVENT, RADAR_MODE_OPTIONS } from "/settingsModel.js";

export function SettingsModal({ onClose }) {
  const [mode, setMode] = useState("off");
  const [saved, setSaved] = useState("off");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const closeButton = useRef(null);

  useEffect(() => {
    getState().then((state) => {
      const value = state.radarMode ?? "off";
      setMode(value);
      setSaved(value);
    }).catch((cause) => setError(String(cause))).finally(() => setLoading(false));
  }, []);
  useEffect(() => closeButton.current?.focus(), []);

  const submit = async (event, close) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveState({ radarMode: mode });
      setSaved(mode);
      window.dispatchEvent(new CustomEvent(RADAR_MODE_EVENT, { detail: { mode } }));
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return html`<${Modal} onClose=${onClose} labelledBy="settings-title" class="settings-modal">
    ${(close) => html`<form onSubmit=${(event) => submit(event, close)}>
      <header class="modal-head">
        <div><p class="settings-kicker">Privacy and analysis</p><h2 id="settings-title">Settings</h2></div>
        <button type="button" class="btn-icon icon-btn" ref=${closeButton} aria-label="Close settings" onClick=${close}><${X} /></button>
      </header>
      <fieldset class="settings-group" disabled=${loading || saving}>
        <legend>Radar mode</legend>
        <p class="settings-intro">Choose how Loupe prioritizes review work. This applies across repositories.</p>
        <div class="settings-options">
          ${RADAR_MODE_OPTIONS.map((option) => html`<label class="settings-option ${mode === option.value ? "is-selected" : ""}">
            <input type="radio" name="radar-mode" value=${option.value} checked=${mode === option.value}
              onChange=${() => setMode(option.value)} />
            <span class="settings-copy"><span class="settings-name">${option.label}</span>
              <span class="settings-badge">${option.badge}</span><span>${option.description}</span></span>
          </label>`)}
        </div>
        <p class="settings-note">Provider credentials remain in the Loupe server process. Jev mode is rejected unless a provider is configured.</p>
        ${error && html`<p class="settings-error" role="alert">${error}</p>`}
      </fieldset>
      <footer class="modal-foot settings-actions">
        <span class="settings-saved">${loading ? "Loading preference…" : mode === saved ? "Saved" : "Unsaved change"}</span>
        <button type="button" class="btn-plain" onClick=${close}>Cancel</button>
        <button type="submit" class="btn-primary" disabled=${loading || saving || mode === saved}>${saving ? "Saving…" : "Save"}</button>
      </footer>
    </form>`}
  <//>`;
}
