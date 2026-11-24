import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";

const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: unknown[]) => fetchMock(...a) }));

import { tool } from "./index";

describe("Currency Convert", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
  });

  it("remembers the amount and currencies without fetching on the next launch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.clear(screen.getByPlaceholderText("100"));
    await userEvent.type(screen.getByPlaceholderText("100"), "250");
    await userEvent.click(screen.getByRole("button", { name: "Swap currencies" }));
    expect(savedValue(tool.id, "from")).toBe("EUR");
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByPlaceholderText("100")).toHaveValue("250");
    const [from, to] = screen.getAllByRole("combobox");
    expect(from).toHaveValue("EUR");
    expect(to).toHaveValue("USD");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
