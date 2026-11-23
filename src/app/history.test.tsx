import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { historyKey, startHistory, step, visit, HISTORY_MAX } from "./history";
import App from "../App";

describe("history model", () => {
  it("adds visits, ignores repeats and drops the forward entries", () => {
    let h = startHistory(null);
    h = visit(h, "a");
    h = visit(h, "a");
    h = visit(h, "b");
    expect(h).toEqual({ entries: [null, "a", "b"], index: 2 });
    h = step(h, -1)!;
    h = step(h, -1)!;
    expect(h.entries[h.index]).toBeNull();
    expect(step(h, -1)).toBeNull();
    h = visit(h, "c");
    expect(h).toEqual({ entries: [null, "c"], index: 1 });
    expect(step(h, 1)).toBeNull();
  });

  it("keeps at most HISTORY_MAX entries", () => {
    let h = startHistory(null);
    for (let i = 0; i < HISTORY_MAX + 10; i++) h = visit(h, `t${i}`);
    expect(h.entries).toHaveLength(HISTORY_MAX);
    expect(h.index).toBe(HISTORY_MAX - 1);
  });

  it("reads ⌘[ and ⌘] only", () => {
    const k = (code: string, mods: Partial<KeyboardEvent> = {}) => ({ code, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, ...mods });
    expect(historyKey(k("BracketLeft"))).toBe(-1);
    expect(historyKey(k("BracketRight"))).toBe(1);
    expect(historyKey(k("BracketLeft", { shiftKey: true }))).toBeNull();
    expect(historyKey(k("BracketLeft", { metaKey: false }))).toBeNull();
  });
});

describe("back and forward in the shell", () => {
  beforeEach(() => localStorage.clear());
  const title = () => screen.getAllByRole("heading", { level: 1 })[0].textContent;
  const open = (name: string) => userEvent.click(screen.getAllByRole("button", { name })[0]);

  it("goes back and forward with ⌘[ / ⌘] and the buttons", async () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Back (⌘[)" })).toBeDisabled();
    await open("Base64");
    await open("UUID Generator");
    fireEvent.keyDown(window, { key: "[", code: "BracketLeft", metaKey: true });
    expect(title()).toBe("Base64");
    fireEvent.keyDown(window, { key: "[", code: "BracketLeft", metaKey: true });
    expect(title()).toBe("All tools");
    await userEvent.click(screen.getByRole("button", { name: "Forward (⌘])" }));
    expect(title()).toBe("Base64");
    fireEvent.keyDown(window, { key: "]", code: "BracketRight", metaKey: true });
    expect(title()).toBe("UUID Generator");
    expect(screen.getByRole("button", { name: "Forward (⌘])" })).toBeDisabled();
  });

  it("wins over a focused editor, which would indent with ⌘[", async () => {
    render(<App />);
    await open("Base64");
    await open("Hash Generator");
    const editor = document.querySelector<HTMLElement>(".cm-content");
    expect(editor).not.toBeNull();
    let editorSaw = false;
    editor!.addEventListener("keydown", () => (editorSaw = true));
    fireEvent.keyDown(editor!, { key: "[", code: "BracketLeft", metaKey: true });
    expect(editorSaw).toBe(false);
    expect(title()).toBe("Base64");
  });
});
