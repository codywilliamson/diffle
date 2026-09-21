import { marked } from "marked";
import DOMPurify from "dompurify";
import { resolveRepoPath } from "$lib/format";

// render a markdown file to SANITIZED html (ADR 0007). marked dropped its own sanitizer, so we
// run its output through DOMPurify's allowlist before it ever reaches the dom — raw <script> and
// event-handler attributes in a reviewed .md never execute. relative images resolve through
// /api/raw (repo-contained); external links open in a new tab.
export function renderMarkdown(content: string, fromPath: string): string {
  const raw = marked.parse(content, { async: false }) as string;
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] });

  const tpl = document.createElement("template");
  tpl.innerHTML = clean;
  for (const img of tpl.content.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (src && !/^(https?:|data:|\/api\/)/.test(src)) {
      img.setAttribute("src", `/api/raw?path=${encodeURIComponent(resolveRepoPath(fromPath, src))}`);
    }
  }
  for (const link of tpl.content.querySelectorAll("a[href]")) {
    if (/^https?:/.test(link.getAttribute("href") ?? "")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    }
  }
  return tpl.innerHTML;
}
