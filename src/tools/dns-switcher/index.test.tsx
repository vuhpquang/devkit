import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sys = vi.hoisted(() => ({
  dnsStatus: vi.fn(),
  dnsSet: vi.fn(),
  dnsFlush: vi.fn(),
  dnsBenchmark: vi.fn(),
  isCancelled: (e: unknown) => (e as Error)?.message === "cancelled",
}));
vi.mock("../../lib/system", () => sys);

import { renderTool as renderWithId, savedValue } from "../../test/renderTool";
import { tool } from "./index";

const STATUS = {
  services: [
    { name: "Wi-Fi", enabled: true, servers: ["1.1.1.1", "1.0.0.1"] },
    { name: "Thunderbolt Bridge", enabled: false, servers: [] },
  ],
  resolvers: "DNS configuration\n\nresolver #1\n  nameserver[0] : 1.1.1.1\n  nameserver[1] : 1.0.0.1\n",
};

describe("DNS Switcher", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(sys).forEach((f) => typeof f === "function" && "mockReset" in f && (f as ReturnType<typeof vi.fn>).mockReset());
    sys.dnsStatus.mockResolvedValue(STATUS);
  });

  it("shows what's in use and switches every active connection to Google", async () => {
    const C = tool.component;
    render(<C />);
    expect(await screen.findByText("In use", { selector: "span" })).toBeInTheDocument();
    sys.dnsSet.mockResolvedValue(undefined);
    const google = screen.getByText("Google").closest("div")!.parentElement!;
    await userEvent.click(within(google).getByRole("button", { name: "Use" }));
    expect(sys.dnsSet).toHaveBeenCalledWith(null, ["8.8.8.8", "8.8.4.4"]);
    expect(await screen.findByText(/DNS set to Google/)).toBeInTheDocument();
  });

  it("says nothing when the password prompt is cancelled", async () => {
    const C = tool.component;
    render(<C />);
    await screen.findByText("Google");
    sys.dnsSet.mockRejectedValue(new Error("cancelled"));
    const dnspod = screen.getByText("DNSPod").closest("div")!.parentElement!;
    await userEvent.click(within(dnspod).getByRole("button", { name: "Use" }));
    expect(sys.dnsSet).toHaveBeenCalledWith(null, ["119.29.29.29"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saves a custom preset", async () => {
    const C = tool.component;
    render(<C />);
    await screen.findByText("Google");
    await userEvent.type(screen.getByPlaceholderText("Quad9"), "Quad9");
    await userEvent.type(screen.getByPlaceholderText("9.9.9.9 149.112.112.112"), "9.9.9.9");
    await userEvent.click(screen.getByRole("button", { name: "Save preset" }));
    expect(screen.getByText("Quad9", { selector: "span" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("devkit.dns.presets")!)[0]).toMatchObject({ name: "Quad9", servers: ["9.9.9.9"] });
  });
  it("remembers the connection to apply to and the preset form", async () => {
    const { unmount } = renderWithId(tool.component, tool.id);
    await userEvent.selectOptions(await screen.findByLabelText("Apply to"), "Wi-Fi");
    await userEvent.type(screen.getByPlaceholderText("Quad9"), "Quad9");
    expect(savedValue(tool.id, "target")).toBe("Wi-Fi");
    unmount();
    renderWithId(tool.component, tool.id);
    expect(await screen.findByLabelText("Apply to")).toHaveValue("Wi-Fi");
    expect(screen.getByPlaceholderText("Quad9")).toHaveValue("Quad9");
  });

  it("falls back to every connection when the saved one is gone", async () => {
    localStorage.setItem("devkit.input.dns-switcher.target", '"USB LAN"');
    renderWithId(tool.component, tool.id);
    expect(await screen.findByLabelText("Apply to")).toHaveValue("__all__");
  });
});
