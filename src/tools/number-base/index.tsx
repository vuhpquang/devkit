import { Hash } from "lucide-react";
import type { ToolDef } from "../types";
import { CopyButton, Panel, ToolPage, cx } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { convertBase, type Base } from "./logic";

const FIELDS: { base: Base; label: string; key: "bin" | "oct" | "dec" | "hex"; placeholder: string }[] = [
  { base: 10, label: "Decimal", key: "dec", placeholder: "255" },
  { base: 16, label: "Hexadecimal", key: "hex", placeholder: "ff" },
  { base: 2, label: "Binary", key: "bin", placeholder: "11111111" },
  { base: 8, label: "Octal", key: "oct", placeholder: "377" },
];

/** Groups digits for reading: 4 for binary/hex, 3 for decimal/octal. */
function group(s: string, base: Base): string {
  const size = base === 2 || base === 16 ? 4 : 3;
  const sep = base === 10 ? "," : " ";
  return s.replace(new RegExp(`\\B(?=(.{${size}})+$)`, "g"), sep);
}

/** The field typed in last and its text, as stored. */
const isStoredSource = (v: unknown): boolean => {
  const s = v as { base?: unknown; value?: unknown } | null;
  return !!s && typeof s === "object" && [2, 8, 10, 16].includes(s.base as number) && typeof s.value === "string";
};

function NumberBase() {
  const [src, setSrc] = useSaved<{ base: Base; value: string }>("source", { base: 10, value: "" }, { valid: isStoredSource });
  const result = src.value.trim() ? convertBase(src.value, src.base) : null;

  return (
    <ToolPage scroll>
      <p className="text-base text-fg-muted shrink-0">Type in any field — the others follow. Any size, spaces and 0x / 0b prefixes are fine.</p>
      <Panel className="shrink-0 max-w-3xl">
        <div className="divide-y divide-line">
          {FIELDS.map((f) => {
            const isSrc = f.base === src.base;
            const value = isSrc ? src.value : result?.ok ? result[f.key] : "";
            const err = isSrc && result && !result.ok ? result.error : null;
            return (
              <div key={f.base} className="px-4 py-3 grid grid-cols-[9.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                  <label htmlFor={`nb-${f.base}`} className="text-base font-medium text-fg-muted whitespace-nowrap">
                    {f.label}
                    <span className="ml-1.5 text-sm text-fg-faint font-normal">base {f.base}</span>
                  </label>
                  <input
                    id={`nb-${f.base}`}
                    value={value}
                    placeholder={f.placeholder}
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus={f.base === 10}
                    onChange={(e) => setSrc({ base: f.base, value: e.target.value })}
                    className={cx(
                      "flex-1 min-w-0 h-9 rounded-md border bg-surface px-3 font-mono text-md text-fg placeholder:text-fg-faint outline-none",
                      "focus:ring-3 focus:ring-accent-ring/60",
                      err ? "border-danger focus:border-danger" : "border-line-strong focus:border-accent",
                    )}
                  />
                  <CopyButton text={value} />
                {err ? (
                  <p role="alert" className="col-start-2 text-sm text-danger">{err}</p>
                ) : (
                  value && (
                    <p className="col-start-2 font-mono text-sm text-fg-faint break-all selectable">{group(value, f.base)}</p>
                  )
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "number-base",
  name: "Number Base",
  category: "Converters",
  description: "Convert integers between decimal, hex, binary and octal",
  icon: Hash,
  keywords: ["number", "base", "binary", "hex", "octal", "decimal", "radix"],
  component: NumberBase,
};
