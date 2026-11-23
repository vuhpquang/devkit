import type { MouseEvent } from "react";
import { inApp } from "./menuEvents";

export type ToolMenuAction = "open" | "toggle-favorite" | "move-up" | "move-down";
export type ToolMenuEntry = { action: ToolMenuAction; text: string; enabled: boolean } | "separator";

export interface ToolMenuState {
  favorite: boolean;
  /** Set for a row in the Favorites list: its index and the list length (enables Move Up / Move Down). */
  favoritesPosition?: { index: number; count: number };
}

/** The right-click menu of a tool row or card. Pure, so it can be tested without the native menu. */
export function toolMenuEntries({ favorite, favoritesPosition: pos }: ToolMenuState): ToolMenuEntry[] {
  const entries: ToolMenuEntry[] = [
    { action: "open", text: "Open", enabled: true },
    "separator",
    { action: "toggle-favorite", text: favorite ? "Remove from Favorites" : "Add to Favorites", enabled: true },
  ];
  if (pos) {
    entries.push(
      { action: "move-up", text: "Move Up", enabled: pos.index > 0 },
      { action: "move-down", text: "Move Down", enabled: pos.index < pos.count - 1 },
    );
  }
  return entries;
}

/**
 * Shows the native context menu for a tool inside the app. In a plain browser it does nothing, so the
 * browser's own menu still appears there.
 */
export function openToolMenu(e: MouseEvent, state: ToolMenuState, onPick: (action: ToolMenuAction) => void) {
  if (!inApp()) return;
  e.preventDefault();
  void (async () => {
    try {
      const { Menu } = await import("@tauri-apps/api/menu");
      const items = toolMenuEntries(state).map((entry) =>
        entry === "separator"
          ? { item: "Separator" as const }
          : { id: entry.action, text: entry.text, enabled: entry.enabled, action: () => onPick(entry.action) },
      );
      const menu = await Menu.new({ items });
      await menu.popup();
    } catch {
      /* no native menu (e.g. permission missing): the shortcuts and the star still work */
    }
  })();
}
