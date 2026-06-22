import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { epochToIso, isoToEpoch } from "./logic";

function Timestamp() {
  const [epoch, setEpoch] = useState("");
  const [iso, setIso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inp = "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-sm w-full";
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";

  return (
    <ToolLayout title="Timestamp Converter">
      <ErrorBanner message={error} />
      <div className="flex flex-col gap-2 max-w-xl">
        <label className="text-xs text-zinc-500">Unix epoch (seconds)</label>
        <input className={inp} value={epoch} onChange={(e) => setEpoch(e.target.value)} placeholder="0" />
        <button className={btn} onClick={() => {
          const r = epochToIso(Number(epoch));
          if (r.ok) { setIso(r.value); setError(null); } else setError(r.error);
        }}>Epoch → ISO ↓</button>
        <label className="text-xs text-zinc-500">ISO 8601 (UTC)</label>
        <input className={inp} value={iso} onChange={(e) => setIso(e.target.value)} placeholder="1970-01-01T00:00:00.000Z" />
        <button className={btn} onClick={() => {
          const r = isoToEpoch(iso);
          if (r.ok) { setEpoch(String(r.value)); setError(null); } else setError(r.error);
        }}>ISO → Epoch ↑</button>
      </div>
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "timestamp",
  name: "Timestamp Converter",
  category: "Converters",
  keywords: ["timestamp", "epoch", "unix", "date", "iso"],
  component: Timestamp,
};
