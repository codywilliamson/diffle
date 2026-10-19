// keyboard handling shared by the code-navigation lists: arrows move, Enter picks, and when the
// list has focus (not a text field) j and k move too. Esc and Ctrl+o are the keymap's.

export interface ListNav {
  move: (delta: number) => void;
  activate: () => void;
}

const PAGE = 8;

// true when the key was a list key (and has been handled)
export function listKey(event: KeyboardEvent, nav: ListNav, letters: boolean): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  switch (event.key) {
    case "ArrowDown":
      nav.move(1);
      break;
    case "ArrowUp":
      nav.move(-1);
      break;
    case "PageDown":
      nav.move(PAGE);
      break;
    case "PageUp":
      nav.move(-PAGE);
      break;
    case "Enter":
      nav.activate();
      break;
    case "j":
      if (!letters) return false;
      nav.move(1);
      break;
    case "k":
      if (!letters) return false;
      nav.move(-1);
      break;
    default:
      return false;
  }
  event.preventDefault();
  return true;
}
