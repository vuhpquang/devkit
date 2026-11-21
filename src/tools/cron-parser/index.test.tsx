import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("Cron Parser", () => {
  it("explains the default expression and lists 10 runs", () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByTestId("cron-description")).toHaveTextContent("At 09:00, Monday through Friday");
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("applies a preset", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: "Hourly" }));
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 * * * *");
    expect(screen.getByTestId("cron-description")).toHaveTextContent("Every hour");
  });

  it("explains why an expression is invalid", async () => {
    const C = tool.component;
    render(<C />);
    const input = screen.getByLabelText("Cron expression");
    await userEvent.clear(input);
    await userEvent.type(input, "* * *");
    expect(await screen.findByRole("alert")).toHaveTextContent(/got 3/);
  });
});
