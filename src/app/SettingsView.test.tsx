import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SettingsView, type PaneId } from "./SettingsView";
import { SettingsProvider } from "./settings";
import { Sidebar } from "./Sidebar";

function Harness({ initial = "general" as PaneId }) {
  const [pane, setPane] = useState<PaneId>(initial);
  return (
    <SettingsProvider>
      <SettingsView open pane={pane} onPane={setPane} onClose={vi.fn()} onWhatsNew={vi.fn()} />
      <Sidebar activeId={null} onSelect={vi.fn()} query="" onQuery={vi.fn()} />
    </SettingsProvider>
  );
}

describe("Settings", () => {
  beforeEach(() => localStorage.clear());

  it("lists the panes in app-shell order: app panes, then Updates, then About", () => {
    render(<Harness />);
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["General", "Tools", "Editor", "Updates", "About"]);
  });

  it("has ⌥Space and clipboard switches in General, both on by default and saved when turned off", async () => {
    render(<Harness />);
    const launcher = screen.getByRole("switch", { name: "Open DevKit with ⌥Space" });
    const clip = screen.getByRole("switch", { name: "Suggest tools from the clipboard" });
    expect(launcher).toHaveAttribute("aria-checked", "true");
    expect(clip).toHaveAttribute("aria-checked", "true");
    // Outside the app the shortcut can't work; the row says so.
    expect(screen.getByText("Works in the DevKit app, not in a browser.")).toBeInTheDocument();
    await userEvent.click(launcher);
    await userEvent.click(clip);
    const saved = JSON.parse(localStorage.getItem("devkit.settings")!);
    expect([saved.globalShortcut, saved.clipboardSuggestions]).toEqual([false, false]);
  });

  it("Remember tool input is on by default; turning it off forgets every tool's saved input", async () => {
    localStorage.setItem("devkit.input.base64.input", '"secret"');
    localStorage.setItem("devkit.input.json-diff.docs", "{}");
    render(<Harness />);
    const remember = screen.getByRole("switch", { name: "Remember tool input" });
    expect(remember).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("devkit.input.base64.input")).toBe('"secret"');
    await userEvent.click(remember);
    expect(JSON.parse(localStorage.getItem("devkit.settings")!).rememberInput).toBe(false);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("devkit.input."))).toEqual([]);
  });

  it("hiding a tool removes it from the sidebar and persists", async () => {
    render(<Harness initial="tools" />);
    const nav = screen.getByRole("navigation", { name: "Tools" });
    expect(within(nav).getByRole("button", { name: /UUID Generator/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Show UUID Generator" }));
    expect(within(nav).queryByRole("button", { name: /UUID Generator/ })).toBeNull();
    expect(JSON.parse(localStorage.getItem("devkit.settings")!).hiddenTools).toEqual(["uuid"]);
  });

  it("switching online tools off hides every network tool", async () => {
    render(<Harness initial="tools" />);
    const nav = screen.getByRole("navigation", { name: "Tools" });
    expect(within(nav).getByRole("button", { name: /WHOIS/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Online tools" }));
    expect(within(nav).queryByRole("button", { name: /WHOIS/ })).toBeNull();
  });

  it("changes the sidebar mode from General", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("radio", { name: "Auto-hide" }));
    expect(JSON.parse(localStorage.getItem("devkit.settings")!).sidebar).toBe("autohide");
  });
});
