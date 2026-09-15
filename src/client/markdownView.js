// renders a markdown file's new-side content. the default view for .md files;
// fetches the full file via /api/file (the diff alone only holds changed hunks).
// relative images resolve against the file's folder and load through /api/raw, and the
// content arrives with a skeleton loader and reveal (transitions.dev).
import { html, useState, useEffect } from "/preact.js";
import { Marked } from "https://esm.sh/marked@12";
import { getFile, rawUrl } from "/api.js";
import { resolveRepoPath } from "/util.js";

const SKELETON_BARS = [40, 92, 68, 84, 40, 76, 58]; // placeholder line widths (%), first is a title
const isRelative = (href) => !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href);

// the repo path inside an image target: no query or fragment, percent-encoding undone
function targetPath(href) {
  const bare = href.split(/[?#]/)[0];
  try { return decodeURIComponent(bare); } catch { return bare; }
}

// a parser scoped to one file so relative image targets resolve against its folder.
function parserFor(path) {
  return new Marked({
    walkTokens(token) {
      if (token.type === "image" && isRelative(token.href)) token.href = rawUrl(resolveRepoPath(path, targetPath(token.href)));
    },
  });
}

// external links open in a new tab so the review stays put.
const externalLinks = (rendered) => rendered.replace(/<a href="(https?:)/g, '<a target="_blank" rel="noopener" href="$1');

export function MarkdownView({ path }) {
  const [rendered, setRendered] = useState(null);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let live = true;
    setRendered(null);
    setRevealed(false);
    setFailed(false);
    getFile(path)
      .then((r) => live && setRendered(externalLinks(parserFor(path).parse(r.content ?? ""))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [path]);

  // flip the reveal a paint after the content lands so the cross-fade plays
  useEffect(() => {
    if (rendered === null) return;
    void document.body.offsetWidth;
    setRevealed(true);
  }, [rendered]);

  if (failed) return html`<div class="md-note">Couldn't load <code>${path}</code> for preview.</div>`;
  return html`<div class="md-skel${revealed ? " is-revealed" : ""}" aria-busy=${rendered === null}>
    <div class="md-skel-skeleton is-pulsing" aria-hidden="true">
      ${SKELETON_BARS.map((width, i) => html`<span key=${i} style=${`width:${width}%`}></span>`)}
    </div>
    ${rendered !== null && html`<div class="md-skel-content markdown-body" dangerouslySetInnerHTML=${{ __html: rendered }}></div>`}
  </div>`;
}
