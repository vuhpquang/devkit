import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("Chmod Calculator", () => {
  it("toggling a bit updates the octal field and the command", async () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByLabelText("Mode")).toHaveValue("755");
    await userEvent.click(screen.getByRole("button", { name: "Group read" }));
    expect(screen.getByLabelText("Mode")).toHaveValue("715");
    expect(screen.getByText("chmod 715 file")).toBeInTheDocument();
  });

  it("typing a symbolic mode sets the toggles", async () => {
    const C = tool.component;
    render(<C />);
    const input = screen.getByLabelText("Mode");
    await userEvent.clear(input);
    await userEvent.type(input, "rwsr-xr-x");
    expect(screen.getByRole("button", { name: "Set user ID" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("chmod 4755 file")).toBeInTheDocument();
  });

  it("explains an invalid mode", async () => {
    const C = tool.component;
    render(<C />);
    const input = screen.getByLabelText("Mode");
    await userEvent.clear(input);
    await userEvent.type(input, "99");
    expect(screen.getByText(/Symbolic modes look like/)).toBeInTheDocument();
  });
});
