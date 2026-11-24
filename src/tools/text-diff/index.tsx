import { useDeferredValue, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { ArrowLeftRight, Diff, Eraser, FileText, FolderOpen, GitCompareArrows } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EditorPane, EmptyState, Notice, Panel, Split, ToolBar, ToolPage, cx } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { diffText, toDiffRows, type DiffRow } from "./logic";

async function pickFile(): Promise<string | null> {
  const path = await open({ multiple: false, directory: false });
  return typeof path === "string" ? readTextFile(path) : null;
}

const ROW: Record<DiffRow["kind"], string> = {
  same: "",
  add: "bg-diff-add",
  del: "bg-diff-del",
};
const SIGN: Record<DiffRow["kind"], string> = { same: " ", add: "+", del: "−" };

function DiffView({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="h-full overflow-auto font-mono text-[12.5px] leading-[1.65] selectable">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={ROW[r.kind]}>
              <td className="w-10 pl-3 pr-1 text-right text-fg-faint tabular-nums select-none align-top">{r.left ?? ""}</td>
              <td className="w-10 px-1 text-right text-fg-faint tabular-nums select-none align-top">{r.right ?? ""}</td>
              <td
                className={cx(
                  "w-6 text-center select-none align-top font-semibold",
                  r.kind === "add" && "text-success bg-diff-add-strong",
                  r.kind === "del" && "text-danger bg-diff-del-strong",
                )}
              >
                {SIGN[r.kind]}
              </td>
              <td className="pl-3 pr-4 whitespace-pre-wrap break-all text-fg">{r.text || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SAMPLE_A = "server:\n  port: 8080\n  host: localhost\nlogging: info\nfeatures:\n  - search\n  - export\n";
const SAMPLE_B = "server:\n  port: 9090\n  host: localhost\nlogging: debug\nfeatures:\n  - search\n  - export\n  - share\n";

function TextDiff() {
  const [a, setA] = useSaved("original", "");
  const [b, setB] = useSaved("modified", "");
  const [error, setError] = useState<string | null>(null);
  const da = useDeferredValue(a);
  const db = useDeferredValue(b);
  const { rows, added, removed } = useMemo(() => toDiffRows(diffText(da, db)), [da, db]);
  const empty = !a && !b;
  const identical = !empty && added === 0 && removed === 0;

  const openInto = (set: (v: string) => void) => async () => {
    try {
      setError(null);
      const text = await pickFile();
      if (text !== null) set(text);
    } catch (e) {
      setError(`Couldn't open the file: ${(e as Error).message ?? e}`);
    }
  };

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={FileText} onClick={() => { setA(SAMPLE_A); setB(SAMPLE_B); }}>
              Sample
            </Button>
            <Button size="sm" variant="ghost" icon={Eraser} disabled={empty} onClick={() => { setA(""); setB(""); }}>
              Clear both
            </Button>
          </>
        }
      >
        <Button icon={ArrowLeftRight} disabled={empty} onClick={() => { setA(b); setB(a); }}>
          Swap sides
        </Button>
        {!empty && (
          <span className="flex items-center gap-1.5 ml-1">
            <Badge tone="success">+{added}</Badge>
            <Badge tone="danger">−{removed}</Badge>
          </span>
        )}
      </ToolBar>
      {error && <Notice>{error}</Notice>}
      <Split className="max-h-[45%]">
        <EditorPane
          title="Original"
          value={a}
          onChange={setA}
          autoFocus
          actions={<Button size="sm" variant="ghost" icon={FolderOpen} label="Open file…" onClick={openInto(setA)} />}
        />
        <EditorPane
          title="Modified"
          value={b}
          onChange={setB}
          actions={<Button size="sm" variant="ghost" icon={FolderOpen} label="Open file…" onClick={openInto(setB)} />}
        />
      </Split>
      <Panel title="Changes" icon={Diff} className="flex-1" meta={identical ? "Identical" : undefined}>
        {empty ? (
          <EmptyState icon={GitCompareArrows} title="Compare two texts">
            Paste or open a file on each side. Differences show here line by line as you type.
          </EmptyState>
        ) : (
          <DiffView rows={rows} />
        )}
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "text-diff",
  name: "Text / File Diff",
  category: "Diff",
  description: "Line-by-line differences between two texts or files",
  icon: Diff,
  keywords: ["text", "file", "diff", "compare"],
  component: TextDiff,
};
