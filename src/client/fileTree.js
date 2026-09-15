// left sidebar: filter + viewed progress, files grouped by directory, and the mobile drawer shell.
import { html, useState } from "/preact.js";
import { buildTree } from "/util.js";
import { X } from "/icons.js";
import { Folder } from "/treeFolder.js";
import { FileRow } from "/treeFileRow.js";
import { useDrawerPhase } from "/useDrawerPhase.js";

const DRAWER_CLOSE_TOKEN = "--panel-close-dur";

// filter box + "viewed n/total" progress over the files in this diff.
function TreeHead({ filter, onFilter, files, viewedSet }) {
  const done = files.filter((f) => viewedSet.has(f.path)).length;
  const pct = files.length ? Math.round((done / files.length) * 100) : 0;
  return html`<div class="tree-head">
    <input
      class="tree-filter"
      type="search"
      aria-label="Filter changed files"
      placeholder="Filter files…"
      value=${filter}
      onInput=${(e) => onFilter(e.target.value)}
    />
    <div class="tree-progress" title=${`${done} of ${files.length} files viewed`}>
      <div class="tree-progress-bar"><div class="tree-progress-fill" style=${`transform:scaleX(${pct / 100})`}></div></div>
      <span class="tree-progress-label">${done}/${files.length} viewed</span>
    </div>
  </div>`;
}

export function FileTree({ files, viewedSet, countFor, activeFile, onSelect, onToggleViewed, width, browse, mobileOpen, onClose }) {
  const [filter, setFilter] = useState("");
  // the drawer stays mounted (mobile-open) through its close transition; data-open drives the reveal
  const { mounted: drawer, shown: revealed } = useDrawerPhase(mobileOpen, DRAWER_CLOSE_TOKEN);
  const needle = filter.trim().toLowerCase();
  const shown = needle ? files.filter((f) => f.path.toLowerCase().includes(needle)) : files;
  const root = buildTree(shown);
  const rest = { viewedSet, countFor, activeFile, onSelect, onToggleViewed, browse };
  return html`${drawer && html`<button class="tree-backdrop" data-open=${revealed} aria-label="Close file browser" onClick=${onClose}></button>`}
  <nav class="file-tree ${drawer ? "mobile-open" : ""}" data-open=${revealed} style=${`width:${width}px`} aria-label="Changed files">
    <div class="tree-mobile-head"><strong>Files</strong><button class="btn-icon icon-btn" aria-label="Close file browser" onClick=${onClose}><${X} /></button></div>
    <${TreeHead} filter=${filter} onFilter=${setFilter} files=${files} viewedSet=${viewedSet} />
    ${needle && shown.length === 0 && html`<div class="tree-empty">No files match “${filter}”</div>`}
    ${[...root.dirs.values()].map(
      (d) => html`<${Folder} key=${d.path} node=${d} depth=${0} ...${rest} />`
    )}
    <div class="tree-files">
      ${root.files.map(
        (f) => html`<${FileRow}
          key=${f.path}
          file=${f}
          viewed=${viewedSet.has(f.path)}
          commentCount=${countFor(f.path)}
          active=${activeFile === f.path}
          browse=${browse}
          onSelect=${onSelect}
          onToggleViewed=${onToggleViewed}
        />`
      )}
    </div>
  </nav>`;
}
