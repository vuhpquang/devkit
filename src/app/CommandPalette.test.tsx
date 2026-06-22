import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";

describe("CommandPalette", () => {
  it("renders an input when open", () => {
    render(<CommandPalette open onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByPlaceholderText(/jump to a tool/i)).toBeInTheDocument();
  });
  it("renders nothing when closed", () => {
    const { container } = render(
      <CommandPalette open={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
