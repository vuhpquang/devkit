import { createContext, useContext, useState } from "react";
import { takeHandoff } from "../app/handoff";

/**
 * The shell keeps recently used tools mounted (hidden) so their input survives switching. A hidden tool must not
 * react to window-wide events (paste, files dropped on the window) or keep polling: gate those effects on this.
 */
export const ToolActiveContext = createContext(true);

/** True while this tool is the one on screen. */
export const useToolActive = () => useContext(ToolActiveContext);

/** The id of the tool being rendered (set by the shell), so shared building blocks can read its hand-off. */
export const ToolIdContext = createContext<string | null>(null);

/**
 * Text handed to this tool when it opened (clipboard suggestion, another tool's "Send to"), read once on mount.
 * The shell remounts a tool for each hand-off, so this never changes during a mount.
 */
export function useHandoffText(): { text: string; mode?: string } | undefined {
  const id = useContext(ToolIdContext);
  const [handoff] = useState(() => {
    const p = id ? takeHandoff(id) : undefined;
    return p?.kind === "text" ? { text: p.text, mode: p.mode } : undefined;
  });
  return handoff;
}
