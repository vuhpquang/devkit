import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("Color Converter", () => {
  it("converts what you type into every format", async () => {
    const C = tool.component;
    render(<C />);
    const input = screen.getByLabelText("Colour value");
    await userEvent.clear(input);
    await userEvent.type(input, "coral");
    expect(await screen.findByText("rgb(255 127 80)")).toBeInTheDocument();
    expect(screen.getAllByText("#ff7f50").length).toBeGreaterThan(0);
    expect(screen.getAllByText("coral").length).toBeGreaterThan(0);
    expect(screen.getByText(/^hsl\(16\.1 100% 65\.7%\)$/)).toBeInTheDocument();
  });

  it("shows an error for something that isn't a colour", async () => {
    const C = tool.component;
    render(<C />);
    const input = screen.getByLabelText("Colour value");
    await userEvent.clear(input);
    await userEvent.type(input, "#12");
    expect(await screen.findByText(/3, 4, 6 or 8 digits/)).toBeInTheDocument();
  });

  it("shows contrast against white and black", () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByText("On white")).toBeInTheDocument();
    expect(screen.getByText("On black")).toBeInTheDocument();
  });
});
