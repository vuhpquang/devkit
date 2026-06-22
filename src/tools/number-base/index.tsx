import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { convertBase, type Result } from "./logic";

function NumberBase() {
  const [value, setValue] = useState("");
  const [base, setBase] = useState<2 | 8 | 10 | 16>(10);
  const [result, setResult] = useState<Result>({ ok: true, bin: "", oct: "", dec: "", hex: "" });
  const inp = "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-sm";

  return (
    <ToolLayout title="Number Base Converter">
      <div className="flex gap-2 items-center">
        <input className={inp} value={value} onChange={(e) => setValue(e.target.value)} placeholder="255" />
        <select className={inp} value={base} onChange={(e) => setBase(Number(e.target.value) as 2 | 8 | 10 | 16)}>
          <option value={2}>Binary</option>
          <option value={8}>Octal</option>
          <option value={10}>Decimal</option>
          <option value={16}>Hex</option>
        </select>
        <button className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700" onClick={() => setResult(convertBase(value, base))}>Convert</button>
      </div>
      {!result.ok && <ErrorBanner message={result.error} />}
      {result.ok && (
        <div className="font-mono text-sm grid grid-cols-[5rem_1fr] gap-1 max-w-md">
          <span className="text-zinc-500">Binary</span><span>{result.bin}</span>
          <span className="text-zinc-500">Octal</span><span>{result.oct}</span>
          <span className="text-zinc-500">Decimal</span><span>{result.dec}</span>
          <span className="text-zinc-500">Hex</span><span>{result.hex}</span>
        </div>
      )}
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "number-base",
  name: "Number Base",
  category: "Converters",
  keywords: ["number", "base", "binary", "hex", "octal", "decimal", "radix"],
  component: NumberBase,
};
