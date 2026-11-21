import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./CommandPalette";

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
