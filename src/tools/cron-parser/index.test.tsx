import { beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
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

describe("Cron Parser saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the expression and time zone back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: "Hourly" }));
    await userEvent.click(screen.getByRole("radio", { name: "UTC" }));
    expect(savedValue(tool.id, "zone")).toBe("utc");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Cron expression")).toHaveValue("0 * * * *");
    expect(screen.getByRole("radio", { name: "UTC" })).toHaveAttribute("aria-checked", "true");
  });
});
