// right pane: each file as a collapsible section with hunks + a per-file split toggle.
import { html, useState, useRef, useMemo, memo } from "/preact.js";
import { changeBadge, fileAnchorId, isMarkdown, lineCountOf, estimatedHeight } from "/util.js";
import { LazyMount } from "/lazySection.js";
import { Chevron, MessageSquare } from "/icons.js";
import { UnifiedHunk, SplitHunk } from "/diffLines.js";
import { CommentThread, CommentEditor } from "/comments.js";
import { MarkdownView } from "/markdownView.js";
import { SplitResizer } from "/splitResizer.js";
import { usePaneWidths, setPaneShift, useShiftScroll } from "/splitScroll.js";
import { makeThreads } from "/threads.js";

const GIANT_FILE_LINES = 2000; // above this the body is hidden behind a load-diff button

// added/deleted files only ever have content on one side — split view would show a blank column.
function isSingleSided(file) {
  return file.changeType === "added" || file.changeType === "deleted";
}

function FileHeader({ file, open, split, md, preview, browse, onToggleOpen, onToggleSplit, onTogglePreview, onAddFileComment }) {
  const title = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
  return html`<div class="file-head">
    <button class="file-collapse" aria-expanded=${open} aria-label=${open ? "Collapse file" : "Expand file"} onClick=${onToggleOpen}><${Chevron} /></button>
    ${!browse && html`<span class="badge badge-${file.changeType}">${changeBadge(file.changeType)}</span>`}
    <span class="file-path" title=${title}>${title}</span>
    ${!browse &&
    html`<span class="file-delta"><span class="add">+${file.additions}</span> <span class="del">-${file.deletions}</span></span>`}
    <span class="file-tools">
      <button class="btn-plain" title="Add file comment" onClick=${onAddFileComment}><${MessageSquare} /></button>
      ${md &&
      html`<button class="btn-toggle ${preview ? "on" : ""}" onClick=${onTogglePreview}>${preview ? "Preview" : "Diff"}</button>`}
      ${(!md || !preview) && !browse && !isSingleSided(file) &&
      html`<button class="btn-toggle ${split ? "on" : ""}" onClick=${onToggleSplit}>${split ? "Side-by-side" : "Unified"}</button>`}
    </span>
  </div>`;
}

