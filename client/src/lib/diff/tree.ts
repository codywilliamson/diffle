import type { DiffFile } from "$types";

// a diff file with its leaf name split out, for rendering a tree row.
export type TreeFile = DiffFile & { name: string };

export interface TreeNode {
  name: string;
  path: string;
  dirs: Map<string, TreeNode>;
  files: TreeFile[];
}

// group files into a nested tree by directory segments.
export function buildTree(files: DiffFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.pop() ?? file.path;
    let node = root;
    let acc = "";
    for (const seg of parts) {
      acc = acc ? `${acc}/${seg}` : seg;
      let child = node.dirs.get(seg);
      if (!child) {
        child = { name: seg, path: acc, dirs: new Map(), files: [] };
        node.dirs.set(seg, child);
      }
      node = child;
    }
    node.files.push({ ...file, name });
  }
  return root;
}

// the files in the order the tree renders them: depth-first, subfolders before a
// folder's own files. the diff pane and j/k follow this so they match the sidebar.
export function treeOrder(files: DiffFile[]): DiffFile[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const ordered: DiffFile[] = [];
  const walk = (node: TreeNode): void => {
    for (const dir of node.dirs.values()) walk(dir);
    for (const leaf of node.files) ordered.push(byPath.get(leaf.path) ?? leaf);
  };
  walk(buildTree(files));
  return ordered;
}

// stable dom id for a file section, so the tree can scroll to it.
export function fileAnchorId(path: string): string {
  return "file-" + path.replace(/[^a-zA-Z0-9]/g, "-");
}
