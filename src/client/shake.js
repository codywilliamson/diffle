// error state shake (transitions.dev 12): replay the one-shot class on a surface, then drop it
// once its own keyframes finish so the next failure can replay it. .is-error stays orthogonal.
import { replayClass } from "/motion.js";

const SHAKE_CLASS = "is-shaking";
const SHAKE_ANIMATION = "t-input-shake";

export const shake = (el) => replayClass(el, SHAKE_CLASS);

// onAnimationEnd handler for the shaken surface; ignores animations bubbling up from children
export function onShakeEnd(e) {
  if (e.target !== e.currentTarget || e.animationName !== SHAKE_ANIMATION) return;
  e.currentTarget.classList.remove(SHAKE_CLASS);
}
