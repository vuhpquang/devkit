import diff from "microdiff";

export interface DiffLine {
  type: "CREATE" | "REMOVE" | "CHANGE";
  path: string;
  value?: unknown;
  oldValue?: unknown;
}

export type Result =
  | { ok: true; changes: DiffLine[] }
  | { ok: false; error: string };

export function diffJson(a: string, b: string): Result {
  try {
    const left = JSON.parse(a);
    const right = JSON.parse(b);
    const changes = diff(left, right).map((d) => ({
      type: d.type as DiffLine["type"],
      path: d.path.join("."),
      value: "value" in d ? d.value : undefined,
      oldValue: "oldValue" in d ? d.oldValue : undefined,
    }));
    return { ok: true, changes };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
