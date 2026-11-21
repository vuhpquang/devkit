import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Coins } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, CopyButton, Field, Notice, Select, Spinner, TextInput, ToolPage } from "../../lib/ui";
import { fetchRates, convertCurrency, commonCurrencies, type ExchangeRates } from "./logic";

const CURRENCIES = commonCurrencies();

function Currency() {
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<Map<string, ExchangeRates>>(() => new Map());
  /** After the first Convert, changing the base fetches its rates by itself. */
  const live = useRef(false);

  async function load(base: string) {
    if (rates.has(base)) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchRates(base);
      setRates((prev) => new Map(prev).set(base, r));
      live.current = true;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (live.current) void load(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  const value = parseFloat(amount.replace(/,/g, ""));
  const current = rates.get(from);
  const result = current && !Number.isNaN(value) ? convertCurrency(value, from, to, current) : null;
  const unit = current ? convertCurrency(1, from, to, current) : null;
  const fmt = (n: number, cur: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 4 }).format(n);

  return (
    <ToolPage scroll>
      <form
        className="flex flex-wrap items-end gap-3 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number.isNaN(value)) setError("Enter an amount, e.g. 100 or 12.5");
          else void load(from);
        }}
      >
        <Field label="Amount">
          <TextInput autoFocus mono inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" className="w-40 text-right" />
        </Field>
        <Field label="From">
          <Select value={from} onChange={(e) => setFrom(e.target.value)} className="w-28">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Button icon={ArrowLeftRight} label="Swap currencies" onClick={() => { setFrom(to); setTo(from); }} />
        <Field label="To">
          <Select value={to} onChange={(e) => setTo(e.target.value)} className="w-28">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        {!current && (
          <Button type="submit" variant="primary" disabled={loading} kbd={loading ? undefined : "↵"}>
            {loading && <Spinner />}
            {loading ? "Fetching rates…" : "Convert"}
          </Button>
        )}
        {current && loading && <Spinner />}
      </form>

      {error && <Notice>{error}</Notice>}

      {result !== null && unit !== null ? (
        <div className="rounded-xl border border-line bg-surface px-6 py-5 max-w-3xl shrink-0 dk-fade-in">
          <p className="text-base text-fg-muted tabular-nums">{fmt(value, from)} =</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-semibold text-fg tabular-nums selectable">{fmt(result, to)}</p>
            <CopyButton text={String(Number(result.toFixed(4)))} label="Copy amount" />
          </div>
          <p className="text-sm text-fg-faint mt-3 tabular-nums">
            1 {from} = {unit.toLocaleString(undefined, { maximumFractionDigits: 6 })} {to} · rates updated {current?.lastUpdated}
          </p>
        </div>
      ) : (
        !error && (
          <p className="text-base text-fg-faint flex items-center gap-2">
            <Coins size={15} aria-hidden />
            {current ? "Enter an amount." : "Press Convert to fetch today's rates (open.er-api.com). After that, results update as you type."}
          </p>
        )
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "currency",
  name: "Currency Convert",
  category: "Network",
  description: "Convert amounts with today's exchange rates",
  icon: Coins,
  keywords: ["currency", "convert", "exchange", "rate", "forex", "usd", "eur"],
  online: true,
  component: Currency,
};
