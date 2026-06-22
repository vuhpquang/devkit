import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { ipLookup, type IpInfo as IpInfoData } from "./logic";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="w-32 shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-medium break-all">{value}</span>
    </div>
  );
}

function IpInfo() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IpInfoData | null>(null);

  const btn =
    "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed";

  async function handleLookup() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const info = await ipLookup(input);
      setResult(info);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading) {
      handleLookup();
    }
  }

  return (
    <ToolLayout title="IP Info">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="IP address or leave blank for your IP"
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <button
          className={btn}
          onClick={handleLookup}
          disabled={loading}
        >
          {loading ? "Looking up..." : "Lookup"}
        </button>
      </div>

      <ErrorBanner message={error} />

      {!result && !error && !loading && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Leave blank to look up your own IP
        </p>
      )}

      {result && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-700 px-4 py-2">
          <InfoRow label="IP" value={result.ip} />
          <InfoRow
            label="Country"
            value={`${result.country} (${result.countryCode})`}
          />
          <InfoRow label="Region" value={result.region} />
          <InfoRow label="City" value={result.city} />
          <InfoRow label="Lat / Lon" value={`${result.lat}, ${result.lon}`} />
          <InfoRow label="ISP" value={result.isp} />
          <InfoRow label="Organization" value={result.org} />
          <InfoRow label="ASN" value={result.as} />
          <InfoRow label="Timezone" value={result.timezone} />
        </div>
      )}
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "ip-info",
  name: "IP Info",
  category: "Network",
  keywords: ["ip", "geolocation", "asn", "org", "isp", "whois", "geo"],
  online: true,
  component: IpInfo,
};
