import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ReplyComposer from "./ReplyComposer.svelte";

describe("ReplyComposer", () => {
  it("keeps the draft open and shows the server error when sending fails", async () => {
    const onSend = vi.fn().mockResolvedValueOnce("reply failed").mockResolvedValueOnce(null);
    const onDone = vi.fn();
    render(ReplyComposer, { onSend, onDone });

    const editor = screen.getByRole("textbox", { name: "Reply" });
    await fireEvent.input(editor, { target: { value: "Keep this draft" } });
    await fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("reply failed");
    expect(editor).toHaveValue("Keep this draft");
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onSend).toHaveBeenNthCalledWith(2, "Keep this draft");
  });

  it("closes after a successful reply", async () => {
    const onSend = vi.fn().mockResolvedValue(null);
    const onDone = vi.fn();
    render(ReplyComposer, { onSend, onDone });

    await fireEvent.input(screen.getByRole("textbox", { name: "Reply" }), { target: { value: "Sent" } });
    await fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("Sent");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
