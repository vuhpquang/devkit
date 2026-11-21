import { optimize } from "svgo/browser";
import { byteSize } from "./logic";

export interface Optimized {
  svg: string;
  before: number;
  after: number;
}

/** SVGO's preset-default (v4 already keeps viewBox and <title>), multipass. Errors become null. */
export function optimizeSvg(svg: string): Optimized | null {
  try {
    const out = optimize(svg, { multipass: true, plugins: ["preset-default"] }).data;
    return { svg: out, before: byteSize(svg), after: byteSize(out) };
  } catch {
    return null;
  }
}

/** "1.2 KB → 640 B (−47%)". */
export function savedText(o: Optimized): string {
  const fmt = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
  const pct = o.before ? Math.round((1 - o.after / o.before) * 100) : 0;
  return `${fmt(o.before)} → ${fmt(o.after)} (−${pct}%)`;
}
