import { useCallback, useState } from "react";

const KEY = "devkit.lastTool";

/** The open tool (null = the All tools home), remembered across launches. */
export function useActiveTool() {
  const [activeId, setActiveIdState] = useState<string | null>(() => localStorage.getItem(KEY));
  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  }, []);
  return { activeId, setActiveId };
}
