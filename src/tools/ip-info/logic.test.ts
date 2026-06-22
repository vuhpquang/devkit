import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { ipLookup } from "./logic";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

const mockFetch = vi.mocked(fetch);

const successResponse = {
  status: "success",
  country: "United States",
  countryCode: "US",
  region: "California",
  regionName: "California",
  city: "Mountain View",
  lat: 37.3861,
  lon: -122.0839,
  isp: "Google LLC",
  org: "Google LLC",
  as: "AS15169 Google LLC",
  query: "8.8.8.8",
  timezone: "America/Los_Angeles",
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ipLookup", () => {
  it('calls the no-arg endpoint when passed an empty string and returns IpInfo', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...successResponse, query: "1.2.3.4" }),
    } as unknown as Response);

    const result = await ipLookup("");

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("ip-api.com/json?");
    expect(String(url)).not.toMatch(/\/json\/[^?]/);
    expect(result.ip).toBe("1.2.3.4");
    expect(result.country).toBe("United States");
    expect(result.city).toBe("Mountain View");
  });

  it('calls the specific-IP endpoint when passed "8.8.8.8" and returns IpInfo', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => successResponse,
    } as unknown as Response);

    const result = await ipLookup("8.8.8.8");

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/json/8.8.8.8");
    expect(result.ip).toBe("8.8.8.8");
    expect(result.org).toBe("Google LLC");
  });

  it('calls the no-arg endpoint when passed "me"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...successResponse, query: "203.0.113.5" }),
    } as unknown as Response);

    await ipLookup("me");

    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("ip-api.com/json?");
    expect(String(url)).not.toMatch(/\/json\/[^?]/);
  });

  it('throws when the response status is not "success"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "fail",
        message: "reserved range",
        query: "192.168.0.1",
      }),
    } as unknown as Response);

    await expect(ipLookup("192.168.0.1")).rejects.toThrow("reserved range");
  });

  it("throws when fetch returns a non-200 HTTP status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as unknown as Response);

    await expect(ipLookup("8.8.8.8")).rejects.toThrow(
      "ip-api.com returned HTTP 429"
    );
  });
});
