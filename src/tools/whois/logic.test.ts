import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { whoisLookup } from "./logic";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

const sampleWhoisText = `
Domain Name: GOOGLE.COM
Registry Domain ID: 2138514_DOMAIN_COM-VRSN
Registrar: MarkMonitor Inc.
Creation Date: 1997-09-15T04:00:00Z
Updated Date: 2019-09-09T15:39:04Z
Expiry Date: 2028-09-14T04:00:00Z
Name Server: NS1.GOOGLE.COM
`.trim();

describe("whoisLookup", () => {
  it("returns the whois text returned by invoke", async () => {
    mockInvoke.mockResolvedValue(sampleWhoisText);

    const result = await whoisLookup("google.com");

    expect(mockInvoke).toHaveBeenCalledWith("whois_lookup", {
      domain: "google.com",
    });
    expect(result).toBe(sampleWhoisText);
  });

  it("throws before calling invoke when domain is empty", async () => {
    await expect(whoisLookup("")).rejects.toThrow("Domain is required");
    await expect(whoisLookup("   ")).rejects.toThrow("Domain is required");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("throws an Error when invoke rejects", async () => {
    mockInvoke.mockRejectedValue("WHOIS server unreachable");

    await expect(whoisLookup("google.com")).rejects.toThrow(
      "WHOIS server unreachable"
    );
  });
});
