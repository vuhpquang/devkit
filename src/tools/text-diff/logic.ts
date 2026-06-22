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
