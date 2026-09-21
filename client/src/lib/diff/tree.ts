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

// stable dom id for a file section, so the tree can scroll to it.
export function fileAnchorId(path: string): string {
  return "file-" + path.replace(/[^a-zA-Z0-9]/g, "-");
}
