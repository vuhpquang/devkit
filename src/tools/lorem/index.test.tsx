import { beforeEach, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Lorem Ipsum saved options", () => {
  beforeEach(() => localStorage.clear());

  it("brings the paragraph count back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    const count = screen.getByLabelText("Paragraphs");
    await userEvent.clear(count);
    await userEvent.type(count, "7");
    expect(savedValue(tool.id, "paragraphs")).toBe("7");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Paragraphs")).toHaveValue(7);
  });
});
