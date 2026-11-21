import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("HTML Entities screen", () => {
  it("encodes the sample, and encodes non-ASCII when switched on", async () => {
    const C = tool.component;
    const { container } = render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("Encoded")).toBeInTheDocument();
    expect(container.textContent).toContain("&lt;a href=&quot;");
    await userEvent.click(screen.getByRole("radio", { name: /Encode non-ASCII/ }));
    expect(container.textContent).toContain("&#272;");
  });

  it("decodes in Decode mode", async () => {
    const C = tool.component;
    const { container } = render(<C />);
    await userEvent.click(screen.getByRole("radio", { name: "Decode" }));
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("Decoded")).toBeInTheDocument();
    expect(container.textContent).toContain("<p>Café & crème — © 2026 😀</p>");
  });
});
