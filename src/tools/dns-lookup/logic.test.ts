import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { dnsLookup, defaultTypes } from "./logic";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

const mockFetch = vi.mocked(fetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("dnsLookup", () => {
  it("returns records on a valid A-record response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [
          { name: "google.com", type: 1, TTL: 300, data: "142.250.185.46" },
        ],
      }),
    } as unknown as Response);

    const result = await dnsLookup("google.com", ["A"]);

    expect(result.domain).toBe("google.com");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual({
      type: "A",
      name: "google.com",
      ttl: 300,
      data: "142.250.185.46",
    });
  });

  it("throws when domain is empty", async () => {
    await expect(dnsLookup("", ["A"])).rejects.toThrow("Domain is required");
    await expect(dnsLookup("   ", ["A"])).rejects.toThrow("Domain is required");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when fetch returns a non-200 status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    await expect(dnsLookup("example.com", ["A"])).rejects.toThrow(
      "DNS query for A records returned HTTP 503"
    );
  });

  it("returns empty records when the response has no Answer field", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Status: 0 }),
    } as unknown as Response);

    const result = await dnsLookup("example.com", ["A"]);

    expect(result.domain).toBe("example.com");
    expect(result.records).toHaveLength(0);
  });

  it("throws when fetch itself rejects (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("Network unreachable"));

    await expect(dnsLookup("example.com", ["A"])).rejects.toThrow(
      'Failed to fetch A records for "example.com": Network unreachable'
    );
  });
});

describe("defaultTypes", () => {
  it("returns an array containing all 5 DNS record types", () => {
    const types = defaultTypes();
    expect(types).toContain("A");
    expect(types).toContain("AAAA");
    expect(types).toContain("MX");
    expect(types).toContain("TXT");
    expect(types).toContain("CNAME");
    expect(types).toHaveLength(5);
  });
});
