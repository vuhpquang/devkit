import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../App";
import { SHORTCUT_GROUPS, isShortcutsKey, isSidebarAliasKey, isSidebarKey } from "./shortcuts";

describe("keyboard shortcuts sheet", () => {
  beforeEach(() => localStorage.clear());

  it("reads ⌘/ only", () => {
    const k = { code: "Slash", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
    expect(isShortcutsKey(k)).toBe(true);
    expect(isShortcutsKey({ ...k, shiftKey: true })).toBe(false);
    expect(isShortcutsKey({ ...k, code: "KeyK" })).toBe(false);
  });

  it("opens with ⌘/, lists every group and closes with Esc", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "/", code: "Slash", metaKey: true });
    const sheet = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    for (const g of SHORTCUT_GROUPS) {
      const section = within(sheet).getByRole("region", { name: g.title });
      for (const item of g.items) expect(within(section).getByText(item.label)).toBeInTheDocument();
    }
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });
});

describe("sidebar shortcut", () => {
  beforeEach(() => localStorage.clear());

  it("reads ⌘E, and ⌃⌘S as the older alias", () => {
    const k = { code: "KeyE", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
    expect(isSidebarKey(k)).toBe(true);
    expect(isSidebarKey({ ...k, shiftKey: true })).toBe(false);
    expect(isSidebarKey({ ...k, metaKey: false, ctrlKey: true })).toBe(false);
    expect(isSidebarAliasKey({ ...k, code: "KeyS", ctrlKey: true })).toBe(true);
    expect(isSidebarAliasKey({ ...k, code: "KeyS" })).toBe(false);
  });

  it("⌘E collapses and expands the sidebar, ⌃⌘S too", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Hide sidebar (⌘E)" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "e", code: "KeyE", metaKey: true });
    expect(screen.getByRole("button", { name: "Show sidebar (⌘E)" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "e", code: "KeyE", metaKey: true });
    expect(screen.getByRole("button", { name: "Hide sidebar (⌘E)" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "s", code: "KeyS", metaKey: true, ctrlKey: true });
    expect(screen.getByRole("button", { name: "Show sidebar (⌘E)" })).toBeInTheDocument();
  });
});
