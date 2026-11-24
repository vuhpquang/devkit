import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("JWT Decode", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the token across a relaunch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: "Sample" }));
    expect(String(savedValue(tool.id, "token"))).toMatch(/^eyJ/);
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByText("Not expired")).toBeInTheDocument();
  });
});
