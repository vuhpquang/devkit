import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { Home } from "./Home";
import { PrefsProvider } from "./prefs";

const FAVORITES_KEY = "devkit.favorites";
const stored = () => JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[];

function renderSidebar(onSelect = vi.fn()) {
  render(
    <PrefsProvider>
      <Sidebar activeId={null} onSelect={onSelect} query="" onQuery={vi.fn()} />
    </PrefsProvider>,
  );
  return onSelect;
}

/** The Favorites section of the sidebar (its heading's parent). */
const favoritesSection = () => screen.getByText("Favorites").parentElement as HTMLElement;
const favoriteNames = () =>
  within(favoritesSection())
    .getAllByRole("button", { name: /./ })
    .filter((b) => !/favorites/i.test(b.getAttribute("aria-label") ?? ""))
    .map((b) => b.textContent);

describe("favorites", () => {
  beforeEach(() => localStorage.clear());

  it("adds a tool from the sidebar star and shows it in a Favorites section at the top", async () => {
    const onSelect = renderSidebar();
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
    const row = screen.getByRole("button", { name: "UUID Generator" }).parentElement as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Add to favorites" }));
    expect(stored()).toEqual(["uuid"]);
    expect(favoriteNames()).toEqual(["UUID Generator"]);
    // The star doesn't open the tool.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("reorders favorites with ⌥↑ / ⌥↓", async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(["uuid", "json-yaml", "base64"]));
    renderSidebar();
    const before = favoriteNames();
    const first = within(favoritesSection()).getByRole("button", { name: before[0]! });
    first.focus();
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(stored()).toEqual(["json-yaml", "uuid", "base64"]);
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(stored()).toEqual(["json-yaml", "base64", "uuid"]);
    // Already last: nothing changes.
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(stored()).toEqual(["json-yaml", "base64", "uuid"]);
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(stored()).toEqual(["json-yaml", "uuid", "base64"]);
    expect(document.activeElement).toBe(first);
  });

  it("reorders favorites by dragging, without opening the dragged tool", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(["uuid", "json-yaml", "base64"]));
    const onSelect = renderSidebar();
    const rows = Array.from(favoritesSection().querySelector(".select-none")!.children) as HTMLElement[];
    // jsdom has no layout: give each row a 32 px box.
    rows.forEach((r, i) => {
      r.getBoundingClientRect = () => ({ top: i * 32, height: 32, bottom: i * 32 + 32, left: 0, right: 200, width: 200, x: 0, y: i * 32, toJSON: () => ({}) });
    });
    const firstButton = within(rows[0]).getAllByRole("button")[0];
    fireEvent.pointerDown(firstButton, { button: 0, clientY: 10 });
    fireEvent.pointerMove(window, { clientY: 80 });
    fireEvent.pointerUp(window, { clientY: 90 });
    fireEvent.click(firstButton);
    expect(stored()).toEqual(["json-yaml", "base64", "uuid"]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("toggles from the Home card star, which stays visible on favorites", async () => {
    render(
      <PrefsProvider>
        <Home onSelect={vi.fn()} onSearch={vi.fn()} />
      </PrefsProvider>,
    );
    const add = screen.getAllByRole("button", { name: "Add to favorites" })[0];
    await userEvent.click(add);
    expect(stored()).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /Favorites/ })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Remove from favorites" })[0]);
    expect(stored()).toEqual([]);
  });
});
