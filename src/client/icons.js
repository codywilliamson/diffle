// inline svg icons (lucide paths) — robust, no CDN wiring. each returns vnodes.
import { html } from "/preact.js";

const svg = (children, size = 16) => html`<svg
  class="icon"
  width=${size}
  height=${size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>${children}</svg>`;

// accordion chevron: a "v" symmetric about the 16-box centre, wrapped so motion-shell.css can
// flip it with scaleY(-1) while the owning button is aria-expanded (folders, file sections).
export const Chevron = () =>
  html`<span class="chevron-flip" aria-hidden="true"><svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5L8 10.5L12 6.5" /></svg></span>`;
export const ChevronDown = () => svg(html`<path d="m6 9 6 6 6-6" />`);

export const Bubble = () =>
  svg(html`<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />`, 14);

export const Copy = () =>
  svg(html`<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path
    d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
  />`);

export const X = () =>
  svg(html`<path d="M18 6 6 18" /><path d="m6 6 12 12" />`);

export const MessageSquare = () =>
  svg(html`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />`, 14);

export const Sun = () =>
  svg(html`<circle cx="12" cy="12" r="4" /><path
    d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
  />`);

export const Moon = () =>
  svg(html`<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />`);

// sparkles — the "what's new" highlights button
export const Sparkles = () =>
  svg(html`<path
    d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z"
  /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />`);

// wrap-text — the word-wrap toggle
export const WrapText = () =>
  svg(html`<path d="M3 6h18" /><path d="M3 12h15a3 3 0 1 1 0 6h-4" /><polyline points="16 16 14 18 16 20" /><path d="M3 18h7" />`);

export const Refresh = () =>
  svg(html`<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path
    d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
  /><path d="M3 21v-5h5" />`);

export const HelpCircle = () =>
  svg(html`<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />`);

export const Settings = () =>
  svg(html`<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />`);

// side-by-side (two columns) — global split toggle
export const Columns = () =>
  svg(html`<rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 3v18" />`);

// single document — single-file view toggle
export const File = () =>
  svg(html`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" />`);

// three dots — the mobile overflow menu trigger
export const MoreHorizontal = () =>
  svg(html`<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />`);

// Loupe's split-aperture mark: opposing proof brackets, center seam, anchor dot.
export const ApertureMark = ({ size = 22 } = {}) => html`<svg class="aperture-mark" width=${size} height=${size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4 5.5v13M4 5.5h5M4 18.5h5M20 5.5v13M20 5.5h-5M20 18.5h-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
  <path d="M12 4v16" stroke="currentColor" stroke-width="1.1" opacity=".6" />
  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
</svg>`;
