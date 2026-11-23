import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildRows, CommandPalette } from "./CommandPalette";
import { DEFAULT_SETTINGS } from "./settings";

describe("CommandPalette", () => {
  it("renders an input when open", () => {
    render(<CommandPalette open onClose={vi.fn()} onChoose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/jump to a tool/i)).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<CommandPalette open={false} onClose={vi.fn()} onChoose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("filters, moves with the arrow keys and opens with Enter", async () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onChoose={onChoose} />);
    await userEvent.type(screen.getByRole("combobox"), "json");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChoose.mock.calls[0][0].tool.id).toBe(options[1].getAttribute("data-tool"));
    expect(onClose).toHaveBeenCalled();
  });

  it("says when nothing matches", async () => {
    render(<CommandPalette open onClose={vi.fn()} onChoose={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "zzzz");
    expect(screen.getByText(/No tools match/)).toBeInTheDocument();
  });
});

describe("buildRows", () => {
  const headings = (rows: ReturnType<typeof buildRows>["rows"]) =>
    rows.filter((r) => r.kind === "heading").map((r) => (r.kind === "heading" ? r.label : ""));

  it("lists favorites first, then recent without the favorites, then the rest", () => {
    const { rows, items } = buildRows("", ["uuid", "json-yaml"], ["json-yaml", "base64"], DEFAULT_SETTINGS);
    expect(headings(rows)).toEqual(["Favorites", "Recent", "All tools"]);
    expect(items.slice(0, 3).map((i) => i.tool.id)).toEqual(["uuid", "json-yaml", "base64"]);
    expect(items.filter((i) => i.tool.id === "json-yaml")).toHaveLength(1);
  });

  it("has a single Tools group with no favorites or recent", () => {
    expect(headings(buildRows("", [], [], DEFAULT_SETTINGS).rows)).toEqual(["Tools"]);
  });

  it("puts clipboard suggestions first, carrying the text and mode", () => {
    const { rows, items } = buildRows("", ["uuid"], [], DEFAULT_SETTINGS, "aGVsbG8gZGV2a2l0");
    expect(headings(rows)).toEqual(["From clipboard", "Favorites", "All tools"]);
    expect(items[0].tool.id).toBe("base64");
    expect(items[0].clip).toEqual({ suggestion: { toolId: "base64", label: "Base64", mode: "decode" }, text: "aGVsbG8gZGV2a2l0" });
  });

  it("leaves the clipboard out when suggestions are off or while searching", () => {
    const off = { ...DEFAULT_SETTINGS, clipboardSuggestions: false };
    expect(headings(buildRows("", [], [], off, '{"a":1}').rows)).toEqual(["Tools"]);
    expect(headings(buildRows("json", [], [], DEFAULT_SETTINGS, '{"a":1}').rows)).toEqual(["Tools"]);
  });

  it("ignores favorites while searching", () => {
    expect(headings(buildRows("yaml", ["uuid"], [], DEFAULT_SETTINGS).rows)).toEqual(["Tools"]);
  });
});
