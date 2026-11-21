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
