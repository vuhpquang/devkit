import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { CopyButton } from "../../lib/Toolbar";
import { generateUuids } from "./logic";

function Uuid() {
  const [count, setCount] = useState(1);
  const [out, setOut] = useState("");
  const inp = "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-24";
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";
  return (
    <ToolLayout title="UUID Generator">
      <div className="flex gap-2 items-center">
        <input type="number" min={1} className={inp} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        <button className={btn} onClick={() => setOut(generateUuids(count).join("\n"))}>Generate</button>
        <CopyButton text={out} />
      </div>
      <TextPane label="UUIDs (v4)" value={out} readOnly />
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "uuid",
  name: "UUID Generator",
  category: "Generators",
  keywords: ["uuid", "guid", "v4", "id", "random"],
  component: Uuid,
};
