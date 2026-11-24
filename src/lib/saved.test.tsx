import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearSavedInput, sameShape, useSaved } from "./saved";
import { renderTool, savedValue } from "../test/renderTool";
import { TransformTool } from "./ui";

const handoff = vi.hoisted(() => ({ takeHandoff: vi.fn() }));
vi.mock("../app/handoff", () => handoff);

function Probe({ prefer }: { prefer?: string }) {
  const [v, setV] = useSaved("text", "start", { prefer });
  const [n, setN] = useSaved("mode", "a", { valid: (x) => x === "a" || x === "b" });
  return (
    <>
      <output aria-label="text">{v}</output>
      <output aria-label="mode">{n}</output>
      <button onClick={() => setV((x) => x + "!")}>more</button>
      <button onClick={() => setN("b")}>b</button>
    </>
  );
}

describe("useSaved", () => {
  beforeEach(() => {
    localStorage.clear();
    handoff.takeHandoff.mockReset();
  });

  it("saves every change and restores it on the next mount", async () => {
    const { unmount } = renderTool(() => <Probe />, "probe");
    await userEvent.click(screen.getByText("more"));
    await userEvent.click(screen.getByText("b"));
    expect(savedValue("probe", "text")).toBe("start!");
    unmount();
    renderTool(() => <Probe />, "probe");
    expect(screen.getByLabelText("text")).toHaveTextContent("start!");
    expect(screen.getByLabelText("mode")).toHaveTextContent("b");
  });

  it("ignores stored values of the wrong kind", () => {
    localStorage.setItem("devkit.input.probe.text", "42");
    localStorage.setItem("devkit.input.probe.mode", '"zzz"');
    renderTool(() => <Probe />, "probe");
    expect(screen.getByLabelText("text")).toHaveTextContent("start");
    expect(screen.getByLabelText("mode")).toHaveTextContent("a");
  });

  it("lets a hand-off win and saves it", () => {
    localStorage.setItem("devkit.input.probe.text", '"old"');
    renderTool(() => <Probe prefer="handed" />, "probe");
    expect(screen.getByLabelText("text")).toHaveTextContent("handed");
    expect(savedValue("probe", "text")).toBe("handed");
  });

  it("saves nothing with Remember tool input off, or outside a tool", async () => {
    renderTool(() => <Probe />, "probe", false);
    await userEvent.click(screen.getAllByText("more")[0]);
    render(<Probe />);
    await userEvent.click(screen.getAllByText("more")[1]);
    expect(localStorage.length).toBe(0);
  });

  it("clearSavedInput forgets only tool input", () => {
    localStorage.setItem("devkit.input.a.x", "1");
    localStorage.setItem("devkit.input.json-diff.docs", "{}");
    localStorage.setItem("devkit.settings", "{}");
    clearSavedInput();
    expect(Object.keys(localStorage)).toEqual(["devkit.settings"]);
  });

  it("checks shapes against the default", () => {
    expect(sameShape("", "x")).toBe(true);
    expect(sameShape(1, "1")).toBe(false);
    expect(sameShape([], {})).toBe(false);
    expect(sameShape(null, null)).toBe(true);
    expect(sameShape({}, null)).toBe(false);
  });
});

describe("TransformTool remembers", () => {
  beforeEach(() => localStorage.clear());

  it("its mode, input and wrap across a relaunch", async () => {
    const modes = [
      { value: "up" as const, label: "Up", run: (s: string) => ({ ok: true as const, value: s.toUpperCase() }) },
      { value: "low" as const, label: "Low", run: (s: string) => ({ ok: true as const, value: s.toLowerCase() }) },
    ];
    const T = () => <TransformTool modes={modes} />;
    const { unmount } = renderTool(T, "t");
    await userEvent.click(screen.getByRole("radio", { name: "Low" }));
    await userEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(savedValue("t", "mode")).toBe("low");
    expect(savedValue("t", "wrap")).toBe(true);
    unmount();
    localStorage.setItem("devkit.input.t.input", '"Hello"');
    renderTool(T, "t");
    expect(screen.getByRole("radio", { name: "Low" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Don't wrap lines" })).toBeInTheDocument();
    expect(screen.getAllByText("Hello").length).toBeGreaterThan(0);
    expect(screen.getAllByText("hello").length).toBeGreaterThan(0);
  });
});
