// renders diff rows (unified + side-by-side) with hover bubble gutter and inline comment slots.
import { html, useMemo } from "/preact.js";
import { highlightLine } from "/highlight.js";
import { Bubble } from "/icons.js";
import { CommentThread, CommentEditor } from "/comments.js";
import { pairLines, hunkMarks, markRange } from "/wordDiff.js";
import { startSelect } from "/dragSelect.js";
import { HunkChips, ProofNoteRow } from "/radar/hunkProof.js";
import { withProof } from "/radar/proofRows.js";

// the selected radar unit on this hunk, if any — anchors the compact chips + expanded note.
function selectedUnit(radar, hunkUnits) {
  return radar && hunkUnits ? hunkUnits.find((u) => u.id === radar.selectedId) : null;
}

const SIGN = { addition: "+", deletion: "-", context: " " };

// highlight every line of a hunk once (memoized by the caller), keyed by line object so rows
// look up pre-rendered html instead of re-highlighting on every render (drag-select, comments).
function highlightMap(lines, path) {
  const map = new Map();
  for (const line of lines) map.set(line, highlightLine(line.content, path));
  return map;
}

// code cell rendering pre-highlighted html; `mark` wraps the intra-line changed range
// of a modified pair in a tinted <mark>.
function Code({ line, hl, mark, side }) {
  let inner = hl;
  if (mark) inner = markRange(inner, mark.start, mark.end, `wd wd-${line.type}`);
  return html`<td class="code code-${line.type}${side ? " " + side : ""}">
    <span class="code-shift"><span class="sign">${SIGN[line.type]}</span><span
      class="code-inner"
      dangerouslySetInnerHTML=${{ __html: inner }}
    ></span></span>
  </td>`;
}

// cell spans [lead, cell, trail] so the comment box sits under the pane it belongs to:
// unified = box under the code column; split = box under the old (left) or new (right) pane.
// browse drops the old-line column, so its lead is one narrower — get this wrong and the
// comment row declares more columns than the diff rows, pushing the box off to the right.
function commentLayout(variant, side) {
  if (variant === "split") return side === "old" ? [0, 3, 3] : [3, 3, 0];
  return [variant === "browse" ? 2 : 3, 1, 0];
}

// the per-row comment region: one comment row PER anchor, aligned under its side, with the
// existing thread + an inline editor when adding here. anchors are {side, line, lineObj}.
function LineComments({ anchors, threads, variant = "unified" }) {
  return anchors.map((a) => {
    const list = threads.commentsForLine(a.side, a.line);
    const adding = threads.isAddingAt(a.side, a.line);
    if (list.length === 0 && !adding) return null;
    const [lead, cell, trail] = commentLayout(variant, a.side);
    return html`<tr class="comment-row">
      ${lead > 0 && html`<td class="gutter" colspan=${lead}></td>`}
      <td class="comment-cell" colspan=${cell}>
        ${list.length > 0 &&
        html`<${CommentThread} comments=${list} onEdit=${threads.onEdit} onDelete=${threads.onDelete} onResolve=${threads.onResolve} onReply=${threads.onReply} />`}
        ${adding &&
        html`<${CommentEditor}
          onSave=${(text, tag) => threads.onAdd(a.side, a.lineObj, text, tag)}
          onCancel=${threads.onCancelAdd}
        />`}
      </td>
      ${trail > 0 && html`<td class="gutter" colspan=${trail}></td>`}
    </tr>`;
  });
}

// one unified row plus its comment region. the bubble is ALWAYS rendered (hidden via
// css until row hover) so the gutter column never resizes — no layout jump on hover.
// two root nodes: htm returns them as an array, preact renders them as siblings
// (a fragment shorthand <>…</> isn't registered on this raw htm.bind(h) and breaks).
// browse mode shows whole files (all-context): old === new, so the old column is dropped.
function UnifiedRow({ line, hl, threads, mark, browse }) {
  // additions + context anchor on the new side; deletions anchor on the old side.
  const newLine = line.newLine;
  const oldLine = line.type === "deletion" ? line.oldLine : null;
  const side = newLine != null ? "new" : oldLine != null ? "old" : null;
  const anchor = newLine != null ? newLine : oldLine;
  const commentable = anchor != null;
  const selected = commentable && threads.pendingAt(side, anchor);
  const inRange = commentable && threads.rangeAt(side, anchor);
  const cls = `diff-row row-${line.type}${selected ? " range-selected" : ""}${inRange ? " in-range" : ""}`;
  return html`
    <tr class="${cls}" data-newline=${newLine ?? ""} data-oldline=${oldLine ?? ""}>
      <td class="bubble-gutter">
        ${commentable &&
        html`<button class="bubble-btn" title="Comment — drag or shift-click to select a range" onMouseDown=${(e) => startSelect(e, side, anchor, threads)}><${Bubble} /></button>`}
      </td>
      ${!browse &&
      html`<td class="lineno old-no${commentable ? " sel" : ""}" onMouseDown=${commentable ? (e) => startSelect(e, side, anchor, threads) : undefined}>${line.oldLine ?? ""}</td>`}
      <td class="lineno new-no${commentable ? " sel" : ""}" onMouseDown=${commentable ? (e) => startSelect(e, side, anchor, threads) : undefined}>${line.newLine ?? ""}</td>
      <${Code} line=${line} hl=${hl.get(line)} mark=${mark} />
    </tr>
    <${LineComments} anchors=${commentable ? [{ side, line: anchor, lineObj: line }] : []} threads=${threads} variant=${browse ? "browse" : "unified"} />
  `;
}

