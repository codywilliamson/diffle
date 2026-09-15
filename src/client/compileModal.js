// modal showing the compiled review prompt: rendered markdown by default, raw toggle, copy.
import { html, useState, useEffect, useRef, useMemo } from "/preact.js";
import { marked } from "https://esm.sh/marked@12";
import { compile } from "/api.js";
import { X, Copy } from "/icons.js";
import { StaleComments } from "/staleComments.js";
import { Modal } from "/modal.js";
import { SwapText } from "/textSwap.js";

const VIEW_LABELS = ["Raw", "Rendered"];
const COPY_LABELS = ["Copy as Markdown", "Copied"];

export function CompileModal({ onClose, comments, diff, onEdit, onDelete, onResolve, onReply }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [raw, setRaw] = useState(false); // false = rendered markdown preview (default)
  const taRef = useRef(null);

  useEffect(() => {
    let alive = true;
    compile()
      .then((r) => alive && (setPrompt(r.prompt ?? ""), setLoading(false)))
      .catch(() => alive && (setPrompt("Failed to compile prompt."), setLoading(false)));
    return () => (alive = false);
  }, []);

  // pre-select the raw text whenever it's the visible view, for an easy manual-copy fallback.
  useEffect(() => {
    if (!loading && raw && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, [loading, raw]);

  const rendered = useMemo(() => (loading ? "" : marked.parse(prompt)), [loading, prompt]);

  // the copy button always yields the raw markdown, regardless of which view is showing.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      taRef.current?.select();
    }
  };

  return html`<${Modal} onClose=${onClose} labelledBy="compile-title">
    ${(close) => [
      html`<header class="modal-head">
        <h2 id="compile-title">Feedback preview</h2>
        <div class="modal-head-tools">
          <button class="btn-toggle ${raw ? "" : "on"}" disabled=${loading} onClick=${() => setRaw((v) => !v)}>
            <${SwapText} text=${raw ? "Raw" : "Rendered"} labels=${VIEW_LABELS} />
          </button>
          <button class="btn-icon" aria-label="Close review feedback" onClick=${close}><${X} /></button>
        </div>
      </header>`,
      html`<${StaleComments} comments=${comments} diff=${diff} onEdit=${onEdit} onDelete=${onDelete} onResolve=${onResolve} onReply=${onReply} />`,
      raw
        ? html`<textarea ref=${taRef} class="modal-textarea" readonly value=${loading ? "Compiling…" : prompt}></textarea>`
        : html`<div class="markdown-body modal-rendered">
            ${loading ? "Compiling…" : html`<div dangerouslySetInnerHTML=${{ __html: rendered }}></div>`}
          </div>`,
      html`<footer class="modal-foot">
        <button class="btn-primary" onClick=${copy} disabled=${loading}>
          <${Copy} /> <${SwapText} text=${copied ? "Copied" : "Copy as Markdown"} labels=${COPY_LABELS} />
        </button>
        <button class="btn-plain" onClick=${close}>Close</button>
      </footer>`,
    ]}
  <//>`;
}
