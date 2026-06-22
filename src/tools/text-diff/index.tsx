import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { ClearButton } from "../../lib/Toolbar";
import { diffText, type DiffPart } from "./logic";

async function openInto(setter: (v: string) => void) {
  const path = await open({ multiple: false, directory: false });
  if (typeof path === "string") setter(await readTextFile(path));
}

function partClass(p: DiffPart) {
  if (p.added) return "bg-green-100 dark:bg-green-900/40";
  if (p.removed) return "bg-red-100 dark:bg-red-900/40";
  return "";
}

function TextDiff() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [parts, setParts] = useState<DiffPart[]>([]);
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";

  return (
    <ToolLayout title="Text / File Diff">
      <div className="flex gap-2 flex-wrap">
        <button className={btn} onClick={() => setParts(diffText(a, b))}>Compare</button>
        <button className={btn} onClick={() => openInto(setA)}>Open file → Left</button>
        <button className={btn} onClick={() => openInto(setB)}>Open file → Right</button>
        <ClearButton onClick={() => { setA(""); setB(""); setParts([]); }} />
      </div>
      <div className="flex gap-4 min-h-0">
        <TextPane label="Left" value={a} onChange={setA} />
        <TextPane label="Right" value={b} onChange={setB} />
      </div>
      <pre className="flex-1 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800 p-3 font-mono text-sm whitespace-pre-wrap">
        {parts.map((p, i) => (
          <span key={i} className={partClass(p)}>{p.value}</span>
        ))}
      </pre>
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "text-diff",
  name: "Text / File Diff",
  category: "Diff",
  keywords: ["text", "file", "diff", "compare"],
  component: TextDiff,
};
