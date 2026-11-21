import { useDeferredValue, useMemo, useState } from "react";
import { Contrast, Palette } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Field, KeyValueList, Panel, TextInput, ToolPage, cx } from "../../lib/ui";
import {
  BLACK,
  WHITE,
  colorName,
  contrastRatio,
  parseColor,
  toHex,
  toHslString,
  toHwbString,
  toOklchString,
  toRgbString,
  wcag,
  type Rgba,
} from "./logic";

/** Checkerboard behind the swatch so transparency is visible; built from tokens. */
const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg, var(--surface-3) 25%, transparent 25%), linear-gradient(-45deg, var(--surface-3) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--surface-3) 75%), linear-gradient(-45deg, transparent 75%, var(--surface-3) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
} as const;

function Grade({ ok, children }: { ok: boolean; children: string }) {
  return (
    <Badge tone={ok ? "success" : "neutral"} className={ok ? undefined : "line-through opacity-70"}>
      {children}
    </Badge>
  );
}

function ContrastRow({ color, bg, label }: { color: Rgba; bg: Rgba; label: string }) {
  const ratio = contrastRatio(color, bg);
  const g = wcag(ratio);
  const css = toRgbString(color);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span
        aria-hidden
        className="grid place-items-center w-12 h-9 rounded-md border border-line text-md font-semibold shrink-0"
        style={{ background: bg === WHITE ? "#ffffff" : "#000000", color: css }}
      >
        Aa
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-fg-muted">{label}</div>
        <div className="font-mono text-md text-fg tabular-nums selectable">{ratio.toFixed(2)} : 1</div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <Grade ok={g.aaLarge}>AA large</Grade>
        <Grade ok={g.aa}>AA</Grade>
        <Grade ok={g.aaa}>AAA</Grade>
      </div>
    </div>
  );
}

function ColorConverter() {
  const [input, setInput] = useState("#f5a524");
  const deferred = useDeferredValue(input);
  const parsed = useMemo(() => parseColor(deferred), [deferred]);
  const color = parsed.ok ? parsed.color : null;
  const name = color ? colorName(color) : null;

  return (
    <ToolPage scroll>
      <div className="flex items-end gap-2 shrink-0 max-w-4xl">
        <Field
          label="Colour"
          className="flex-1"
          hint={
            !parsed.ok && input.trim() ? (
              <span className="text-danger">{parsed.error}</span>
            ) : (
              "Hex, rgb(), hsl(), hwb() or a CSS name"
            )
          }
        >
          <TextInput
            autoFocus
            mono
            aria-label="Colour value"
            value={input}
            placeholder="#f5a524"
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        <label className="flex flex-col gap-1.5 mb-[22px]">
          <span className="sr-only">Pick a colour</span>
          <input
            type="color"
            aria-label="Pick a colour"
            value={color ? toHex(color, false) : "#000000"}
            onChange={(e) => setInput(e.target.value)}
            className="h-8 w-11 rounded-md border border-line-strong bg-surface p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          />
        </label>
      </div>

      {color && (
        <div className="grid gap-3 max-w-4xl shrink-0 grid-cols-1 min-[820px]:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-line overflow-hidden h-40 min-[820px]:h-56 bg-surface" style={CHECKER}>
              <div className="w-full h-full" style={{ background: toRgbString(color) }} data-testid="swatch" />
            </div>
            <div className="text-center">
              <div className="font-mono text-md text-fg selectable">{toHex(color)}</div>
              {name && <div className="text-sm text-fg-faint">{name}</div>}
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <Panel title="Formats" icon={Palette}>
              <KeyValueList
                copy
                mono
                labelWidth="4.5rem"
                rows={[
                  { label: "HEX", value: toHex(color, false) },
                  ...(color.a < 1 ? [{ label: "HEX8", value: toHex(color, true) }] : []),
                  { label: "RGB", value: toRgbString(color) },
                  { label: "HSL", value: toHslString(color) },
                  { label: "HWB", value: toHwbString(color) },
                  { label: "OKLCH", value: toOklchString(color) },
                  ...(name ? [{ label: "Name", value: name }] : []),
                ]}
              />
            </Panel>
            <Panel title="Contrast" icon={Contrast} meta="WCAG 2">
              <div className={cx("divide-y divide-line")}>
                <ContrastRow color={color} bg={WHITE} label="On white" />
                <ContrastRow color={color} bg={BLACK} label="On black" />
              </div>
            </Panel>
          </div>
        </div>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "color-converter",
  name: "Color Converter",
  category: "Design",
  description: "HEX, RGB, HSL, HWB and OKLCH, with WCAG contrast",
  icon: Palette,
  keywords: ["color", "colour", "hex", "rgb", "hsl", "hwb", "oklch", "contrast", "wcag", "picker"],
  component: ColorConverter,
};
