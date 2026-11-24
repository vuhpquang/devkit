import type { ComponentType } from "react";
import { render } from "@testing-library/react";
import { ToolIdContext } from "../lib/toolActive";
import { RememberInput } from "../lib/saved";

/** Renders a tool the way the shell does (its id in context), so `useSaved` stores under `devkit.input.<id>.*`. */
export function renderTool(Tool: ComponentType, id: string, remember = true) {
  return render(
    <ToolIdContext.Provider value={id}>
      <RememberInput.Provider value={remember}>
        <Tool />
      </RememberInput.Provider>
    </ToolIdContext.Provider>,
  );
}

/** What a tool saved under `name`, parsed; undefined when nothing is stored. */
export function savedValue(id: string, name: string): unknown {
  const raw = localStorage.getItem(`devkit.input.${id}.${name}`);
  return raw === null ? undefined : JSON.parse(raw);
}
