import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { CopyButton } from "../../lib/Toolbar";
import { generateLorem } from "./logic";

function Lorem() {
  const [count, setCount] = useState(3);
  const [out, setOut] = useState("");
  const inp = "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm w-24";
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";
  return (
    <ToolLayout title="Lorem Ipsum Generator">
      <div className="flex gap-2 items-center">
        <input type="number" min={1} className={inp} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        <span className="text-sm text-zinc-500">paragraphs</span>
        <button className={btn} onClick={() => setOut(generateLorem(count))}>Generate</button>
        <CopyButton text={out} />
      </div>
      <TextPane label="Output" value={out} readOnly />
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "lorem",
  name: "Lorem Ipsum",
  category: "Generators",
  keywords: ["lorem", "ipsum", "placeholder", "text", "dummy"],
  component: Lorem,
};
