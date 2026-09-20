// Finds the black clapperboard (the timeline origin) in the raw recording, then trims + normalises
// the footage to a constant-30fps H.264 file that Remotion composites over. Tight black thresholds
// distinguish the pure-black clapperboard from Loupe's charcoal surface (~9% luminance).
import { spawnSync } from "node:child_process";

const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" });

// the clapperboard is the first full-frame pure-black span of at least a quarter second.
export function findOrigin(rawWebm) {
  const res = run("ffmpeg", ["-i", rawWebm, "-vf", "blackdetect=d=0.15:pic_th=0.98:pix_th=0.03", "-an", "-f", "null", "-"]);
  const log = res.stderr || "";
  const segs = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)]
    .map((m) => ({ start: +m[1], end: +m[2], dur: +m[3] }));
  const clap = segs.find((s) => s.dur >= 0.25) ?? segs[0];
  if (!clap) throw new Error("clapperboard (pure-black frame) not found in recording");
  return clap.end;
}

// trim from the origin and re-encode to CFR 30 so the composition maps 1:1 to source frames.
export function trimForRemotion(rawWebm, originSec, outMp4) {
  const res = run("ffmpeg", ["-y", "-ss", originSec.toFixed(3), "-i", rawWebm, "-an",
    "-vf", "fps=30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", outMp4]);
  if (res.status !== 0) throw new Error(`trim failed: ${res.stderr}`);
  return probe(outMp4);
}

export function probe(file) {
  const res = run("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file]);
  if (res.status !== 0) throw new Error(`ffprobe failed: ${res.stderr}`);
  const data = JSON.parse(res.stdout);
  const v = data.streams.find((s) => s.codec_type === "video");
  const [n, d] = v.r_frame_rate.split("/").map(Number);
  return { width: v.width, height: v.height, fps: d ? +(n / d).toFixed(3) : n, seconds: +(+data.format.duration).toFixed(3) };
}
