// dismissible bar for agent activity noticed by useReviewSync — quiet, not a toast. the bar grows
// open on grid rows like an accordion (21) while it fades and un-blurs in (22); every dismissal
// goes through useOpenClose, so app.js drops the notice only once the close has played.
import { html } from "/preact.js";
import { useOpenClose } from "/motion.js";

const CLOSE_TOKEN = "--toast-close";

function plural(n, noun) { return `${n} ${noun}${n === 1 ? "" : "s"}`; }

function noticeLines(notice) {
  const lines = [];
  if (notice.reopened) lines.push("Review reopened.");
  if (notice.replied) lines.push(`Agent replied to ${plural(notice.replied, "comment")}.`);
  if (notice.addressed) lines.push(`Agent marked ${plural(notice.addressed, "comment")} addressed.`);
  if (notice.rereviewRequested) {
    lines.push(`Agent requested another review.${notice.rereviewSummary ? ` “${notice.rereviewSummary}”` : ""}`);
  }
  return lines;
}

// mounted only while there is something to say, so the open plays when a notice first arrives
function NoticeBar({ lines, rereviewRequested, onRefresh, onDismiss }) {
  const { phase, requestClose } = useOpenClose(onDismiss, CLOSE_TOKEN);
  const refreshAndDismiss = () => { onRefresh(); requestClose(); };
  return html`<div class="sync-notice-track ${phase}">
    <div class="sync-notice-panel">
      <div class="sync-notice" role="status">
        <span class="sync-notice-text">${lines.join(" ")}</span>
        ${rereviewRequested && html`<button class="btn-link" onClick=${refreshAndDismiss}>Refresh diff</button>`}
        <button class="sync-notice-close" aria-label="Dismiss" onClick=${requestClose}>×</button>
      </div>
    </div>
  </div>`;
}

export function SyncNotice({ notice, onRefresh, onDismiss }) {
  if (!notice) return null;
  const lines = noticeLines(notice);
  if (!lines.length) return null;
  return html`<${NoticeBar} lines=${lines} rereviewRequested=${notice.rereviewRequested} onRefresh=${onRefresh} onDismiss=${onDismiss} />`;
}
