import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { favoriteShortcutIndex, CMD_HOLD_MS } from "./favorites";
import { PrefsProvider } from "./prefs";
import { Sidebar } from "./Sidebar";
import App from "../App";

const key = (code: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("favoriteShortcutIndex", () => {
  it("maps ⌘1…⌘9 to 0…8", () => {
    expect(favoriteShortcutIndex(key("Digit1", { metaKey: true }))).toBe(0);
    expect(favoriteShortcutIndex(key("Digit9", { metaKey: true }))).toBe(8);
  });

  it("ignores ⌘0, other modifiers and plain digits", () => {
    expect(favoriteShortcutIndex(key("Digit0", { metaKey: true }))).toBeNull();
    expect(favoriteShortcutIndex(key("Digit1", { metaKey: true, shiftKey: true }))).toBeNull();
    expect(favoriteShortcutIndex(key("Digit1", { metaKey: true, altKey: true }))).toBeNull();
    expect(favoriteShortcutIndex(key("Digit1", { ctrlKey: true }))).toBeNull();
    expect(favoriteShortcutIndex(key("Digit1"))).toBeNull();
    expect(favoriteShortcutIndex(key("KeyA", { metaKey: true }))).toBeNull();
  });
});

describe("⌘-number shortcuts", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("devkit.favorites", JSON.stringify(["uuid", "base64"]));
  });
  afterEach(() => vi.useRealTimers());

  it("shows ⌘1, ⌘2 on the favorites while ⌘ is held, and hides them on release", () => {
    vi.useFakeTimers();
    render(
      <PrefsProvider>
        <Sidebar activeId={null} onSelect={vi.fn()} query="" onQuery={vi.fn()} />
      </PrefsProvider>,
    );
    const section = screen.getByText("Favorites").parentElement as HTMLElement;
    fireEvent.keyDown(window, { key: "Meta", metaKey: true });
    // A quick ⌘C must not flash the numbers.
    act(() => vi.advanceTimersByTime(CMD_HOLD_MS - 50));
    expect(within(section).queryByText("⌘1")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(100));
    expect(within(section).getByText("⌘1")).toBeInTheDocument();
    expect(within(section).getByText("⌘2")).toBeInTheDocument();
    fireEvent.keyUp(window, { key: "Meta" });
    expect(within(section).queryByText("⌘1")).not.toBeInTheDocument();
  });

  it("hides the numbers when ⌘ is used for another shortcut", () => {
    vi.useFakeTimers();
    render(
      <PrefsProvider>
        <Sidebar activeId={null} onSelect={vi.fn()} query="" onQuery={vi.fn()} />
      </PrefsProvider>,
    );
    fireEvent.keyDown(window, { key: "Meta", metaKey: true });
    fireEvent.keyDown(window, { key: "c", code: "KeyC", metaKey: true });
    act(() => vi.advanceTimersByTime(CMD_HOLD_MS * 2));
    expect(screen.queryByText("⌘1")).not.toBeInTheDocument();
  });

  it("opens the second favorite with ⌘2", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "2", code: "Digit2", metaKey: true });
    expect(screen.getByRole("heading", { name: "Base64" })).toBeInTheDocument();
    // No third favorite: ⌘3 does nothing.
    fireEvent.keyDown(window, { key: "3", code: "Digit3", metaKey: true });
    expect(screen.getByRole("heading", { name: "Base64" })).toBeInTheDocument();
  });
});
