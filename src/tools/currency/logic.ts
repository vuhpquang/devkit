import { fetch } from "@tauri-apps/plugin-http";

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string; // ISO date string from the API
}

interface ErApiResponse {
  result: "success" | "error";
  rates: Record<string, number>;
  time_last_update_utc: string;
}

// Fetch rates from open.er-api.com. Base currency determines the denominator.
export async function fetchRates(baseCurrency: string): Promise<ExchangeRates> {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`;

  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new Error(
      `Network error while contacting open.er-api.com: ${(e as Error).message}`
    );
  }

  if (!response.ok) {
    throw new Error(`open.er-api.com returned HTTP ${response.status}`);
  }

  let json: ErApiResponse;
  try {
    json = (await response.json()) as ErApiResponse;
  } catch (e) {
    throw new Error(
      `Failed to parse response from open.er-api.com: ${(e as Error).message}`
    );
  }

  if (json.result !== "success") {
    throw new Error("Rate fetch failed");
  }

  return {
    base: baseCurrency.toUpperCase(),
    rates: json.rates,
    lastUpdated: json.time_last_update_utc,
  };
}

// Convert an amount from one currency to another using pre-fetched rates.
// from and to must exist in rates.rates. Returns converted amount rounded to 6 decimal places.
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates
): number {
  if (from === to) return amount;

  let result: number;
  if (from === rates.base) {
    result = amount * rates.rates[to];
  } else {
    result = (amount / rates.rates[from]) * rates.rates[to];
  }

  return Math.round(result * 1e6) / 1e6;
}

// A curated list of commonly used currency codes for the UI picker.
export function commonCurrencies(): string[] {
  return [
    "USD", "EUR", "GBP", "JPY", "CNY",
    "AUD", "CAD", "CHF", "HKD", "SGD",
    "KRW", "INR", "VND", "THB", "MYR",
    "IDR", "PHP", "TWD", "BRL", "MXN",
  ];
}
