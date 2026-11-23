/**
 * Passing a result from one tool to another ("Convert image…" in SVG ↔ React opens Image Converter with that SVG).
 *
 *   sendTo("image-converter", { kind: "image", name: "icon.svg", mime: "image/svg+xml", bytes })
 *
 * The shell opens the target tool (remounting it if it's already open); the tool reads its payload once with
 * `takeHandoff(id)` on mount.
 */
export type Handoff =
  | { kind: "image"; name: string; mime: string; bytes: Uint8Array }
  | { kind: "images"; files: { name: string; mime: string; bytes: Uint8Array }[] }
  /** `mode`: a TransformTool mode to open in ("decode"), when the target has one. */
  | { kind: "text"; text: string; mode?: string };

export const OPEN_TOOL_EVENT = "devkit:open-tool";

const pending = new Map<string, Handoff>();

export function sendTo(toolId: string, payload: Handoff) {
  pending.set(toolId, payload);
  window.dispatchEvent(new CustomEvent<string>(OPEN_TOOL_EVENT, { detail: toolId }));
}

/**
 * The payload waiting for `toolId`. It's dropped on the next tick rather than at once, so a second read in the
 * same render pass (React StrictMode runs state initialisers and effects twice in development) still sees it.
 */
export function takeHandoff(toolId: string): Handoff | undefined {
  const p = pending.get(toolId);
  if (p) setTimeout(() => pending.get(toolId) === p && pending.delete(toolId), 0);
  return p;
}
