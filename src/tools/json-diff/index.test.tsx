import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { editors, live } from "../../test/jsoneditorMock";

vi.mock("vanilla-jsoneditor", async () => (await import("../../test/jsoneditorMock")).jsoneditorMock());
vi.mock("vanilla-jsoneditor/themes/jse-theme-dark.css", () => ({}));
const handoff = vi.hoisted(() => ({ takeHandoff: vi.fn() }));
vi.mock("../../app/handoff", () => handoff);

import { tool } from "./index";

const wait = () => act(() => new Promise((r) => setTimeout(r, 200)));

describe("JSON Diff", () => {
  beforeEach(() => {
    editors.length = 0;
    localStorage.clear();
    handoff.takeHandoff.mockReset();
  });

  it("shows two tree editors and finds the sample's differences", async () => {
    const C = tool.component;
    render(<C />);
    expect(live()).toHaveLength(2);
    expect(live().every((e) => e.props.mode === "tree")).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Sample" }));
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("6 differences");
    expect(screen.getByText("Changes")).toBeInTheDocument();
  });

  it("jumps to a change from the list and marks it current", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: "Sample" }));
    await wait();
    await userEvent.click(screen.getByText("version", { selector: "code" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 / 6");
    const onClassName = live()[0].props.onClassName as (p: string[]) => string | undefined;
    expect(onClassName(["version"])).toContain("jse-diff-current");
  });

  it("copies across and swaps sides", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: "Sample" }));
    await userEvent.click(screen.getByRole("button", { name: "Swap sides" }));
    await wait();
    expect((live()[0].content as { json: { version: string } }).json.version).toBe("1.5.0");
    await userEvent.click(screen.getByRole("button", { name: "Copy original to modified" }));
    await wait();
    expect(screen.getByRole("status")).toHaveTextContent("No differences");
  });

  it("takes a document handed over by JSON Format as the original", () => {
    handoff.takeHandoff.mockReturnValue({ kind: "text", text: '{"x":1}' });
    const C = tool.component;
    render(<C />);
    expect(live()[0].content).toEqual({ text: '{"x":1}' });
  });
});
