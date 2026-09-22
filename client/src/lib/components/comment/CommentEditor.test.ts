import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CommentEditor from "./CommentEditor.svelte";

describe("CommentEditor", () => {
  it("keeps the draft open and shows the server error when saving fails", async () => {
    const onSave = vi.fn().mockResolvedValue("disk full");
    render(CommentEditor, { onSave, onCancel: vi.fn() });

    const editor = screen.getByRole("textbox", { name: "Comment text" });
    await fireEvent.input(editor, { target: { value: "Keep this draft" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
    expect(editor).toHaveValue("Keep this draft");
  });
});