export function UnifiedHunk({ hunk, path, threads, browse, radar, hunkUnits }) {
  const marks = useMemo(() => hunkMarks(hunk.lines), [hunk]);
  const hl = useMemo(() => highlightMap(hunk.lines, path), [hunk, path]);
  const cols = browse ? 3 : 4;
  const sel = selectedUnit(radar, hunkUnits);
  return html`<tbody>
    ${(hunk.header || hunkUnits) &&
    html`<tr class="hunk-header">
      <td colspan=${cols}>${hunk.header && html`<span class="hunk-pill">${hunk.header}</span>`}${hunkUnits && html`<${HunkChips} units=${hunkUnits} radar=${radar} />`}</td>
    </tr>`}
    ${withProof(hunk.lines, sel,
      (line, unit) => (unit.side === "old" ? line.oldLine : line.newLine) === unit.line,
      (l, i) => html`<${UnifiedRow} key=${i} line=${l} hl=${hl} threads=${threads} mark=${marks.get(l)} browse=${browse} />`,
      (unit) => html`<${ProofNoteRow} unit=${unit} radar=${radar} colSpan=${cols} />`)}
  </tbody>`;
}

function Side({ line, hl, side, mark, onLineDown }) {
  if (!line) return html`<td class="lineno ${side}-no empty"></td><td class="code code-empty ${side}"></td>`;
  const no = side === "old" ? line.oldLine : line.newLine;
  return html`<td class="lineno ${side}-no${onLineDown ? " sel" : ""}" onMouseDown=${onLineDown}>${no ?? ""}</td><${Code} line=${line} hl=${hl} mark=${mark} side=${side} />`;
}

// one side-by-side row: an old-side bubble (any line present on the old side — removed or
// unchanged) + the old cells, then a new-side bubble (added/unchanged) + the new cells, then
// the comment region for either anchor. unchanged lines anchor on both sides, so you can
// comment either pane.
function SplitRow({ left, right, hl, threads, marks }) {
  const newLine = right && right.newLine != null ? right.newLine : null;
  const oldLine = left && left.oldLine != null ? left.oldLine : null;
  const oldSel = oldLine != null && (threads.pendingAt("old", oldLine) || threads.rangeAt("old", oldLine));
  const newSel = newLine != null && (threads.pendingAt("new", newLine) || threads.rangeAt("new", newLine));
  const cls = `diff-row split${oldSel || newSel ? " range-selected" : ""}`;
  const anchors = [];
  if (oldLine != null) anchors.push({ side: "old", line: oldLine, lineObj: left });
  if (newLine != null) anchors.push({ side: "new", line: newLine, lineObj: right });
  return html`
    <tr class="${cls}" data-newline=${newLine ?? ""} data-oldline=${oldLine ?? ""}>
      <td class="bubble-gutter">
        ${oldLine != null &&
        html`<button class="bubble-btn" title="Comment on the removed line — drag or shift-click for a range" onMouseDown=${(e) => startSelect(e, "old", oldLine, threads)}><${Bubble} /></button>`}
      </td>
      <${Side} line=${left} hl=${left && hl.get(left)} side="old" mark=${left && marks.get(left)}
        onLineDown=${oldLine != null ? (e) => startSelect(e, "old", oldLine, threads) : undefined} />
      <td class="bubble-gutter">
        ${newLine != null &&
        html`<button class="bubble-btn" title="Comment on the new line — drag or shift-click for a range" onMouseDown=${(e) => startSelect(e, "new", newLine, threads)}><${Bubble} /></button>`}
      </td>
      <${Side} line=${right} hl=${right && hl.get(right)} side="new" mark=${right && marks.get(right)}
        onLineDown=${newLine != null ? (e) => startSelect(e, "new", newLine, threads) : undefined} />
    </tr>
    <${LineComments} anchors=${anchors} threads=${threads} variant="split" />
  `;
}

export function SplitHunk({ hunk, path, threads, radar, hunkUnits }) {
  const rows = useMemo(() => pairLines(hunk.lines), [hunk]);
  const marks = useMemo(() => hunkMarks(hunk.lines), [hunk]);
  const hl = useMemo(() => highlightMap(hunk.lines, path), [hunk, path]);
  const sel = selectedUnit(radar, hunkUnits);
  return html`<tbody>
    ${(hunk.header || hunkUnits) &&
    html`<tr class="hunk-header">
      <td colspan="6">${hunk.header && html`<span class="hunk-pill">${hunk.header}</span>`}${hunkUnits && html`<${HunkChips} units=${hunkUnits} radar=${radar} />`}</td>
    </tr>`}
    ${withProof(rows, sel,
      (row, unit) => (unit.side === "old" ? row.left?.oldLine : row.right?.newLine) === unit.line,
      (r, i) => html`<${SplitRow} key=${i} left=${r.left} right=${r.right} hl=${hl} threads=${threads} marks=${marks} />`,
      (unit) => html`<${ProofNoteRow} unit=${unit} radar=${radar} colSpan=${6} />`)}
  </tbody>`;
}
