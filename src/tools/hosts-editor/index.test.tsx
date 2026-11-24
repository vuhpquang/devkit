import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sys = vi.hoisted(() => ({
  hostsRead: vi.fn(),
  hostsWrite: vi.fn(),
  hostsBackup: vi.fn(),
  isCancelled: (e: unknown) => (e as Error)?.message === "cancelled",
}));
vi.mock("../../lib/system", () => sys);

import { renderTool as renderWithId, savedValue } from "../../test/renderTool";
import { tool } from "./index";

const FILE = "127.0.0.1\tlocalhost\n::1\tlocalhost\n127.0.0.1 api.test\n";

describe("Hosts File", () => {
  beforeEach(() => {
    localStorage.clear();
    sys.hostsRead.mockReset().mockResolvedValue(FILE);
    sys.hostsBackup.mockReset().mockResolvedValue(null);
    sys.hostsWrite.mockReset().mockResolvedValue(undefined);
  });

  it("switches an entry off and saves the file", async () => {
    const C = tool.component;
    render(<C />);
    const sw = await screen.findByRole("switch", { name: "Disable api.test" });
    for (const s of screen.getAllByRole("switch", { name: "Disable localhost" })) expect(s).toBeDisabled();
    await userEvent.click(sw);
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(sys.hostsWrite).toHaveBeenCalledWith("127.0.0.1\tlocalhost\n::1\tlocalhost\n# 127.0.0.1 api.test\n");
  });

  it("adds a validated entry", async () => {
    const C = tool.component;
    render(<C />);
    await screen.findByRole("switch", { name: "Disable api.test" });
    await userEvent.type(screen.getByLabelText("Host names"), "shop.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("switch", { name: "Disable shop.test" })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("IP address"));
    await userEvent.type(screen.getByLabelText("IP address"), "nope");
    await userEvent.type(screen.getByLabelText("Host names"), "x.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("“nope” isn't an IP address.")).toBeInTheDocument();
  });
  it("remembers the Add entry form, not the file", async () => {
    const { unmount } = renderWithId(tool.component, tool.id);
    await screen.findByRole("switch", { name: "Disable api.test" });
    await userEvent.clear(screen.getByLabelText("IP address"));
    await userEvent.type(screen.getByLabelText("IP address"), "10.0.0.2");
    await userEvent.type(screen.getByLabelText("Host names"), "shop.test");
    expect(savedValue(tool.id, "names")).toBe("shop.test");
    unmount();
    renderWithId(tool.component, tool.id);
    expect(await screen.findByLabelText("IP address")).toHaveValue("10.0.0.2");
    expect(screen.getByLabelText("Host names")).toHaveValue("shop.test");
    expect(Object.keys(localStorage).sort()).toEqual(["devkit.input.hosts-editor.ip", "devkit.input.hosts-editor.names"]);
  });
});
