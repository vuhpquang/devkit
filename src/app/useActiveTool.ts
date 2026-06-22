import { useState } from "react";

const KEY = "devkit.lastTool";

export function useActiveTool() {
  const [activeId, setActiveIdState] = useState<string | null>(
    () => localStorage.getItem(KEY)
  );
  const setActiveId = (id: string) => {
    setActiveIdState(id);
    localStorage.setItem(KEY, id);
  };
  return { activeId, setActiveId };
}
