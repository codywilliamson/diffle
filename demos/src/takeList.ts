// the reel order + each take's recorded metadata (emitted by record.ts). importing the json here
// means the compositions fail loudly if a take hasn't been recorded yet — run `npm run record` first.
import comment from "../public/footage/comment.json";
import modes from "../public/footage/modes.json";
import review from "../public/footage/review.json";
import filetree from "../public/footage/filetree.json";
import type { TakeMeta } from "./meta";

export const TAKES: TakeMeta[] = [comment, modes, review, filetree] as TakeMeta[];
