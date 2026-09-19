// top bar: wordmark + diff context + counts on the left; review, preview, view tools and utilities on the right.
import { html } from "/preact.js";
import { totalDelta } from "/util.js";
import { Sun, Moon, Refresh, Columns, File, HelpCircle, Sparkles, WrapText, ApertureMark } from "/icons.js";
import { THEMES, THEME_LABELS } from "/theme.js";
import { UpdateBadge } from "/update.js";
import { ReviewPanel } from "/reviewPanel.js";
import { OverflowMenu } from "/overflowMenu.js";

// repo + mode + "source → target" so you know exactly what you're reviewing.
// browse mode has no source/target pair — just the repo + mode pill.
function DiffInfo({ meta, refLabel }) {
  if (!meta) return html`<span class="ref-label" title=${refLabel}>${refLabel}</span>`;
  if (meta.mode === "browse")
    return html`<span class="diff-info">
      <span class="repo-name" title=${meta.repo}>${meta.repo}</span>
      <span class="mode-pill">${meta.mode}</span>
    </span>`;
  return html`<span class="diff-info">
    <span class="repo-name" title=${meta.repo}>${meta.repo}</span>
    <span class="mode-pill">${meta.mode}</span>
    <span class="ref-pair" title=${`${meta.source} → ${meta.target}`}>
      ${meta.source} <span class="arrow">→</span> ${meta.target}
    </span>
  </span>`;
}

export function TopBar({
  refLabel,
  meta,
  files,
  theme,
  refreshing,
  viewMode,
  splitView,
  wrap,
  update,
  onRefresh,
  onToggleTheme,
  onToggleView,
  onToggleSplit,
  onToggleWrap,
  onCompile,
  previewDisabled,
  onHelp,
  onWhatsNew,
  reviewId,
  record,
  refreshRecord,
  comments,
  onToggleFiles,
}) {
  const { add, del } = totalDelta(files);
  const browse = meta?.mode === "browse";
  const viewTip = `${viewMode === "single" ? "All-files view" : "Single-file view"} (o)`;
  const splitTip = `${splitView ? "Unified (all files)" : "Side-by-side (all files)"} (s)`;
  const wrapTip = `${wrap ? "No wrap" : "Wrap lines"} (w)`;
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const themeTip = `Theme: ${THEME_LABELS[theme]} — switch to ${THEME_LABELS[next]} (t)`;
  return html`<header class="top-bar">
    <div class="top-left">
      <span class="brand-lockup"><${ApertureMark} /><span class="wordmark">loupe</span></span>
      <${UpdateBadge} status=${update} />
      <${DiffInfo} meta=${meta} refLabel=${refLabel} />
      <span class="orient">
        <span class="file-count">${files.length} file${files.length === 1 ? "" : "s"}</span>
        ${!browse &&
        html`<span class="top-delta">
          <span class="add">+${add}</span>
          <span class="del">-${del}</span>
        </span>`}
      </span>
    </div>
    <div class="top-right">
      <span class="review-segment">
        <${ReviewPanel} reviewId=${reviewId} record=${record} refreshRecord=${refreshRecord} comments=${comments} />
        <button class="btn-preview" disabled=${previewDisabled} title=${previewDisabled ? "Preview uses live review data and is unavailable in the Radar demo" : undefined} onClick=${onCompile}>Preview</button>
      </span>
      <button class="btn-icon icon-btn files-toggle" data-tip="Browse files" aria-label="Browse files" onClick=${onToggleFiles}>
        <${File} /><span class="mobile-action-label">Files</span>
      </button>
      <span class="tool-wash view-controls" role="group" aria-label="View controls">
        <button class="btn-icon icon-btn ${refreshing ? "spinning" : ""}" data-tip="Re-run the diff (r)" aria-label="Re-run the diff (r)" onClick=${onRefresh}><${Refresh} /></button>
        <button class="btn-icon icon-btn view-toggle ${viewMode === "single" ? "on" : ""}" data-tip=${viewTip} aria-label=${viewTip} onClick=${onToggleView}><${File} /></button>
        ${!browse && html`<button class="btn-icon icon-btn split-toggle ${splitView ? "on" : ""}" data-tip=${splitTip} aria-label=${splitTip} onClick=${onToggleSplit}><${Columns} /></button>`}
        <button class="btn-icon icon-btn ${wrap ? "on" : ""}" data-tip=${wrapTip} aria-label=${wrapTip} onClick=${onToggleWrap}><${WrapText} /></button>
      </span>
      <span class="tool-wash utility-controls" role="group" aria-label="Loupe utilities">
        <button class="btn-icon icon-btn" data-tip=${themeTip} aria-label=${themeTip} onClick=${onToggleTheme}>
          <span class="icon-swap" data-state=${theme}>
            <span class="icon-slot" data-icon="light"><${Sun} /></span>
            <span class="icon-slot" data-icon="dark"><${Moon} /></span>
          </span>
        </button>
        <button class="btn-icon icon-btn" data-tip="What's new (n)" aria-label="What's new (n)" onClick=${onWhatsNew}><${Sparkles} /></button>
        <button class="btn-icon icon-btn" data-tip="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick=${onHelp}><${HelpCircle} /></button>
      </span>
      <${OverflowMenu} browse=${browse} viewMode=${viewMode} splitView=${splitView} wrap=${wrap} theme=${theme}
        onRefresh=${onRefresh} onToggleView=${onToggleView} onToggleSplit=${onToggleSplit} onToggleWrap=${onToggleWrap}
        onToggleTheme=${onToggleTheme} onWhatsNew=${onWhatsNew} onHelp=${onHelp} />
    </div>
  </header>`;
}
