import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
