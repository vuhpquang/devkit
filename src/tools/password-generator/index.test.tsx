import { beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Password Generator", () => {
  it("generates 5 passwords on open", () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByText("Passwords · 5")).toBeInTheDocument();
    expect(screen.getByText("Very strong")).toBeInTheDocument(); // 20 chars from 87 ≈ 129 bits
  });

  it("explains when no character set is selected", async () => {
    const C = tool.component;
    render(<C />);
    for (const name of ["a–z", "A–Z", "0–9", "!@#$"]) await userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick at least one kind of character");
    expect(screen.getByText("Passwords · 0")).toBeInTheDocument();
  });

  it("lowers the strength label for short, digit-only passwords", async () => {
    const C = tool.component;
    render(<C />);
    for (const name of ["a–z", "A–Z", "!@#$"]) await userEvent.click(screen.getByRole("button", { name }));
    const length = screen.getByLabelText("Length");
    await userEvent.clear(length);
    await userEvent.type(length, "8");
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });
});

describe("Password Generator saved options", () => {
  beforeEach(() => localStorage.clear());

  it("brings the options back after a relaunch, never the passwords", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: "!@#$" }));
    const count = screen.getByLabelText("How many passwords");
    await userEvent.clear(count);
    await userEvent.type(count, "3");
    expect(savedValue(tool.id, "options")).toMatchObject({ symbols: false, length: 20 });
    first.unmount();
    expect(Object.keys(localStorage).sort()).toEqual([
      "devkit.input.password-generator.count",
      "devkit.input.password-generator.options",
    ]);
    renderTool(tool.component, tool.id);
    expect(screen.getByRole("button", { name: "!@#$" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("How many passwords")).toHaveValue(3);
    expect(screen.getByText("Passwords · 3")).toBeInTheDocument();
  });
});
