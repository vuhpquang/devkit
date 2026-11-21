import { useState } from "react";
import { Globe, Landmark } from "lucide-react";
import type { ToolDef } from "../types";
import { CopyButton, EmptyState, LookupBar, Notice, Panel, ToolPage } from "../../lib/ui";
import { whoisLookup } from "./logic";

function Whois() {
  const [domain, setDomain] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setError(null);
    setOutput("");
    setLoading(true);
    try {
      setOutput(await whoisLookup(domain));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ToolPage>
      <LookupBar
        icon={Globe}
        ariaLabel="Domain"
        value={domain}
        onChange={setDomain}
        onSubmit={handleLookup}
        loading={loading}
        canSubmit={!!domain.trim()}
        placeholder="example.com"
      />
      {error && <Notice>{error}</Notice>}
      <Panel title="WHOIS record" className="flex-1" bodyClassName="overflow-auto" actions={<CopyButton text={output} />}>
        {output ? (
          <pre className="p-4 font-mono text-[12.5px] leading-[1.65] whitespace-pre-wrap break-all text-fg selectable">{output}</pre>
        ) : (
          <EmptyState icon={Landmark} title={loading ? "Asking the registry…" : "Who owns a domain?"}>
            {loading ? "IANA first, then the registrar it points to." : "Enter a domain to see its registrar, dates and name servers."}
          </EmptyState>
        )}
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "whois",
  name: "WHOIS",
  category: "Network",
  description: "Registrar, dates and name servers of a domain",
  icon: Landmark,
  keywords: ["whois", "domain", "registrar", "registration", "dns", "expiry"],
  online: true,
  component: Whois,
};
