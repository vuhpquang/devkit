import { diffLines } from "diff";

export interface DiffPart {
  added: boolean;
  removed: boolean;
  value: string;
}

export function diffText(a: string, b: string): DiffPart[] {
  return diffLines(a, b).map((p) => ({
    added: !!p.added,
    removed: !!p.removed,
    value: p.value,
  }));
}

export interface DiffRow {
  kind: "same" | "add" | "del";
  /** Line number on the left (original) side; null for added lines. */
  left: number | null;
  /** Line number on the right (modified) side; null for removed lines. */
  right: number | null;
  text: string;
}

/** Splits diff parts into numbered lines for a unified view. */
export function toDiffRows(parts: DiffPart[]): { rows: DiffRow[]; added: number; removed: number } {
  const rows: DiffRow[] = [];
  let l = 1;
  let r = 1;
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    const lines = p.value.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) {
      if (p.added) {
        rows.push({ kind: "add", left: null, right: r++, text });
        added++;
      } else if (p.removed) {
        rows.push({ kind: "del", left: l++, right: null, text });
        removed++;
      } else {
        rows.push({ kind: "same", left: l++, right: r++, text });
      }
    }
  }
  return { rows, added, removed };
}
