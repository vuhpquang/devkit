import { useEffect, useState } from "react";
import { Pilcrow, RefreshCw } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, EditorPane, TextInput, ToolBar, ToolPage } from "../../lib/ui";
import { generateLorem } from "./logic";

function Lorem() {
  const [count, setCount] = useState("3");
  const n = Math.min(100, Math.max(1, Math.floor(Number(count)) || 1));
  const [out, setOut] = useState("");
  useEffect(() => setOut(generateLorem(n)), [n]);

  return (
    <ToolPage>
      <ToolBar>
        <span className="text-base text-fg-muted">Paragraphs</span>
        <TextInput
          aria-label="Paragraphs"
          type="number"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-20 text-right tabular-nums"
        />
        <Button variant="primary" icon={RefreshCw} onClick={() => setOut(generateLorem(n))}>
          Regenerate
        </Button>
      </ToolBar>
      <EditorPane title="Text" value={out} readOnly wrap lineNumbers={false} className="flex-1" />
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "lorem",
  name: "Lorem Ipsum",
  category: "Generators",
  description: "Placeholder paragraphs for mock-ups and layouts",
  icon: Pilcrow,
  keywords: ["lorem", "ipsum", "placeholder", "text", "dummy"],
  component: Lorem,
};
