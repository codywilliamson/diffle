// per-line syntax highlighting via highlight.js. per-line (not whole-file) keeps large diffs
// fast and matches how the diff is streamed row by row; the common bundle omits powershell.
import hljs from "highlight.js/lib/common";
import powershell from "highlight.js/lib/languages/powershell";
import { langFor } from "$lib/format";

hljs.registerLanguage("powershell", powershell);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// highlighted inner html for one line, or escaped plain text when the extension is unknown.
export function highlightLine(content: string, path: string): string {
  if (!content) return "";
  const lang = langFor(path);
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value;
    } catch {
      // fall through to plain escaped text
    }
  }
  return escapeHtml(content);
}
