import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sys = vi.hoisted(() => ({
  throttleStatus: vi.fn(),
  throttleStart: vi.fn(),
  throttleStop: vi.fn(),
  isCancelled: (e: unknown) => (e as Error)?.message === "cancelled",
}));
vi.mock("../../lib/system", () => sys);

import { renderTool as renderWithId, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Network Throttle", () => {
  beforeEach(() => {
    localStorage.clear();
    sys.throttleStatus.mockReset().mockResolvedValue({ active: false, profile: null });
    sys.throttleStart.mockReset().mockResolvedValue(undefined);
    sys.throttleStop.mockReset().mockResolvedValue(undefined);
  });

  it("turns on the chosen preset with the time limit", async () => {
    const C = tool.component;
    render(<C />);
    expect(await screen.findByText("Network runs at full speed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Slow/ }));
    await userEvent.click(screen.getByRole("radio", { name: "1 h" }));
    await userEvent.click(screen.getByRole("button", { name: "Throttle to Slow" }));
    expect(sys.throttleStart).toHaveBeenCalledWith(expect.objectContaining({ preset: "slow", downKbps: 400, delayMs: 400 }), 60);
  });

  it("shows an active throttle and turns it off", async () => {
    sys.throttleStatus.mockResolvedValue({
      active: true,
      profile: JSON.stringify({ preset: "medium", downKbps: 1600, upKbps: 768, delayMs: 150, lossPct: 0, until: Date.now() / 1000 + 600 }),
    });
    const C = tool.component;
    render(<C />);
    expect(await screen.findByText("Throttled: Medium")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(sys.throttleStop).toHaveBeenCalled();
  });

  it("explains itself outside the app", async () => {
    sys.throttleStatus.mockRejectedValue(new Error("This tool needs the DevKit app (it talks to macOS)."));
    const C = tool.component;
    render(<C />);
    expect(await screen.findByText("Open DevKit to throttle the network")).toBeInTheDocument();
  });
  it("remembers the chosen profile and time limit", async () => {
    const { unmount } = renderWithId(tool.component, tool.id);
    await userEvent.click(await screen.findByRole("button", { name: /^Slow/ }));
    await userEvent.click(screen.getByRole("radio", { name: "1 h" }));
    expect(savedValue(tool.id, "choice")).toBe("slow");
    unmount();
    renderWithId(tool.component, tool.id);
    expect(await screen.findByRole("button", { name: /^Slow/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("radio", { name: "1 h" })).toBeChecked();
    expect(sys.throttleStart).not.toHaveBeenCalled();
  });
});