function FileSectionImpl({ file, splitView, browse, wrap, radar, fileComments, adding, selecting, setAdding, setSelecting, onAdd, onEdit, onDelete, onResolve, onReply }) {
  const threads = makeThreads(file, { fileComments, adding, selecting, setAdding, setSelecting, onAdd, onEdit, onDelete, onResolve, onReply });
  // radar units for this file, grouped by hunk index, so each hunk owns its evidence.
  const unitsByHunk = useMemo(() => {
    const m = new Map();
    for (const u of radar?.unitsByFile.get(file.path) ?? []) (m.get(u.hunk) ?? m.set(u.hunk, []).get(u.hunk)).push(u);
    return m;
  }, [radar, file.path]);
  const md = isMarkdown(file.path) && file.changeType !== "deleted";
  const [open, setOpen] = useState(true);
  const tableRef = useRef(null);
  const [bodyLive, setBodyLive] = useState(false);
  // Include the file object, not just its stable path: a diff refresh can replace
  // the lines in-place and introduce overflow that needs a newly sized scrollbar.
  const paneW = usePaneWidths(tableRef, [file, wrap, open, bodyLive]);
  useShiftScroll(tableRef, bodyLive);
  // split follows the global toggle; a per-file toggle overrides it until the next global flip.
  // derived from the prop each render (no effect) so a global flip always takes — never gets stuck.
  const [override, setOverride] = useState(null);
  const lastGlobal = useRef(splitView);
  const globalFlipped = lastGlobal.current !== splitView;
  if (globalFlipped) {
    lastGlobal.current = splitView;
    if (override !== null) setOverride(null);
  }
  const split = isSingleSided(file) ? false : globalFlipped ? splitView : override ?? splitView;
  const [preview, setPreview] = useState(false); // show the diff first; the Preview toggle renders markdown
  const [ratio, setRatio] = useState(0.5); // side-by-side pane split (left pane's share)
  const fileLevelComments = threads.commentsForFile();
  const lines = lineCountOf(file);
  const [forceShow, setForceShow] = useState(false);
  const giant = lines > GIANT_FILE_LINES && !forceShow;
  return html`<section class="file-section" id=${fileAnchorId(file.path)}>
    <${FileHeader}
      file=${file}
      open=${open}
      split=${split}
      md=${md}
      preview=${preview}
      browse=${browse}
      onToggleOpen=${() => setOpen(!open)}
      onToggleSplit=${() => setOverride(!split)}
      onTogglePreview=${() => setPreview(!preview)}
      onAddFileComment=${threads.onStartFileAdd}
    />
    ${open &&
    html`<div class="file-body${split ? " split-body" : ""}">
      ${(fileLevelComments.length > 0 || threads.addingFile) &&
      html`<div class="file-comments">
        <${CommentThread} comments=${fileLevelComments} onEdit=${threads.onEdit} onDelete=${threads.onDelete} onResolve=${threads.onResolve} onReply=${threads.onReply} />
        ${threads.addingFile &&
        html`<${CommentEditor} onSave=${(t, tag) => threads.onAddFile(t, tag)} onCancel=${threads.onCancelAdd} />`}
      </div>`}
      ${giant
        ? html`<div class="giant-note">
            Large diff (${lines.toLocaleString()} lines) — hidden to keep things fast.
            <button class="btn-toggle" onClick=${() => setForceShow(true)}>Load diff</button>
          </div>`
        : html`<${LazyMount} estimate=${estimatedHeight(file)} keepMounted=${adding != null || selecting != null} onVisible=${setBodyLive}>
      ${md && preview
        ? html`<${MarkdownView} path=${file.path} />`
        : file.binary
          ? html`<div class="binary-note">Binary file — no preview</div>`
          : split
            ? html`<div class="split-wrap">
                <table class="diff-table split" ref=${tableRef}>
                  <colgroup>
                    <col class="cg-bubble" />
                    <col class="cg-no" />
                    <col style=${`width: ${(ratio * 100).toFixed(2)}%`} />
                    <col class="cg-bubble" />
                    <col class="cg-no" />
                    <col style=${`width: ${((1 - ratio) * 100).toFixed(2)}%`} />
                  </colgroup>
                  ${file.hunks.map((hunk, i) => html`<${SplitHunk} key=${i} hunk=${hunk} path=${file.path} threads=${threads} radar=${radar} hunkUnits=${unitsByHunk.get(i)} />`)}
                  ${!wrap &&
                  html`<tbody class="hscroll-row">
                    <tr>
                      <td></td><td></td>
                      <td><div class="hscroll hscroll-old" onScroll=${(e) => setPaneShift(tableRef, "old", e.currentTarget.scrollLeft)}><div class="hscroll-spacer" style=${`width:${paneW.old}px`}></div></div></td>
                      <td></td><td></td>
                      <td><div class="hscroll hscroll-new" onScroll=${(e) => setPaneShift(tableRef, "new", e.currentTarget.scrollLeft)}><div class="hscroll-spacer" style=${`width:${paneW.new}px`}></div></div></td>
                    </tr>
                  </tbody>`}
                </table>
                <${SplitResizer} ratio=${ratio} onRatio=${setRatio} />
              </div>`
            : html`<table class="diff-table">
                ${file.hunks.map((hunk, i) => html`<${UnifiedHunk} key=${i} hunk=${hunk} path=${file.path} threads=${threads} browse=${browse} radar=${radar} hunkUnits=${unitsByHunk.get(i)} />`)}
              </table>`}
    </${LazyMount}>`}
    </div>`}
  </section>`;
}

// memoized so a single file's interaction (drag-select, comment add) only re-renders
// that section — untouched sections keep shallow-stable props and skip.
const FileSection = memo(FileSectionImpl);

const EMPTY = [];

export function DiffView({ files, viewMode, activeFile, splitView, browse, wrap, radar, comments, adding, setAdding, selecting, setSelecting, onAdd, onEdit, onDelete, onResolve, onReply }) {
  // group once per comments change so untouched files keep an identical array prop.
  const byFile = useMemo(() => {
    const m = new Map();
    for (const c of comments) {
      const list = m.get(c.file);
      list ? list.push(c) : m.set(c.file, [c]);
    }
    return m;
  }, [comments]);
  // single-file view shows just the active file (first file as a fallback); all-files shows the stack.
  const shown = viewMode === "single" ? [files.find((f) => f.path === activeFile) ?? files[0]].filter(Boolean) : files;
  return html`<main class="diff-pane ${wrap ? "wrap" : ""}">
    ${shown.map(
      (file) => html`<${FileSection}
        key=${file.path}
        file=${file}
        splitView=${splitView}
        browse=${browse}
        wrap=${wrap}
        radar=${radar}
        fileComments=${byFile.get(file.path) ?? EMPTY}
        adding=${adding && adding.file === file.path ? adding : null}
        selecting=${selecting && selecting.file === file.path ? selecting : null}
        setAdding=${setAdding}
        setSelecting=${setSelecting}
        onAdd=${onAdd}
        onEdit=${onEdit}
        onDelete=${onDelete}
        onResolve=${onResolve}
        onReply=${onReply}
      />`
    )}
  </main>`;
}
