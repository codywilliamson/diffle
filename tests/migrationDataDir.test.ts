import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDataDirStep } from "../src/core/migration/dataDir";
import { homeDataDir } from "../src/core/dataDir";
import { createReviewRecord, markCommentAddressed, readReviewRecord, replyToComment, requestRereview, returnFeedback } from "../src/core/reviewRecords";
import { listSessions, registerSession } from "../src/core/sessions";
import { readUserState } from "../src/core/userState";

let home: string;
const comment = (id: string) => ({ id, file: "a.ts", line: 3, lineContent: "+x", text: `note ${id}`, createdAt: "2026-01-01T00:00:00.000Z" });
const session = (sessionId: string) => ({ sessionId, reviewId: "r", pid: 1, port: 5, url: "http://localhost:5", cwd: "/x", host: "cli" as const, startedAt: "2026-01-01T00:00:00.000Z" });

// builds records/sessions through the real api by pointing the data dir at `dir`
function seed(dir: string, ids: string[]): void {
  const before = process.env.NITTLE_DATA_DIR;
  process.env.NITTLE_DATA_DIR = dir;
  try {
    for (const id of ids) {
      const rec = createReviewRecord({ target: { cwd: home, ref: "main" }, comments: [comment("c1"), comment("c2")], viewed: ["a.ts"] });
      // rewrite under a fixed id so tests can collide ids across dirs
      const from = join(dir, "reviews", rec.id);
      const file = join(from, "review.json");
      writeFileSync(file, readFileSync(file, "utf8").replace(rec.id, id));
      renameSync(from, join(dir, "reviews", id));
    }
    registerSession(session(`s-${ids[ids.length - 1]}`));
  } finally {
    if (before === undefined) delete process.env.NITTLE_DATA_DIR; else process.env.NITTLE_DATA_DIR = before;
  }
}
const dd = (name: string) => join(home, name);
const step = (extra = {}) => createDataDirStep({ home, override: "", warn: () => {}, ...extra });
function readAll(dir: string, id: string) {
  const prev = process.env.NITTLE_DATA_DIR;
  process.env.NITTLE_DATA_DIR = dir;
  try { return { rec: readReviewRecord(id), sessions: listSessions() }; } finally { if (prev === undefined) delete process.env.NITTLE_DATA_DIR; else process.env.NITTLE_DATA_DIR = prev; }
}

beforeEach(() => { home = mkdtempSync(join(tmpdir(), "nittle-mig-")); });
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

