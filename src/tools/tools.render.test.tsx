import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tools, getToolById } from "./registry";

describe("every tool renders", () => {
  it.each(tools.map((t) => [t.id, t] as const))("%s mounts without crashing", (_id, tool) => {
    const C = tool.component;
    const { container } = render(<C />);
    expect(container.firstChild).not.toBeNull();
    cleanup();
  });

  it("every tool has a description and an icon", () => {
    for (const t of tools) {
      expect(t.description.length, t.id).toBeGreaterThan(10);
      expect(t.icon, t.id).toBeTruthy();
    }
  });
});

describe("live tools", () => {
  it("number base: typing decimal fills the other bases", async () => {
    const C = getToolById("number-base")!.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText(/Decimal/), "255");
    expect(screen.getByLabelText(/Hexadecimal/)).toHaveValue("ff");
    expect(screen.getByLabelText(/Binary/)).toHaveValue("11111111");
    expect(screen.getByLabelText(/Octal/)).toHaveValue("377");
  });

  it("number base: shows an error for a digit outside the base", async () => {
    const C = getToolById("number-base")!.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText(/Binary/), "12");
    expect(screen.getByRole("alert")).toHaveTextContent(/Not a binary number/);
  });

  it("json format: the Sample button produces formatted output", async () => {
    const C = getToolById("json-format")!.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("Valid JSON")).toBeInTheDocument();
  });
});
