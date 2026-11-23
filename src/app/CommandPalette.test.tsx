import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildRows, CommandPalette } from "./CommandPalette";
import { DEFAULT_SETTINGS } from "./settings";

describe("CommandPalette", () => {
  it("renders an input when open", () => {
    render(<CommandPalette open onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByPlaceholderText(/jump to a tool/i)).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<CommandPalette open={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("filters, moves with the arrow keys and opens with Enter", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onSelect={onSelect} />);
    await userEvent.type(screen.getByRole("combobox"), "json");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(options[1].id.replace("palette-", ""));
    expect(onClose).toHaveBeenCalled();
  });

  it("says when nothing matches", async () => {
    render(<CommandPalette open onClose={vi.fn()} onSelect={vi.fn()} />);
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
    expect(items.slice(0, 3).map((t) => t.id)).toEqual(["uuid", "json-yaml", "base64"]);
    expect(items.filter((t) => t.id === "json-yaml")).toHaveLength(1);
  });

  it("has a single Tools group with no favorites or recent", () => {
    expect(headings(buildRows("", [], [], DEFAULT_SETTINGS).rows)).toEqual(["Tools"]);
  });

  it("ignores favorites while searching", () => {
    expect(headings(buildRows("yaml", ["uuid"], [], DEFAULT_SETTINGS).rows)).toEqual(["Tools"]);
  });
});