describe("data dir migration", () => {
  it("is a no-op when neither or only ~/.nittle exists", () => {
    step().run();
    expect(existsSync(dd(".nittle"))).toBe(false);
    mkdirSync(dd(".nittle"));
    writeFileSync(join(dd(".nittle"), "state.json"), "{}");
    step().run();
    expect(readFileSync(join(dd(".nittle"), "state.json"), "utf8")).toBe("{}");
  });

  it("renames a diffle-only dir; records keep comments, rounds, replies and addressed state", () => {
    const old = dd(".diffle");
    process.env.NITTLE_DATA_DIR = old;
    const rec = createReviewRecord({ target: { cwd: home, ref: "main" }, comments: [comment("c1"), comment("c2")], viewed: ["a.ts"] });
    returnFeedback(rec.id, "fix");
    replyToComment(rec.id, "c1", "done", "agent");
    markCommentAddressed(rec.id, "c1");
    requestRereview(rec.id);
    const { updateReviewRecord } = require("../src/core/reviewRecords");
    updateReviewRecord(rec.id, { lastRound: { capturedAt: "2026-02-01T00:00:00.000Z", blobs: { "a.ts": "abc" } } });
    registerSession(session("s1"));
    writeFileSync(join(old, "state.json"), JSON.stringify({ seenVersion: "0.28.0" }));
    const before = readReviewRecord(rec.id);
    delete process.env.NITTLE_DATA_DIR;

    expect(step().run()).toContain(".nittle");
    expect(existsSync(old)).toBe(false);
    const { rec: after, sessions } = readAll(dd(".nittle"), rec.id);
    expect(after).toEqual(before);
    expect(after!.comments[0]!.status).toBe("addressed");
    expect(after!.comments[0]!.replies).toHaveLength(1);
    expect(after!.lastRound?.blobs["a.ts"]).toBe("abc");
    expect(sessions.map((s) => s.sessionId)).toEqual(["s1"]);
    expect(readUserState(home).seenVersion).toBe("0.28.0");
    expect(homeDataDir(home)).toBe(dd(".nittle"));
  });

  it("merges when both exist: nittle wins on a clashing id, diffle-only records and sessions carry over", () => {
    seed(dd(".nittle"), ["shared", "mine"]);
    seed(dd(".diffle"), ["shared", "theirs"]);
    writeFileSync(join(dd(".diffle"), "reviews", "shared", "review.json"), '{"id":"shared","marker":"diffle"}');
    writeFileSync(join(dd(".nittle"), "state.json"), JSON.stringify({ seenVersion: "new" }));
    writeFileSync(join(dd(".diffle"), "state.json"), JSON.stringify({ seenVersion: "old", updateCheckedAt: "t" }));
    const nittleShared = readFileSync(join(dd(".nittle"), "reviews", "shared", "review.json"), "utf8");
    const warnings: string[] = [];

    expect(() => step({ warn: (m: string) => warnings.push(m) }).run()).toThrow();
    // conflicting diffle record kept in place and reported; the rest moved
    expect(readFileSync(join(dd(".nittle"), "reviews", "shared", "review.json"), "utf8")).toBe(nittleShared);
    expect(existsSync(join(dd(".diffle"), "reviews", "shared", "review.json"))).toBe(true);
    expect(warnings.join("\n")).toContain(join(dd(".diffle"), "reviews", "shared"));
    expect(readAll(dd(".nittle"), "theirs").rec?.comments).toHaveLength(2);
    expect(existsSync(join(dd(".diffle"), "reviews", "theirs"))).toBe(false);
    expect(readAll(dd(".nittle"), "mine").sessions.map((s) => s.sessionId).sort()).toEqual(["s-mine", "s-theirs"]);
    expect(readUserState(home)).toEqual({ seenVersion: "new", updateCheckedAt: "t" });
  });

  it("deletes ~/.diffle entirely once everything is confirmed in ~/.nittle", () => {
    seed(dd(".nittle"), ["a"]);
    seed(dd(".diffle"), ["b"]);
    step().run();
    expect(existsSync(dd(".diffle"))).toBe(false);
    expect(readAll(dd(".nittle"), "b").rec?.id).toBe("b");
    // idempotent
    expect(step().run()).toBeUndefined();
  });

  it("keeps both dirs on a simulated copy failure, names what is left, and retries clean", () => {
    seed(dd(".nittle"), ["a"]);
    seed(dd(".diffle"), ["b", "c"]);
    let copies = 0;
    const flaky = { copyFile: (from: string, to: string) => { if (++copies === 2) throw new Error("EBUSY: simulated lock"); copyFileSync(from, to); } };
    const warnings: string[] = [];
    expect(() => step({ ops: flaky, warn: (m: string) => warnings.push(m) }).run()).toThrow();
    expect(existsSync(dd(".diffle"))).toBe(true);
    expect(existsSync(dd(".nittle"))).toBe(true);
    expect(warnings.join("\n")).toContain("EBUSY");
    expect(warnings.join("\n")).toContain(dd(".diffle"));
    // nothing half-copied is visible as a record
    expect(readdirNames(join(dd(".nittle"), "reviews")).some((n) => n.endsWith(".migrating"))).toBe(false);

    step().run();
    expect(existsSync(dd(".diffle"))).toBe(false);
    expect(readAll(dd(".nittle"), "b").rec?.id).toBe("b");
    expect(readAll(dd(".nittle"), "c").rec?.id).toBe("c");
  });

  it("falls back to reading ~/.diffle when the rename fails and nothing was copied", () => {
    seed(dd(".diffle"), ["b"]);
    const failAll = { copyFile: () => { throw new Error("EACCES"); } };
    expect(() => step({ ops: failAll, rename: () => { throw new Error("EPERM"); } }).run()).toThrow();
    expect(existsSync(join(dd(".diffle"), "reviews", "b", "review.json"))).toBe(true);
  });

  it("migrates a loupe-only dir, diffle first then loupe when both exist", () => {
    seed(dd(".loupe"), ["old"]);
    step().run();
    expect(existsSync(dd(".loupe"))).toBe(false);
    expect(readAll(dd(".nittle"), "old").rec?.id).toBe("old");

    seed(dd(".diffle"), ["d"]);
    seed(dd(".loupe"), ["l"]);
    step().run();
    expect(existsSync(dd(".diffle"))).toBe(false);
    expect(existsSync(dd(".loupe"))).toBe(false);
    expect(readAll(dd(".nittle"), "d").rec?.id).toBe("d");
    expect(readAll(dd(".nittle"), "l").rec?.id).toBe("l");
  });

  it("loupe+diffle with no ~/.nittle: diffle is renamed, loupe merges in", () => {
    seed(dd(".diffle"), ["d"]);
    seed(dd(".loupe"), ["l"]);
    step().run();
    expect(existsSync(dd(".loupe"))).toBe(false);
    expect(readAll(dd(".nittle"), "d").rec?.id).toBe("d");
    expect(readAll(dd(".nittle"), "l").rec?.id).toBe("l");
  });

  it("leaves the installer bin dir alone", () => {
    seed(dd(".nittle"), ["a"]);
    seed(dd(".diffle"), ["b"]);
    mkdirSync(join(dd(".diffle"), "bin"));
    writeFileSync(join(dd(".diffle"), "bin", "diffle"), "x");
    step().run();
    expect(existsSync(join(dd(".diffle"), "bin", "diffle"))).toBe(true);
    expect(existsSync(join(dd(".nittle"), "bin"))).toBe(false);
  });

  it("does not touch home dirs when a custom data dir override is set", () => {
    seed(dd(".diffle"), ["b"]);
    expect(createDataDirStep({ home, override: join(home, "elsewhere") }).run()).toBeUndefined();
    expect(existsSync(dd(".diffle"))).toBe(true);
    expect(existsSync(dd(".nittle"))).toBe(false);
    // an override equal to the default still migrates
    createDataDirStep({ home, override: dd(".nittle") }).run();
    expect(existsSync(dd(".diffle"))).toBe(false);
  });

  it("resolves to the old dir only while ~/.nittle does not exist yet", () => {
    mkdirSync(dd(".loupe"));
    expect(homeDataDir(home)).toBe(dd(".loupe"));
    mkdirSync(dd(".diffle"));
    expect(homeDataDir(home)).toBe(dd(".diffle"));
    mkdirSync(dd(".nittle"));
    expect(homeDataDir(home)).toBe(dd(".nittle"));
  });
});

function readdirNames(dir: string): string[] { return readdirSync(dir); }
