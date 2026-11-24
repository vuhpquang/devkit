import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";

const fetchMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => fetchMock(...a) }));

import { tool } from "./index";

describe("WHOIS", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
  });

  it("remembers the query without looking it up on the next launch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByLabelText("Domain"), "example.com");
    expect(savedValue(tool.id, "domain")).toBe("example.com");
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Domain")).toHaveValue("example.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
