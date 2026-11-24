import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";

const fetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: unknown[]) => fetchMock(...a) }));

import { tool } from "./index";

describe("DNS Lookup", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
  });

  it("remembers the domain and record types without querying on the next launch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByLabelText("Domain"), "example.com");
    await userEvent.click(screen.getByRole("button", { name: "TXT" }));
    expect(savedValue(tool.id, "types")).toEqual(["A", "AAAA", "MX", "CNAME"]);
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("Domain")).toHaveValue("example.com");
    expect(screen.getByRole("button", { name: "TXT" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "MX" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores saved record types it doesn't know", () => {
    localStorage.setItem("devkit.input.dns-lookup.types", '["A","SRV"]');
    renderTool(tool.component, tool.id);
    expect(screen.getByRole("button", { name: "TXT" })).toHaveAttribute("aria-pressed", "true");
  });
});
