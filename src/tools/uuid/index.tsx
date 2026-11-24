import { useCallback, useEffect, useMemo, useState } from "react";
import { Dices, RefreshCw } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, EditorPane, Segmented, TextInput, ToolBar, ToolBarDivider, ToolPage } from "../../lib/ui";
import { generateUuids } from "./logic";
import { useSaved } from "../../lib/saved";

const MAX = 1000;

function Uuid() {
  const [count, setCount] = useSaved("count", "5");
  const [ids, setIds] = useState<string[]>([]);
  const [letterCase, setCase] = useSaved<"lower" | "upper">("case", "lower", { valid: (v) => v === "lower" || v === "upper" });
  const [hyphens, setHyphens] = useSaved<"with" | "without">("hyphens", "with", { valid: (v) => v === "with" || v === "without" });
  const n = Math.min(MAX, Math.max(1, Math.floor(Number(count)) || 1));

  const generate = useCallback(() => setIds(generateUuids(n)), [n]);
  useEffect(() => {
    // First list uses the saved count.
    setIds(generateUuids(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const out = useMemo(
    () =>
      ids
        .map((id) => (hyphens === "without" ? id.replace(/-/g, "") : id))
        .map((id) => (letterCase === "upper" ? id.toUpperCase() : id))
        .join("\n"),
    [ids, hyphens, letterCase],
  );

  return (
    <ToolPage>
      <ToolBar>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <span className="text-base text-fg-muted">Count</span>
          <TextInput
            aria-label="How many UUIDs"
            type="number"
            min={1}
            max={MAX}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-20 text-right tabular-nums"
          />
          <Button type="submit" variant="primary" icon={RefreshCw} kbd="↵">
            Generate
          </Button>
        </form>
        <ToolBarDivider />
        <Segmented label="Letter case" size="sm" value={letterCase} onChange={setCase} options={[{ value: "lower", label: "abc" }, { value: "upper", label: "ABC" }]} />
        <Segmented label="Hyphens" size="sm" value={hyphens} onChange={setHyphens} options={[{ value: "with", label: "With hyphens" }, { value: "without", label: "No hyphens" }]} />
      </ToolBar>
      <EditorPane title={`UUID v4 · ${ids.length}`} value={out} readOnly className="flex-1" />
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "uuid",
  name: "UUID Generator",
  category: "Generators",
  description: "Random version 4 UUIDs, one or a thousand at a time",
  icon: Dices,
  keywords: ["uuid", "guid", "v4", "id", "random"],
  component: Uuid,
};
