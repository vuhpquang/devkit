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

  /** jsdom has no layout: give the Favorites zone and each of its rows a 32 px box. */
  function layOutFavorites() {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-fav-row]"));
    const box = (top: number, height: number) => () =>
      ({ top, height, bottom: top + height, left: 0, right: 200, width: 200, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    if (rows.length) rows[0].parentElement!.getBoundingClientRect = box(0, rows.length * 32);
    rows.forEach((r, i) => (r.getBoundingClientRect = box(i * 32, 32)));
    return rows;
  }

  it("reorders favorites by dragging, without opening the dragged tool", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(["uuid", "json-yaml", "base64"]));
    const onSelect = renderSidebar();
    const rows = layOutFavorites();
    const firstButton = within(rows[0]).getAllByRole("button")[0];
    fireEvent.pointerDown(firstButton, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 80 });
    fireEvent.pointerUp(window, { clientX: 10, clientY: 90 });
    fireEvent.click(firstButton);
    expect(stored()).toEqual(["json-yaml", "base64", "uuid"]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("adds a tool dragged from its category into the Favorites list, at the drop spot", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(["uuid", "base64"]));
    const onSelect = renderSidebar();
    layOutFavorites();
    const source = screen.getAllByRole("button", { name: "Hash Generator" })[0];
    fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 40 });
    // The ghost follows the pointer.
    expect(document.querySelector("aside .shadow-pop")).toHaveTextContent("Hash Generator");
    fireEvent.pointerUp(window, { clientX: 10, clientY: 40 });
    fireEvent.click(source);
    expect(stored()).toEqual(["uuid", "hash", "base64"]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers a drop zone while dragging when there are no favorites yet", () => {
    renderSidebar();
    const source = screen.getAllByRole("button", { name: "Hash Generator" })[0];
    fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 480 });
    const zone = screen.getByText("Drop to add to Favorites");
    zone.getBoundingClientRect = () => ({ top: 100, height: 36, bottom: 136, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
    fireEvent.pointerMove(window, { clientX: 10, clientY: 110 });
    fireEvent.pointerUp(window, { clientX: 10, clientY: 110 });
    expect(stored()).toEqual(["hash"]);
  });

  it("drops nothing when released away from Favorites", () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(["uuid"]));
    renderSidebar();
    layOutFavorites();
    const source = screen.getAllByRole("button", { name: "Hash Generator" })[0];
    fireEvent.pointerDown(source, { button: 0, clientX: 10, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 400 });
    fireEvent.pointerUp(window, { clientX: 10, clientY: 400 });
    expect(stored()).toEqual(["uuid"]);
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
