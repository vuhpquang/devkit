import { createContext, useContext } from "react";

/**
 * The shell keeps recently used tools mounted (hidden) so their input survives switching. A hidden tool must not
 * react to window-wide events (paste, files dropped on the window) or keep polling: gate those effects on this.
 */
export const ToolActiveContext = createContext(true);

/** True while this tool is the one on screen. */
export const useToolActive = () => useContext(ToolActiveContext);
