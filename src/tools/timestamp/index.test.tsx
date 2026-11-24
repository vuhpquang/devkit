import { beforeEach, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Timestamp Converter saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the time and its result back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByPlaceholderText("1700000000"), "1700000000");
    expect(savedValue(tool.id, "iso")).toBe("2023-11-14T22:13:20.000Z");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByPlaceholderText("1700000000")).toHaveValue("1700000000");
    expect(screen.getByPlaceholderText("2026-01-31T12:00:00.000Z")).toHaveValue("2023-11-14T22:13:20.000Z");
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("1700000000000")).toBeInTheDocument();
  });
});
