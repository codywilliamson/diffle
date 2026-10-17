// true for controls that should swallow shortcuts (typing a comment, filtering, etc.).
export function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable);
}
