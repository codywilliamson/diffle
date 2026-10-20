import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftsStore } from "$lib/state/drafts.svelte";
import CommentEditor from "./CommentEditor.svelte";
import ReplyComposer from "./ReplyComposer.svelte";

const drafts = createDraftsStore({ load: async () => ({}), save: async () => ({}) });
vi.mock("$lib/state/context", () => ({ tryGetAppState: () => ({ drafts, connection: { blockedReason: null } }) }));

const KEY = "add|a.ts|new|3-3";
const box = () => screen.getByRole("textbox", { name: "Comment text" });

beforeEach(() => {
  drafts.clear(KEY);
  drafts.clear("reply|c1");
  drafts.clear("edit|c1");
});

describe("comment drafts in the editor", () => {
  it("restores the unsent text when the box reopens after Escape", async () => {
    const first = render(CommentEditor, { draftKey: KEY, onSave: vi.fn(), onCancel: vi.fn() });
    await fireEvent.input(box(), { target: { value: "half written" } });
    await fireEvent.keyDown(box(), { key: "Escape" });
    first.unmount();

    render(CommentEditor, { draftKey: KEY, onSave: vi.fn(), onCancel: vi.fn() });
    expect(box()).toHaveValue("half written");
  });

  it("drops the draft on Cancel", async () => {
    const first = render(CommentEditor, { draftKey: KEY, onSave: vi.fn(), onCancel: vi.fn() });
    await fireEvent.input(box(), { target: { value: "throw away" } });
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    first.unmount();

    render(CommentEditor, { draftKey: KEY, onSave: vi.fn(), onCancel: vi.fn() });
    expect(box()).toHaveValue("");
  });

  it("drops the draft once the comment is saved", async () => {
    const first = render(CommentEditor, { draftKey: KEY, onSave: vi.fn().mockResolvedValue(null), onCancel: vi.fn() });
    await fireEvent.input(box(), { target: { value: "sent" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    first.unmount();
    expect(drafts.get(KEY)).toBeUndefined();
  });

  it("keeps a failed save's text as the draft", async () => {
    render(CommentEditor, { draftKey: KEY, onSave: vi.fn().mockResolvedValue("disk full"), onCancel: vi.fn() });
    await fireEvent.input(box(), { target: { value: "still here" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(drafts.get(KEY)).toBe("still here");
  });

  it("switching which comment is edited keeps the first one's unsaved text", async () => {
    const first = render(CommentEditor, { initial: "original one", draftKey: "edit|c1", onSave: vi.fn(), onCancel: vi.fn() });
    await fireEvent.input(box(), { target: { value: "original one, reworded" } });
    first.unmount();
    const second = render(CommentEditor, { initial: "original two", draftKey: "edit|c2", onSave: vi.fn(), onCancel: vi.fn() });
    expect(box()).toHaveValue("original two");
    second.unmount();

    render(CommentEditor, { initial: "original one", draftKey: "edit|c1", onSave: vi.fn(), onCancel: vi.fn() });
    expect(box()).toHaveValue("original one, reworded");
  });

  it("does not store the original text as a draft", async () => {
    render(CommentEditor, { initial: "same", draftKey: "edit|c1", onSave: vi.fn(), onCancel: vi.fn() });
    await fireEvent.input(box(), { target: { value: "changed" } });
    await fireEvent.input(box(), { target: { value: "same" } });
    expect(drafts.get("edit|c1")).toBeUndefined();
  });
});

describe("comment drafts in the reply composer", () => {
  it("restores an unsent reply and clears it on send", async () => {
    const first = render(ReplyComposer, { draftKey: "reply|c1", onSend: vi.fn().mockResolvedValue(null), onDone: vi.fn() });
    await fireEvent.input(screen.getByRole("textbox", { name: "Reply" }), { target: { value: "on it" } });
    await fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply" }), { key: "Escape" });
    first.unmount();

    render(ReplyComposer, { draftKey: "reply|c1", onSend: vi.fn().mockResolvedValue(null), onDone: vi.fn() });
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("on it");
    await fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(drafts.get("reply|c1")).toBeUndefined();
  });
});
