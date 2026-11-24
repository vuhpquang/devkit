import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";

const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: unknown[]) => fetchMock(...a) }));

import { tool } from "./index";

describe("npm Package", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
  });

  it("remembers the query without looking it up on the next launch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByLabelText("Package name"), "react");
    expect(savedValue(tool.id, "package")).toBe("react");
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Package name")).toHaveValue("react");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
