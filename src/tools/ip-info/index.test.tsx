import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";

const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: unknown[]) => fetchMock(...a) }));

import { tool } from "./index";

describe("IP Info", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
  });

  it("remembers the query without looking it up on the next launch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByLabelText("IP address"), "1.1.1.1");
    expect(savedValue(tool.id, "ip")).toBe("1.1.1.1");
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("IP address")).toHaveValue("1.1.1.1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
