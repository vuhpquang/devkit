import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Regex Tester screen", () => {
  it("highlights sample matches and lists named groups", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    const view = await screen.findByLabelText("Highlighted matches");
    expect(within(view).getAllByTitle(/Match/)).toHaveLength(3);
    expect(screen.getByText("3 matches")).toBeInTheDocument();
    expect(screen.getAllByText("domain").length).toBeGreaterThan(0);
  });

  it("shows the engine error for an invalid pattern", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText("Regular expression"), "(abc");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Invalid regular expression/);
  });

  it("toggles flags", async () => {
    const C = tool.component;
    render(<C />);
    const i = screen.getByRole("button", { name: "Flag i" });
    expect(i).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(i);
    expect(i).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Regex Tester saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings pattern, flags and text back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    await userEvent.click(screen.getByRole("button", { name: "Flag i" }));
    expect(savedValue(tool.id, "flags")).toBe("gi");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Regular expression")).toHaveValue("(?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.]+)");
    expect(screen.getByRole("button", { name: "Flag i" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("3 matches")).toBeInTheDocument();
  });
});
