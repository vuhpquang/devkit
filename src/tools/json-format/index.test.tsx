import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { editors, live } from "../../test/jsoneditorMock";

vi.mock("vanilla-jsoneditor", async () => (await import("../../test/jsoneditorMock")).jsoneditorMock());
vi.mock("vanilla-jsoneditor/themes/jse-theme-dark.css", () => ({}));
const handoff = vi.hoisted(() => ({ sendTo: vi.fn(), takeHandoff: vi.fn() }));
vi.mock("../../app/handoff", () => handoff);

import { tool, schemaValidator, loadPrefs } from "./index";

describe("JSON Format", () => {
  beforeEach(() => {
    editors.length = 0;
    localStorage.clear();
    handoff.sendTo.mockReset();
    handoff.takeHandoff.mockReset();
  });

  it("mounts one svelte-jsoneditor in text mode with every query language", () => {
    const C = tool.component;
    render(<C />);
    expect(live()).toHaveLength(1);
    const p = live()[0].props;
    expect(p.mode).toBe("text");
    expect(p.indentation).toBe(2);
    expect((p.queryLanguages as { id: string }[]).map((q) => q.id)).toEqual(["jsonquery", "jmespath", "jsonpath", "lodash", "javascript"]);
    expect(p.askToFormat).toBe(true);
  });

  it("switches view and indentation, and remembers them", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("radio", { name: "Tree" }));
    await userEvent.click(screen.getByRole("radio", { name: "Tab" }));
    expect(live()[0].props.mode).toBe("tree");
    expect(live()[0].props.indentation).toBe("\t");
    expect(loadPrefs()).toMatchObject({ view: "tree", indent: "tab" });
  });

  it("validates against a schema and explains a broken one", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Schema/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sample schema" }));
    expect(live()[0].props.validator).toBeTruthy();
    expect(schemaValidator("{oops").error).toMatch(/isn't valid JSON/);
    expect(schemaValidator("[]").error).toMatch(/object/);
    expect(schemaValidator("").validator).toBeUndefined();
  });

  it("uses lossless-json for big numbers", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: "Big numbers" }));
    const parser = live()[0].props.parser as { parse: (s: string) => unknown; stringify: (v: unknown) => string };
    expect(parser.stringify(parser.parse('{"id":9007199254740993}'))).toBe('{"id":9007199254740993}');
  });

  it("loads a sample and hands the document to JSON Diff", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: "Sample" }));
    await userEvent.click(screen.getByRole("button", { name: /Compare/ }));
    expect(handoff.sendTo).toHaveBeenCalledWith("json-diff", { kind: "text", text: expect.stringContaining('"devkit"') });
  });

  it("opens text handed over by another tool", () => {
    handoff.takeHandoff.mockReturnValue({ kind: "text", text: '{"a":1}' });
    const C = tool.component;
    render(<C />);
    expect(live()[0].content).toEqual({ text: '{"a":1}' });
  });
});
