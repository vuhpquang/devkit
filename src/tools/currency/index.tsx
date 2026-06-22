import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import {
  fetchRates,
  convertCurrency,
  commonCurrencies,
  type ExchangeRates,
} from "./logic";

const CURRENCIES = commonCurrencies();

const btn =
  "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed";

const select =
  "px-2 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Currency() {
  const [amount, setAmount] = useState<string>("1");
  const [from, setFrom] = useState<string>("USD");
  const [to, setTo] = useState<string>("EUR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [ratesCache, setRatesCache] = useState<Map<string, ExchangeRates>>(
    () => new Map()
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function handleConvert() {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      setError("Please enter a valid number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let rates = ratesCache.get(from);
      if (!rates) {
        rates = await fetchRates(from);
        setRatesCache((prev) => new Map(prev).set(from, rates!));
      }

      const converted = convertCurrency(parsedAmount, from, to, rates);
      setResult(converted);
      setLastUpdated(rates.lastUpdated);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSwap() {
    setFrom(to);
    setTo(from);
    setResult(null);
    setLastUpdated(null);
  }

  const numericAmount = parseFloat(amount);
  const hasResult = result !== null && !isNaN(numericAmount);

  return (
    <ToolLayout title="Currency Convert">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="px-2 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="1"
            min="0"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">From</label>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={select}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          className={btn}
          onClick={handleSwap}
          title="Swap currencies"
          aria-label="Swap currencies"
        >
          ⇄
        </button>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">To</label>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={select}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          className={btn}
          onClick={handleConvert}
          disabled={loading}
        >
          {loading ? "Loading..." : "Convert"}
        </button>
      </div>

      <ErrorBanner message={error} />

      {!hasResult && !loading && !error && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Enter an amount and press Convert.
        </p>
      )}

      {hasResult && (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tabular-nums">
            {numericAmount} {from} = {result} {to}
          </p>
          {lastUpdated && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
      )}
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "currency",
  name: "Currency Convert",
  category: "Network",
  keywords: ["currency", "convert", "exchange", "rate", "forex", "usd", "eur"],
  online: true,
  component: Currency,
};
