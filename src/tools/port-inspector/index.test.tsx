import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LSOF } from "./fixtures";

const listPorts = vi.fn();
const killProcess = vi.fn();

vi.mock("../../lib/system", async () => {
  const actual = await vi.importActual<typeof import("../../lib/system")>("../../lib/system");
  return { ...actual, listPorts: () => listPorts(), killProcess: (pid: number, force: boolean) => killProcess(pid, force) };
});

import { renderTool as renderWithId, savedValue } from "../../test/renderTool";
import { tool } from "./index";
import { NotInApp } from "../../lib/system";

const renderTool = () => {
  const C = tool.component;
  return render(<C />);
};
const rowOf = (port: string) => screen.getByText(port, { selector: "span.font-mono" }).closest("tr")!;

describe("Port Inspector", () => {
  beforeEach(() => {
    localStorage.clear();
    listPorts.mockReset();
    killProcess.mockReset();
  });

  it("lists TCP listeners by port and filters with the common-port chips", async () => {
    listPorts.mockResolvedValue(LSOF);
    renderTool();
    expect(await screen.findByText("node")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();
    expect(screen.queryByText("dnsproxy")).toBeNull(); // UDP hidden on the TCP tab
    expect(within(rowOf("3000")).getByText("All interfaces · IPv4 + IPv6")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "5432" }));
    expect(screen.queryByText("node")).toBeNull();
    expect(screen.getByText("postgres")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await userEvent.clear(screen.getByRole("textbox", { name: /Filter/ }));
    expect(screen.getByText("dnsproxy")).toBeInTheDocument();
  });

  it("asks before stopping, then stops and refreshes", async () => {
    listPorts.mockResolvedValueOnce(LSOF).mockResolvedValue(LSOF.replace(/p350[\s\S]*?(?=p762)/, ""));
    killProcess.mockResolvedValue(undefined);
    renderTool();
    await screen.findByText("node");
    await userEvent.click(within(rowOf("3000")).getByRole("button", { name: "Stop" }));
    expect(within(rowOf("3000")).getByText("Stop node?")).toBeInTheDocument();
    expect(killProcess).not.toHaveBeenCalled();
    await userEvent.click(within(rowOf("3000")).getAllByRole("button", { name: "Stop" })[0]);
    expect(killProcess).toHaveBeenCalledWith(350, false);
    await waitFor(() => expect(screen.queryByText("node")).toBeNull(), { timeout: 4000 });
  });

  it("offers Force quit when the process keeps the port", async () => {
    listPorts.mockResolvedValue(LSOF);
    killProcess.mockResolvedValue(undefined);
    renderTool();
    await screen.findByText("node");
    await userEvent.click(within(rowOf("3000")).getByRole("button", { name: "Stop" }));
    await userEvent.click(within(rowOf("3000")).getAllByRole("button", { name: "Stop" })[0]);
    const force = await screen.findByRole("button", { name: "Force quit" }, { timeout: 4000 });
    await userEvent.click(force);
    expect(killProcess).toHaveBeenLastCalledWith(350, true);
  });

  it("says when nothing is listening", async () => {
    listPorts.mockResolvedValue("");
    renderTool();
    expect(await screen.findByText("Nothing is listening")).toBeInTheDocument();
  });

  it("explains that it needs the app in a plain browser", async () => {
    listPorts.mockRejectedValue(new NotInApp());
    renderTool();
    expect(await screen.findByText("Open DevKit to inspect ports")).toBeInTheDocument();
  });
  it("remembers the filter, protocol and auto refresh", async () => {
    listPorts.mockResolvedValue(LSOF);
    const { unmount } = renderWithId(tool.component, tool.id);
    await screen.findByText("node");
    await userEvent.type(screen.getByRole("textbox", { name: /Filter/ }), "post");
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    await userEvent.click(screen.getByRole("button", { name: "Auto refresh" }));
    expect(savedValue(tool.id, "proto")).toBe("all");
    unmount();
    renderWithId(tool.component, tool.id);
    expect(await screen.findByText("postgres")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Filter/ })).toHaveValue("post");
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Auto refresh" })).toHaveAttribute("aria-pressed", "true");
  });
});
