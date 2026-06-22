import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { CopyButton, PasteButton, ClearButton } from "../../lib/Toolbar";
import { jsonToYaml, yamlToJson, type Result } from "./logic";

function JsonYaml() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ ok: true, value: "" });
  const out = result.ok ? result.value : "";
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";
  return (
    <ToolLayout title="JSON ↔ YAML">
      <div className="flex gap-2">
        <button className={btn} onClick={() => setResult(jsonToYaml(input))}>JSON → YAML</button>
        <button className={btn} onClick={() => setResult(yamlToJson(input))}>YAML → JSON</button>
        <PasteButton onPaste={setInput} />
        <ClearButton onClick={() => { setInput(""); setResult({ ok: true, value: "" }); }} />
        <CopyButton text={out} />
      </div>
      {!result.ok && <ErrorBanner message={result.error} />}
      <div className="flex gap-4 flex-1 min-h-0">
        <TextPane label="Input" value={input} onChange={setInput} />
        <TextPane label="Output" value={out} readOnly />
      </div>
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "json-yaml",
  name: "JSON ↔ YAML",
  category: "Converters",
  keywords: ["json", "yaml", "convert"],
  component: JsonYaml,
};
