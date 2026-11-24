import { useState } from "react";
import { Globe, Server } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, CopyButton, EmptyState, LookupBar, Notice, Panel, Toggle, ToolPage } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { dnsLookup, defaultTypes, type DnsRecordType, type DnsRecord } from "./logic";

const ALL_TYPES: DnsRecordType[] = ["A", "AAAA", "MX", "TXT", "CNAME"];

function DnsLookup() {
  const [domain, setDomain] = useSaved("domain", "");
  const [selectedTypes, setSelectedTypes] = useSaved<DnsRecordType[]>("types", defaultTypes, {
    valid: (v) => Array.isArray(v) && v.every((t) => ALL_TYPES.includes(t as DnsRecordType)),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<DnsRecord[] | null>(null);

  function toggleType(type: DnsRecordType) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleLookup() {
    setError(null);
    setRecords(null);
    setLoading(true);
    try {
      setRecords((await dnsLookup(domain, selectedTypes)).records);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const grouped = ALL_TYPES.map((type) => ({ type, rows: (records ?? []).filter((r) => r.type === type) })).filter(
    (g) => g.rows.length > 0,
  );

  return (
    <ToolPage scroll>
      <LookupBar
        icon={Globe}
        ariaLabel="Domain"
        value={domain}
        onChange={setDomain}
        onSubmit={handleLookup}
        loading={loading}
        canSubmit={!!domain.trim() && selectedTypes.length > 0}
        placeholder="example.com"
      >
        <div role="group" aria-label="Record types" className="flex items-center gap-1">
          {ALL_TYPES.map((type) => {
            const on = selectedTypes.includes(type);
            return (
              <Toggle key={type} mono on={on} onToggle={() => toggleType(type)}>
                {type}
              </Toggle>
            );
          })}
        </div>
      </LookupBar>
      {error && <Notice>{error}</Notice>}
      {records === null && !error && (
        <EmptyState icon={Server} title={loading ? "Querying Cloudflare DNS…" : "Look up DNS records"} className="flex-1">
          {!loading && "Pick record types, enter a domain and press Enter. Queries go over HTTPS to 1.1.1.1."}
        </EmptyState>
      )}
      {records !== null && records.length === 0 && (
        <EmptyState icon={Server} title="No records found" className="flex-1">
          {domain} has none of the selected record types.
        </EmptyState>
      )}
      {grouped.map(({ type, rows }) => (
        <Panel key={type} title={type} meta={`${rows.length} ${rows.length === 1 ? "record" : "records"}`} className="shrink-0">
          <table className="w-full text-base">
            <thead>
              <tr className="text-left text-sm text-fg-faint border-b border-line">
                <th className="font-medium px-3 py-1.5 w-[32%]">Name</th>
                <th className="font-medium px-3 py-1.5 w-20 text-right">TTL</th>
                <th className="font-medium px-3 py-1.5">Data</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((rec, i) => (
                <tr key={i} className="group">
                  <td className="px-3 py-2 font-mono text-[12.5px] text-fg-muted break-all align-top selectable">{rec.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-faint align-top">
                    <Badge>{rec.ttl}s</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-[12.5px] text-fg break-all align-top selectable">{rec.data}</td>
                  <td className="pr-1.5 align-top opacity-60 group-hover:opacity-100">
                    <CopyButton text={rec.data} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "dns-lookup",
  name: "DNS Lookup",
  category: "Network",
  description: "A, AAAA, MX, TXT and CNAME records over DNS-over-HTTPS",
  icon: Server,
  keywords: ["dns", "lookup", "a", "aaaa", "mx", "txt", "cname", "nameserver"],
  online: true,
  component: DnsLookup,
};
