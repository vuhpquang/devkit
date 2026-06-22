import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { convertCurrency, fetchRates, commonCurrencies } from "./logic";
import type { ExchangeRates } from "./logic";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

const mockFetch = vi.mocked(fetch);

beforeEach(() => {
  mockFetch.mockReset();
});

const mockRates: ExchangeRates = {
  base: "USD",
  rates: {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 157.5,
  },
  lastUpdated: "2024-01-01T00:00:00Z",
};

describe("convertCurrency", () => {
  it("converts 100 USD to EUR using mock rates", () => {
    const result = convertCurrency(100, "USD", "EUR", mockRates);
    expect(result).toBeCloseTo(92, 4);
  });

  it("returns the same amount when from and to are identical", () => {
    const result = convertCurrency(100, "USD", "USD", mockRates);
    expect(result).toBe(100);
  });

  it("converts between two non-base currencies", () => {
    // 100 EUR -> USD -> JPY
    // 100 / 0.92 * 157.5 ≈ 17119.565217...
    const result = convertCurrency(100, "EUR", "JPY", mockRates);
    expect(result).toBeCloseTo(17119.565217, 2);
  });
});

describe("fetchRates", () => {
  it("returns ExchangeRates on a successful response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: "success",
        rates: { USD: 1, EUR: 0.92, GBP: 0.79 },
        time_last_update_utc: "Mon, 01 Jan 2024 00:00:00 +0000",
      }),
    } as unknown as Response);

    const result = await fetchRates("USD");

    expect(result.base).toBe("USD");
    expect(result.rates).toHaveProperty("EUR", 0.92);
    expect(result.rates).toHaveProperty("GBP", 0.79);
    expect(result.lastUpdated).toBe("Mon, 01 Jan 2024 00:00:00 +0000");
  });

  it('throws when response result is "error"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: "error",
        rates: {},
        time_last_update_utc: "",
      }),
    } as unknown as Response);

    await expect(fetchRates("INVALID")).rejects.toThrow("Rate fetch failed");
  });

  it("throws when fetch returns a non-200 HTTP status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);

    await expect(fetchRates("USD")).rejects.toThrow(
      "open.er-api.com returned HTTP 503"
    );
  });
});

describe("commonCurrencies", () => {
  it('returns an array containing "USD" and "EUR"', () => {
    const currencies = commonCurrencies();
    expect(currencies).toContain("USD");
    expect(currencies).toContain("EUR");
    expect(Array.isArray(currencies)).toBe(true);
    expect(currencies.length).toBeGreaterThan(0);
  });
});
