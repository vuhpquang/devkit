import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { whoisLookup } from "./logic";

function Whois() {
  const [domain, setDomain] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btn =
    "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed";

  async function handleLookup() {
    setError(null);
    setOutput("");
    setLoading(true);
    try {
      const result = await whoisLookup(domain);
      setOutput(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleLookup();
    }
  }

  return (
    <ToolLayout title="WHOIS">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="example.com"
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          className={btn}
          onClick={handleLookup}
          disabled={loading || !domain.trim()}
        >
          {loading ? "Looking up…" : "Lookup"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {!error && !output && !loading && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Enter a domain name and click Lookup to retrieve WHOIS information.
        </p>
      )}

      {output && (
        <div className="flex-1 min-h-0 overflow-y-auto max-h-[60vh] rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-3">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200">
            {output}
          </pre>
        </div>
      )}
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "whois",
  name: "WHOIS",
  category: "Network",
  keywords: ["whois", "domain", "registrar", "registration", "dns", "expiry"],
  online: true,
  component: Whois,
};
