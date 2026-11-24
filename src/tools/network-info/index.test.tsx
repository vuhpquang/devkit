import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RAW } from "./fixtures";

const netInfo = vi.fn();
const ipLookup = vi.fn();

vi.mock("../../lib/system", async () => {
  const actual = await vi.importActual<typeof import("../../lib/system")>("../../lib/system");
  return { ...actual, netInfo: () => netInfo() };
});
vi.mock("../ip-info/logic", () => ({ ipLookup: (ip: string) => ipLookup(ip) }));

import { renderTool as renderWithId, savedValue } from "../../test/renderTool";
import { tool } from "./index";
import { NotInApp } from "../../lib/system";
import { SettingsProvider } from "../../app/settings";

const renderTool = () => {
  const C = tool.component;
  return render(
    <SettingsProvider>
      <C />
    </SettingsProvider>,
  );
};

describe("Network Info", () => {
  beforeEach(() => {
    localStorage.clear();
    netInfo.mockReset();
    ipLookup.mockReset();
  });

  it("shows the summary and the active physical interfaces", async () => {
    netInfo.mockResolvedValue(RAW);
    renderTool();
    expect(await screen.findByText("dev-mac.local")).toBeInTheDocument();
    expect(screen.getAllByText("Wi-Fi · en0")).toHaveLength(2); // summary + its panel
    expect(screen.getByText("192.0.2.1")).toBeInTheDocument();
    expect(screen.getByText("1.1.1.1, 8.8.8.8, 192.0.2.53")).toBeInTheDocument();
    expect(screen.getByText("Hidden by macOS (needs Location access)")).toBeInTheDocument();
    // Interface panels: Wi-Fi and the USB adapter; loopback and tunnels stay hidden.
    expect(screen.getByRole("heading", { name: "Wi-Fi · en0" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AX88179B · en8" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "lo0" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show virtual interfaces" }));
    expect(screen.getByRole("heading", { name: "lo0" })).toBeInTheDocument();
  });

  it("looks up the public IP on request", async () => {
    netInfo.mockResolvedValue(RAW);
    ipLookup.mockResolvedValue({ ip: "203.0.113.9", city: "Hanoi", country: "Vietnam", isp: "Example ISP" });
    renderTool();
    await userEvent.click(await screen.findByRole("button", { name: "Show public IP" }));
    expect(await screen.findByText("203.0.113.9")).toBeInTheDocument();
    expect(ipLookup).toHaveBeenCalledWith("");
  });

  it("doesn't offer the public IP when online tools are off", async () => {
    localStorage.setItem("devkit.settings", JSON.stringify({ showOnlineTools: false }));
    netInfo.mockResolvedValue(RAW);
    renderTool();
    expect(await screen.findByText("Online tools are off in Settings")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show public IP" })).toBeNull();
  });

  it("explains that it needs the app in a plain browser", async () => {
    netInfo.mockRejectedValue(new NotInApp());
    renderTool();
    expect(await screen.findByText("Open DevKit to see this Mac's network")).toBeInTheDocument();
  });
  it("remembers Show virtual interfaces", async () => {
    netInfo.mockResolvedValue(RAW);
    const C = tool.component;
    const Wrapped = () => (
      <SettingsProvider>
        <C />
      </SettingsProvider>
    );
    const { unmount } = renderWithId(Wrapped, tool.id);
    await userEvent.click(await screen.findByRole("button", { name: "Show virtual interfaces" }));
    expect(savedValue(tool.id, "showVirtual")).toBe(true);
    unmount();
    renderWithId(Wrapped, tool.id);
    expect(await screen.findByRole("button", { name: "Show virtual interfaces" })).toHaveAttribute("aria-pressed", "true");
  });
});
