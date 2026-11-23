import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../App";

describe("opening a tool from the clipboard", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  function stubClipboard(text: string) {
    const readText = vi.fn(async () => text);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText } });
    return readText;
  }

  it("offers Base64 for a Base64 clipboard and opens it in Decode with the text", async () => {
    stubClipboard("aGVsbG8gZGV2a2l0");
    render(<App />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", metaKey: true });
    expect(await screen.findByText("From clipboard")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getAllByRole("heading", { level: 1 })[0]).toHaveTextContent("Base64");
    expect(screen.getByRole("radio", { name: "Decode" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(document.querySelector(".cm-content")?.textContent).toBe("aGVsbG8gZGV2a2l0"));
  });

  it("never reads the clipboard when suggestions are off", async () => {
    localStorage.setItem("devkit.settings", JSON.stringify({ clipboardSuggestions: false }));
    const readText = stubClipboard('{"a": 1}');
    render(<App />);
    fireEvent.keyDown(window, { key: "k", code: "KeyK", metaKey: true });
    await screen.findByRole("combobox");
    expect(readText).not.toHaveBeenCalled();
    expect(screen.queryByText("From clipboard")).not.toBeInTheDocument();
  });
});
