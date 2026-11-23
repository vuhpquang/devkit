import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "../App";
import { SHORTCUT_GROUPS, isShortcutsKey } from "./shortcuts";

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
