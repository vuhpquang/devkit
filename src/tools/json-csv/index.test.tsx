import { describe, it, expect } from "vitest";
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
