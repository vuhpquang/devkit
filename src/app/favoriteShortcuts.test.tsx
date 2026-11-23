import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { cycleFavorite, numberShortcut, tabCycleDirection, CMD_HOLD_MS } from "./favorites";
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

describe("numberShortcut", () => {
  it("maps ⌘0…⌘9 to their digit", () => {
    expect(numberShortcut(key("Digit0", { metaKey: true }))).toBe(0);
    expect(numberShortcut(key("Digit1", { metaKey: true }))).toBe(1);
    expect(numberShortcut(key("Digit9", { metaKey: true }))).toBe(9);
  });

  it("ignores other modifiers and plain digits", () => {
    expect(numberShortcut(key("Digit1", { metaKey: true, shiftKey: true }))).toBeNull();
    expect(numberShortcut(key("Digit1", { metaKey: true, altKey: true }))).toBeNull();
    expect(numberShortcut(key("Digit1", { ctrlKey: true }))).toBeNull();
    expect(numberShortcut(key("Digit1"))).toBeNull();
    expect(numberShortcut(key("KeyA", { metaKey: true }))).toBeNull();
  });
});

describe("Ctrl+Tab", () => {
  it("reads Ctrl+Tab and Ctrl+Shift+Tab only", () => {
    const k = (mods: Partial<KeyboardEvent>) => ({ key: "Tab", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
    expect(tabCycleDirection(k({ ctrlKey: true }))).toBe(1);
    expect(tabCycleDirection(k({ ctrlKey: true, shiftKey: true }))).toBe(-1);
    expect(tabCycleDirection(k({}))).toBeNull();
    expect(tabCycleDirection(k({ ctrlKey: true, metaKey: true }))).toBeNull();
    expect(tabCycleDirection({ ...k({ ctrlKey: true }), key: "a" })).toBeNull();
  });

  it("cycles through favorites and wraps around", () => {
    const ids = ["a", "b", "c"];
    expect(cycleFavorite(ids, "a", 1)).toBe("b");
    expect(cycleFavorite(ids, "c", 1)).toBe("a");
    expect(cycleFavorite(ids, "a", -1)).toBe("c");
    // From Home or a non-favorite: first going forward, last going back.
    expect(cycleFavorite(ids, null, 1)).toBe("a");
    expect(cycleFavorite(ids, "zz", -1)).toBe("c");
    expect(cycleFavorite([], "a", 1)).toBeNull();
  });
});

describe("⌘-number shortcuts", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("devkit.favorites", JSON.stringify(["uuid", "base64"]));
  });
  afterEach(() => vi.useRealTimers());

  it("shows ⌘1, ⌘2 on the favorites as soon as ⌘ goes down, and hides them on release", () => {
    expect(CMD_HOLD_MS).toBe(0);
    render(
      <PrefsProvider>
        <Sidebar activeId={null} onSelect={vi.fn()} query="" onQuery={vi.fn()} />
      </PrefsProvider>,
    );
    const section = screen.getByText("Favorites").parentElement as HTMLElement;
    fireEvent.keyDown(window, { key: "Meta", metaKey: true });
    expect(within(section).getByText("⌘1")).toBeInTheDocument();
    expect(within(section).getByText("⌘2")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /All tools/ })).getByText("⌘0")).toBeInTheDocument();
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
    expect(screen.getByText("⌘1")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "c", code: "KeyC", metaKey: true });
    act(() => vi.advanceTimersByTime(1000));
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

  it("switches favorites with Ctrl+Tab and Ctrl+Shift+Tab", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "Tab", ctrlKey: true });
    expect(screen.getByRole("heading", { name: "UUID Generator" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Tab", ctrlKey: true });
    expect(screen.getByRole("heading", { name: "Base64" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Tab", ctrlKey: true, shiftKey: true });
    expect(screen.getByRole("heading", { name: "UUID Generator" })).toBeInTheDocument();
  });

  it("goes back to All tools with ⌘0", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "1", code: "Digit1", metaKey: true });
    expect(screen.getByRole("heading", { name: "UUID Generator" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "0", code: "Digit0", metaKey: true });
    expect(screen.getByRole("heading", { name: "DevKit" })).toBeInTheDocument();
  });
});
