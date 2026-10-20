// Ctrl+p and Cmd+p are the browser's print. while the picker is open the key belongs to it (a
// second press closes it) even inside its own input; Cmd+p (macOS) opens it like Ctrl+p does.

import { isEditable } from "./editable";

export interface PickerKeyDeps {
  isOpen: () => boolean;
  close: () => void;
  open: () => void;
  overlayOpen: () => boolean;
}

// true when the event was consumed
export function handlePickerKey(event: KeyboardEvent, deps: PickerKeyDeps): boolean {
  const chord = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "p";
  if (!chord) return false;
  // a held chord must neither toggle the picker nor reach the browser's print
  if (event.repeat) {
    event.preventDefault();
    return true;
  }
  if (deps.isOpen()) deps.close();
  else if (event.metaKey && !deps.overlayOpen() && !isEditable(event.target)) deps.open();
  else return false;
  event.preventDefault();
  return true;
}
