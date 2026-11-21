import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fetchMock = vi.fn();
let impl: ((...a: unknown[]) => Promise<unknown>) | null = null;
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: (...a: unknown[]) => (impl ? impl(...a) : fetchMock(...a)) }));

import { tool } from "./index";

describe("Speed Test", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    impl = null;
  });

  it("runs latency, download and upload and shows a verdict", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }));
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Start test/ }));
    expect(await screen.findByRole("button", { name: /Test again/ })).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.endsWith("/__down?bytes=0"))).toHaveLength(10);
    expect(urls.some((u) => u.endsWith("/__down?bytes=25000000"))).toBe(true);
    expect(fetchMock.mock.calls.some((c) => (c[0] as string).endsWith("/__up") && (c[1] as { method: string }).method === "POST")).toBe(true);
    expect(screen.getByText(/connection$/)).toBeInTheDocument();
    expect(screen.getByText(/Measured against Cloudflare/)).toBeInTheDocument();
  });

  it("says what to do when Cloudflare can't be reached", async () => {
    // A plain async function, not a vi.fn implementation: vitest reports errors thrown by mock
    // implementations even when the caller catches them.
    impl = async () => {
      throw new TypeError("network down");
    };
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Start test/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach Cloudflare. Check your connection.");
  });

  it("reports a server error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) });
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Start test/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
  });
});
