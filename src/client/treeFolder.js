// a collapsible directory in the index. children stay mounted while collapsed so the accordion
// in motion-shell.css can animate the panel's grid row; inert keeps them out of the tab order
// and the a11y tree until the folder opens.
import { html, useState } from "/preact.js";
import { Chevron } from "/icons.js";
import { FileRow } from "/treeFileRow.js";

const INDENT_PX = 12;

export function Folder({ node, depth, ...rest }) {
  const [open, setOpen] = useState(true);
  const subdirs = [...node.dirs.values()];
  return html`<div class="tree-folder" data-open=${open}>
    <button
      type="button"
      class="tree-folder-head"
      aria-expanded=${open}
      style=${`padding-left:${depth * INDENT_PX}px`}
      onClick=${() => setOpen(!open)}
    >
      <${Chevron} />
      <span class="tree-folder-name">${node.name}</span>
    </button>
    <div class="tree-children" inert=${!open}>
      <div class="tree-children-inner">
        ${subdirs.map((d) => html`<${Folder} key=${d.path} node=${d} depth=${depth + 1} ...${rest} />`)}
        <div class="tree-files" style=${`padding-left:${(depth + 1) * INDENT_PX}px`}>
          ${node.files.map(
            (f) => html`<${FileRow} key=${f.path} file=${f} ...${rest} viewed=${rest.viewedSet.has(f.path)} commentCount=${rest.countFor(f.path)} active=${rest.activeFile === f.path} />`
          )}
        </div>
      </div>
    </div>
  </div>`;
}
