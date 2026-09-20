// Real browser interactions that also log motion to the timeline. Nothing is drawn into the page:
// clicks/selects/reloads are genuine, page.mouse drives real hovers, and the cursor/camera are only
// recorded as data for Remotion. Because there is no in-page transform, every target stays on-screen.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// on-screen centre + rect of a selector, in true video pixels (the recording is untransformed).
export async function rect(ctx, selector) {
  const r = await ctx.page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width, h: b.height };
  }, selector);
  if (!r) throw new Error(`target not found: ${selector}`);
  return r;
}

// glide the cursor to a point over `dur` real ms (logged as an eased segment) and land the real mouse.
export async function moveToXY(ctx, x, y, dur = 480) {
  const t0 = ctx.tl.now();
  ctx.tl.cursorKey(t0, ctx.cur.x, ctx.cur.y);
  ctx.tl.cursorKey(t0 + dur, x, y);
  await wait(Math.max(0, dur - 40));
  await ctx.page.mouse.move(x, y, { steps: 4 });
  ctx.cur = { x, y };
}

export async function moveTo(ctx, selector, dur = 480) {
  const r = await rect(ctx, selector);
  await moveToXY(ctx, r.cx, r.cy, dur);
  return r;
}

export async function hoverFor(ctx, selector, hold = 220, dur = 420) {
  await moveTo(ctx, selector, dur);
  await wait(hold);
}

// move, pause on intent, log a click pulse, then dispatch a real click at the point.
export async function click(ctx, selector, { dur = 460, prePause = 200 } = {}) {
  const r = await moveTo(ctx, selector, dur);
  await wait(prePause);
  ctx.tl.click(ctx.tl.now(), r.cx, r.cy);
  await ctx.page.mouse.move(r.cx, r.cy);
  await ctx.page.mouse.down();
  await wait(55);
  await ctx.page.mouse.up();
  return r;
}

// zoom the post-production camera onto a selector over `dur` real ms. scale is the zoom factor;
// biasY (video px, negative = subject sits higher) leaves room for a caption. The focal point is
// clamped so the zoom window never runs past the recording's edges.
export async function focus(ctx, selector, { scale = 1.3, dur = 460, biasY = 0 } = {}) {
  const r = await rect(ctx, selector);
  const { width: W, height: H } = ctx.tl.video;
  const cx = clamp(r.cx, W / (2 * scale), W - W / (2 * scale));
  const cy = clamp(r.cy + biasY, H / (2 * scale), H - H / (2 * scale));
  const t0 = ctx.tl.now();
  ctx.tl.cameraKey(t0, ctx.cam);
  ctx.cam = { scale, cx, cy };
  ctx.tl.cameraKey(t0 + dur, ctx.cam);
  await wait(dur);
}

export async function reset(ctx, { dur = 440 } = {}) {
  const { width: W, height: H } = ctx.tl.video;
  const t0 = ctx.tl.now();
  ctx.tl.cameraKey(t0, ctx.cam);
  ctx.cam = { scale: 1, cx: W / 2, cy: H / 2 };
  ctx.tl.cameraKey(t0 + dur, ctx.cam);
  await wait(dur);
}

export function caption(ctx, text, placement = "bottom") {
  ctx.tl.caption(ctx.tl.now(), text, placement);
}

export { wait };
