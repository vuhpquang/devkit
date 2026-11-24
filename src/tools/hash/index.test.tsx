import { beforeEach, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Hash Generator saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the text and letter case back after a relaunch", async () => {
    // CodeMirror can't be typed into under jsdom: seed the saved text, change the case through the UI.
    localStorage.setItem("devkit.input.hash.input", JSON.stringify("abc"));
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("radio", { name: "ABC" }));
    expect(savedValue(tool.id, "case")).toBe("upper");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(document.querySelector(".cm-content")?.textContent).toBe("abc");
    expect(screen.getByRole("radio", { name: "ABC" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("900150983CD24FB0D6963F7D28E17F72")).toBeInTheDocument();
  });
});
