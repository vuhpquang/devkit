import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeftRight, Eraser, FileText, GitCompareArrows, ListTree } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EditorPane, EmptyState, Notice, Panel, Split, ToolBar, ToolPage } from "../../lib/ui";
import { diffJson, type DiffLine } from "./logic";

const LABEL: Record<DiffLine["type"], { text: string; tone: "success" | "danger" | "accent" }> = {
  CREATE: { text: "Added", tone: "success" },
  REMOVE: { text: "Removed", tone: "danger" },
  CHANGE: { text: "Changed", tone: "accent" },
};

function show(v: unknown): string {
  const s = JSON.stringify(v);
  return s === undefined ? "undefined" : s.length > 160 ? s.slice(0, 157) + "…" : s;
}

/** Says which side fails to parse, so the error points at the right pane. */
function parseError(a: string, b: string): string | null {
  for (const [side, text] of [["Original", a], ["Modified", b]] as const) {
    try {
      JSON.parse(text);
    } catch (e) {
      return `${side}: ${(e as Error).message}`;
    }
  }
  return null;
}

const SAMPLE_A = `{\n  "name": "devkit",\n  "version": "0.2.0",\n  "features": ["format", "diff"],\n  "settings": { "theme": "system", "fontSize": 13 }\n}`;
const SAMPLE_B = `{\n  "name": "devkit",\n  "version": "0.3.0",\n  "features": ["format", "diff", "palette"],\n  "settings": { "theme": "dark" }\n}`;

function JsonDiff() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const da = useDeferredValue(a);
  const db = useDeferredValue(b);
  const ready = da.trim() !== "" && db.trim() !== "";
  const result = useMemo(() => (ready ? diffJson(da, db) : null), [ready, da, db]);
  const error = result && !result.ok ? parseError(da, db) ?? result.error : null;
  const changes = result?.ok ? result.changes : [];
  const count = (t: DiffLine["type"]) => changes.filter((c) => c.type === t).length;

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={FileText} onClick={() => { setA(SAMPLE_A); setB(SAMPLE_B); }}>
              Sample
            </Button>
            <Button size="sm" variant="ghost" icon={Eraser} disabled={!a && !b} onClick={() => { setA(""); setB(""); }}>
              Clear both
            </Button>
          </>
        }
      >
        <Button icon={ArrowLeftRight} disabled={!a && !b} onClick={() => { setA(b); setB(a); }}>
          Swap sides
        </Button>
        {result?.ok && (
          <span className="flex items-center gap-1.5 ml-1">
            <Badge tone="success">{count("CREATE")} added</Badge>
            <Badge tone="danger">{count("REMOVE")} removed</Badge>
            <Badge tone="accent">{count("CHANGE")} changed</Badge>
          </span>
        )}
      </ToolBar>
      <Split>
        <EditorPane title="Original" value={a} onChange={setA} lang="json" placeholder='{"a": 1}' autoFocus />
        <EditorPane title="Modified" value={b} onChange={setB} lang="json" placeholder='{"a": 2}' />
      </Split>
      {error && <Notice>{error}</Notice>}
      <Panel title="Differences" icon={ListTree} className="flex-1" bodyClassName="overflow-auto">
        {!ready ? (
          <EmptyState icon={GitCompareArrows} title="Compare two JSON documents">
            Paste JSON on both sides. Added, removed and changed keys are listed here by path.
          </EmptyState>
        ) : result?.ok && changes.length === 0 ? (
          <EmptyState icon={GitCompareArrows} title="No differences">
            Both documents hold the same data.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {changes.map((c, i) => (
              <li key={i} className="flex items-start gap-3 px-3 py-2">
                <Badge tone={LABEL[c.type].tone} className="w-[68px] justify-center mt-[1px]">
                  {LABEL[c.type].text}
                </Badge>
                <code className="font-mono text-[12.5px] text-fg font-medium shrink-0 selectable">{c.path || "(root)"}</code>
                <span className="font-mono text-[12.5px] min-w-0 break-all selectable">
                  {c.type !== "CREATE" && <span className="text-danger line-through decoration-danger/50">{show(c.oldValue)}</span>}
                  {c.type === "CHANGE" && <span className="text-fg-faint mx-1.5">→</span>}
                  {c.type !== "REMOVE" && <span className="text-success">{show(c.value)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "json-diff",
  name: "JSON Diff",
  category: "Diff",
  description: "Structural differences between two JSON documents",
  icon: GitCompareArrows,
  keywords: ["json", "diff", "compare", "changes"],
  component: JsonDiff,
};
