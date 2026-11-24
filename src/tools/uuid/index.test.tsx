import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("UUID Generator remembers", () => {
  beforeEach(() => localStorage.clear());

  it("its count, case and hyphens across a relaunch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    const count = screen.getByLabelText("How many UUIDs");
    await userEvent.clear(count);
    await userEvent.type(count, "12");
    await userEvent.click(screen.getByRole("radio", { name: "ABC" }));
    await userEvent.click(screen.getByRole("radio", { name: "No hyphens" }));
    expect(savedValue(tool.id, "count")).toBe("12");
    expect(savedValue(tool.id, "case")).toBe("upper");
    expect(savedValue(tool.id, "hyphens")).toBe("without");
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("How many UUIDs")).toHaveValue(12);
    expect(screen.getByRole("radio", { name: "ABC" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "No hyphens" })).toBeChecked();
  });
});
