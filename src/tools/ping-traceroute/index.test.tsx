import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProbeEvent } from "../../lib/system";

let emit: (e: ProbeEvent) => void = () => {};
const startProbe = vi.fn(async (_k: string, _h: string, _c: number, on: (e: ProbeEvent) => void) => {
  emit = on;
  return 7;
});
const stopProbe = vi.fn(async (_id: number) => {});
vi.mock("../../lib/system", () => ({
  startProbe: (...a: Parameters<typeof startProbe>) => startProbe(...a),
  stopProbe: (id: number) => stopProbe(id),
}));

import { tool } from "./index";

describe("Ping & Traceroute", () => {
  beforeEach(() => {
    startProbe.mockClear();
    stopProbe.mockClear();
  });

  it("pings, shows live stats and stops", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText("Host"), "1.1.1.1{Enter}");
    expect(startProbe).toHaveBeenCalledWith("ping", "1.1.1.1", 5, expect.any(Function));
    act(() => {
      emit({ kind: "line", text: "64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=10.0 ms" });
      emit({ kind: "line", text: "Request timeout for icmp_seq 1" });
    });
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getAllByText("10.0 ms").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Stop/ }));
    expect(stopProbe).toHaveBeenCalledWith(7);
    act(() => emit({ kind: "done", code: 0 }));
    expect(screen.getByRole("button", { name: /Ping/ })).toBeInTheDocument();
  });

  it("traces and lists hops", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("radio", { name: /Traceroute/ }));
    await userEvent.type(screen.getByLabelText("Host"), "example.com{Enter}");
    expect(startProbe).toHaveBeenCalledWith("traceroute", "example.com", 0, expect.any(Function));
    act(() => {
      emit({ kind: "line", text: "traceroute to example.com (93.184.215.14), 30 hops max, 40 byte packets" });
      emit({ kind: "line", text: " 1  192.168.1.1  2.123 ms" });
      emit({ kind: "line", text: " 2  *" });
    });
    expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
    expect(screen.getByText("* no reply")).toBeInTheDocument();
  });

  it("refuses an unsafe host without calling the app", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText("Host"), "a;b{Enter}");
    expect(startProbe).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/host name or an IP/);
  });

  it("shows the app-only message in a plain browser", async () => {
    startProbe.mockRejectedValueOnce(new Error("This tool needs the DevKit app (it talks to macOS)."));
    const C = tool.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText("Host"), "1.1.1.1{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/DevKit app/);
  });
});
