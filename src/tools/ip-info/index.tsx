import { useState } from "react";
import { MapPin, Network } from "lucide-react";
import type { ToolDef } from "../types";
import { EmptyState, KeyValueList, LookupBar, Notice, Panel, ToolPage } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { ipLookup, type IpInfo as IpInfoData } from "./logic";

function IpInfo() {
  const [input, setInput] = useSaved("ip", "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IpInfoData | null>(null);

  async function handleLookup() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await ipLookup(input));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ToolPage scroll>
      <LookupBar
        icon={Network}
        ariaLabel="IP address"
        value={input}
        onChange={setInput}
        onSubmit={handleLookup}
        loading={loading}
        placeholder="8.8.8.8 — leave empty for your own IP"
        action={input.trim() ? "Look up" : "Look up my IP"}
      />
      {error && <Notice>{error}</Notice>}
      {result ? (
        <Panel title={result.ip} icon={MapPin} meta={[result.city, result.country].filter(Boolean).join(", ")} className="shrink-0 max-w-3xl">
          <KeyValueList
            copy
            rows={[
              { label: "IP", value: result.ip, mono: true },
              { label: "Country", value: `${result.country} (${result.countryCode})` },
              { label: "Region", value: result.region },
              { label: "City", value: result.city },
              { label: "Coordinates", value: `${result.lat}, ${result.lon}`, mono: true },
              { label: "Time zone", value: result.timezone },
              { label: "ISP", value: result.isp },
              { label: "Organization", value: result.org },
              { label: "AS", value: result.as, mono: true },
            ]}
          />
        </Panel>
      ) : (
        !error && (
          <EmptyState icon={MapPin} title={loading ? "Looking up…" : "Where is an IP address?"} className="flex-1">
            {!loading && "Location, network and owner of any public IPv4 or IPv6 address, via ip-api.com."}
          </EmptyState>
        )
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "ip-info",
  name: "IP Info",
  category: "Network",
  description: "Location, ISP and AS of an IP address",
  icon: MapPin,
  keywords: ["ip", "geolocation", "asn", "org", "isp", "whois", "geo"],
  online: true,
  component: IpInfo,
};
