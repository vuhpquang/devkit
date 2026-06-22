import { format } from "sql-formatter";

export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function formatSql(input: string): Result {
  try {
    return { ok: true, value: format(input, { keywordCase: "upper" }) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
