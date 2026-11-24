import { describe, it, expect, beforeEach } from "vitest";
import { renderTool, savedValue } from "../../test/renderTool";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("JSON ↔ CSV", () => {
  it("converts the sample JSON to CSV", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("Converted to CSV")).toBeInTheDocument();
  });

  it("switches to CSV → JSON and converts its sample", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("radio", { name: "CSV → JSON" }));
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("Converted to JSON")).toBeInTheDocument();
  });
});

describe("JSON ↔ CSV remembers", () => {
  beforeEach(() => localStorage.clear());

  it("its delimiter and number detection across a relaunch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("radio", { name: "Semicolon" }));
    await userEvent.click(screen.getByRole("button", { name: /Detect numbers/ }));
    expect(savedValue(tool.id, "delimiter")).toBe("semicolon");
    expect(savedValue(tool.id, "detect")).toBe(false);
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByRole("radio", { name: "Semicolon" })).toBeChecked();
    expect(screen.getByRole("button", { name: /Detect numbers/ })).toHaveAttribute("aria-pressed", "false");
  });
});
