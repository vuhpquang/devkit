import { beforeEach, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Text Diff saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings both sides back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(savedValue(tool.id, "original")).toMatch(/port: 8080/);
    expect(savedValue(tool.id, "modified")).toMatch(/port: 9090/);
    first.unmount();
    renderTool(tool.component, tool.id);
    const editors = document.querySelectorAll(".cm-content");
    expect(editors[0].textContent).toContain("port: 8080");
    expect(editors[1].textContent).toContain("port: 9090");
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("−2")).toBeInTheDocument();
  });
});
