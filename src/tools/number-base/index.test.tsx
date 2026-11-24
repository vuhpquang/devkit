import { beforeEach, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Number Base saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the number back in the field it was typed in", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByLabelText(/Hexadecimal/), "ff");
    expect(savedValue(tool.id, "source")).toEqual({ base: 16, value: "ff" });
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText(/Hexadecimal/)).toHaveValue("ff");
    expect(screen.getByLabelText(/Decimal/)).toHaveValue("255");
  });
});
