/** Every keyboard shortcut DevKit has, for the ⌘/ sheet. Keep it in step with the handlers in App.tsx and Sidebar. */
export interface ShortcutGroup {
  title: string;
  /** `keys`: one or more key combos; `range` joins two of them with "–" (⌘1–⌘9) instead of "/". */
  items: { keys: string[][]; label: string; range?: boolean }[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigate",
    items: [
      { keys: [["⌘", "K"]], label: "Find a tool" },
      { keys: [["⌘", "0"]], label: "All tools" },
      { keys: [["⌘", "1"], ["⌘", "9"]], label: "Open favorite 1 to 9", range: true },
      { keys: [["⌃", "Tab"], ["⌃", "⇧", "Tab"]], label: "Cycle favorites" },
      { keys: [["⌘", "["], ["⌘", "]"]], label: "Back / forward" },
      { keys: [["⌃", "⌘", "S"]], label: "Show or hide the sidebar" },
    ],
  },
  {
    title: "Favorites",
    items: [
      { keys: [["⌘", "D"]], label: "Add or remove the open tool" },
      { keys: [["⌘"]], label: "Show shortcut numbers" },
      { keys: [["⌥", "↑"], ["⌥", "↓"]], label: "Move the focused favorite" },
    ],
  },
  {
    title: "App",
    items: [
      { keys: [["⌘", ","]], label: "Settings" },
      { keys: [["⌘", "/"]], label: "Keyboard shortcuts" },
      { keys: [["Esc"]], label: "Close a dialog or the palette" },
    ],
  },
  {
    title: "Editors",
    items: [
      { keys: [["Tab"], ["⇧", "Tab"]], label: "Indent / outdent" },
      { keys: [["⌘", "Z"], ["⌘", "⇧", "Z"]], label: "Undo / redo" },
    ],
  },
];

/** ⌘/ (by physical key), otherwise false. */
export const isShortcutsKey = (e: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">) =>
  e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.code === "Slash";
