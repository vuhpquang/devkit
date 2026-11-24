import { beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
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

describe("Chmod Calculator saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the mode and file name back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: "Group read" }));
    const file = screen.getByLabelText("File name");
    await userEvent.clear(file);
    await userEvent.type(file, "deploy.sh");
    expect(savedValue(tool.id, "mode")).toBe("715");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Mode")).toHaveValue("715");
    expect(screen.getByRole("button", { name: "Group read" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("chmod 715 deploy.sh")).toBeInTheDocument();
  });
});
