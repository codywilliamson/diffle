// the three transient dialogs, grouped out of app.js to keep the orchestrator under the line cap.
// returns siblings (htm array); each stays mounted only while its flag is set.
import { html } from "/preact.js";
import { CompileModal } from "/compileModal.js";
import { HelpOverlay } from "/helpOverlay.js";
import { WhatsNewModal } from "/whatsNewModal.js";

export function AppOverlays({ showCompile, setShowCompile, showHelp, setShowHelp, wn, radar, comments, diff, onEdit, onDelete, onResolve, onReply }) {
  return [
    showCompile &&
      html`<${CompileModal} onClose=${() => setShowCompile(false)} comments=${comments} diff=${diff} onEdit=${onEdit} onDelete=${onDelete} onResolve=${onResolve} onReply=${onReply} />`,
    showHelp && html`<${HelpOverlay} radar=${radar} onClose=${() => setShowHelp(false)} />`,
    wn.open && html`<${WhatsNewModal} entry=${wn.entry} onClose=${wn.close} />`,
  ];
}
