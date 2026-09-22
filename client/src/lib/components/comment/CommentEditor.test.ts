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

  it("exposes the tag pills as toggle buttons and saves the pressed tag", async () => {
    const onSave = vi.fn().mockResolvedValue(null);
    render(CommentEditor, { onSave, onCancel: vi.fn(), initialTag: "nit" });

    const nit = screen.getByRole("button", { name: "nit" });
    const issue = screen.getByRole("button", { name: "issue" });
    expect(screen.getByRole("group", { name: "Tag" })).toContainElement(nit);
    expect(nit).toHaveAttribute("aria-pressed", "true");
    expect(issue).toHaveAttribute("aria-pressed", "false");

    await fireEvent.click(issue);
    expect(issue).toHaveAttribute("aria-pressed", "true");
    expect(nit).toHaveAttribute("aria-pressed", "false");

    await fireEvent.input(screen.getByRole("textbox", { name: "Comment text" }), { target: { value: "tagged" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("tagged", "issue");

    await fireEvent.click(issue);
    expect(issue).toHaveAttribute("aria-pressed", "false");
  });

  it("describes the keyboard shortcuts on the textarea", () => {
    render(CommentEditor, { onSave: vi.fn(), onCancel: vi.fn() });

    const editor = screen.getByRole("textbox", { name: "Comment text" });
    expect(editor).toHaveAccessibleDescription(/Enter to save · Esc to cancel/);
  });
});
