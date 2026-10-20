// D31: Esc cancels a pending count or chord first; otherwise it closes the topmost layer. visual
// mode is the bottom layer: an open dialog or a code-navigation panel sits above it, so visual
// mode only ends once none is open (and focus is not in a field, which keeps its own Esc).
export interface EscapeState {
  pending: boolean;
  visual: boolean;
  dialogOpen: boolean;
  codeLayerOpen: boolean;
  inField: boolean;
}

export function escEndsVisual(state: EscapeState): boolean {
  return !state.pending && state.visual && !state.dialogOpen && !state.codeLayerOpen && !state.inField;
}
