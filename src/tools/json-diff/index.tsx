import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { ClearButton } from "../../lib/Toolbar";
import { diffJson, type Result } from "./logic";

function JsonDiff() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<Result>({ ok: true, changes: [] });

  const color = { CREATE: "text-green-600", REMOVE: "text-red-600", CHANGE: "text-amber-600" } as const;
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";

  return (
    <ToolLayout title="JSON Diff">
      <div className="flex gap-2">
        <button className={btn} onClick={() => setResult(diffJson(a, b))}>Compare</button>
        <ClearButton onClick={() => { setA(""); setB(""); setResult({ ok: true, changes: [] }); }} />
      </div>
      {!result.ok && <ErrorBanner message={result.error} />}
      <div className="flex gap-4 min-h-0">
        <TextPane label="Left" value={a} onChange={setA} />
        <TextPane label="Right" value={b} onChange={setB} />
      </div>
      <div className="flex-1 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 p-3 font-mono text-sm">
        {result.ok && result.changes.length === 0 && <span className="text-zinc-400">No differences</span>}
        {result.ok && result.changes.map((c, i) => (
          <div key={i} className={color[c.type]}>
            {c.type} {c.path}: {JSON.stringify(c.oldValue)} → {JSON.stringify(c.value)}
          </div>
        ))}
      </div>
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "json-diff",
  name: "JSON Diff",
  category: "Diff",
  keywords: ["json", "diff", "compare", "changes"],
  component: JsonDiff,
};
