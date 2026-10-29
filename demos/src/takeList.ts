// every recorded take (one short each) + the reel's order and cuts. importing the json here means
// the compositions fail loudly if a take hasn't been recorded yet — run `npm run record` first.
import comment from "../public/footage/comment.json";
import range from "../public/footage/range.json";
import modes from "../public/footage/modes.json";
import review from "../public/footage/review.json";
import filetree from "../public/footage/filetree.json";
import keyboard from "../public/footage/keyboard.json";
import suggest from "../public/footage/suggest.json";
import rereview from "../public/footage/rereview.json";
import scorecard from "../public/footage/scorecard.json";
import codenav from "../public/footage/codenav.json";
import search from "../public/footage/search.json";
import type { TakeMeta } from "./meta";

export const TAKES: TakeMeta[] = [comment, range, modes, review, filetree, keyboard, suggest, rereview, scorecard, codenav, search] as TakeMeta[];

// the reel plays each take a little faster than life so the whole story stays near 75 seconds.
export const REEL_RATE = 1.35;
// footage seconds the reel skips at the start of a take: the page settling, or (review) the comment
// the comment take already showed.
const LEAD_IN_SEC = 0.8;
const REEL_STARTS: Record<string, number> = { review: 8.4, suggest: 1.2 };

// comment -> keyboard -> suggest -> review/export -> rereview -> scorecard -> codenav -> search ->
// modes -> filetree. range keeps its own short but stays out of the reel.
const REEL_ORDER = ["comment", "keyboard", "suggest", "review", "rereview", "scorecard", "codenav", "search", "modes", "filetree"];

export interface ReelCut {
  take: TakeMeta;
  startSec: number;
}

const byId = new Map(TAKES.map((t) => [t.id, t]));
export const REEL: ReelCut[] = REEL_ORDER.map((id) => {
  const take = byId.get(id);
  if (!take) throw new Error(`reel take ${id} was not recorded`);
  return { take, startSec: REEL_STARTS[id] ?? LEAD_IN_SEC };
});
