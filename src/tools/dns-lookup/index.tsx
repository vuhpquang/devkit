import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { dnsLookup, defaultTypes, type DnsRecordType, type DnsRecord } from "./logic";

const ALL_TYPES: DnsRecordType[] = ["A", "AAAA", "MX", "TXT", "CNAME"];

function DnsLookup() {
  const [domain, setDomain] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<DnsRecordType[]>(defaultTypes());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<DnsRecord[] | null>(null);

  const primaryBtn =
    "px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";

  function toggleType(type: DnsRecordType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleLookup() {
    setError(null);
    setRecords(null);
    setLoading(true);
    try {
      const result = await dnsLookup(domain, selectedTypes);
      setRecords(result.records);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading && selectedTypes.length > 0) {
      handleLookup();
    }
  }

  // Group records by type for display
  const grouped: Partial<Record<DnsRecordType, DnsRecord[]>> = {};
  if (records) {
    for (const record of records) {
      if (!grouped[record.type]) grouped[record.type] = [];
      grouped[record.type]!.push(record);
    }
  }

  const hasRecords = records !== null && records.length > 0;
  const isEmpty = records !== null && records.length === 0;

  return (
    <ToolLayout title="DNS Lookup">
      {/* Domain input row */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className={primaryBtn}
          onClick={handleLookup}
          disabled={loading || selectedTypes.length === 0}
        >
          {loading ? "Looking up…" : "Lookup"}
        </button>
      </div>

      {/* Record type checkboxes */}
      <div className="flex gap-3 flex-wrap">
        {ALL_TYPES.map((type) => (
          <label
            key={type}
            className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => toggleType(type)}
              disabled={loading}
              className="accent-blue-600"
            />
            {type}
          </label>
        ))}
      </div>

      {/* Error */}
      <ErrorBanner message={error} />

      {/* Empty state */}
      {isEmpty && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No records found.</p>
      )}

      {/* Results grouped by type */}
      {hasRecords && (
        <div className="flex flex-col gap-4">
          {ALL_TYPES.filter((t) => grouped[t]?.length).map((type) => (
            <div key={type}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                {type}
              </h2>
              <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300 w-1/3">Name</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300 w-16">TTL</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {grouped[type]!.map((rec, i) => (
                      <tr key={i} className="bg-white dark:bg-zinc-900">
                        <td className="px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{rec.name}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{rec.ttl}</td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{rec.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "dns-lookup",
  name: "DNS Lookup",
  category: "Network",
  keywords: ["dns", "lookup", "a", "aaaa", "mx", "txt", "cname", "nameserver"],
  online: true,
  component: DnsLookup,
};
