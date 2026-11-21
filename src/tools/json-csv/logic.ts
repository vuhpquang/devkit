export type Result = { ok: true; value: string } | { ok: false; error: string };
export type Delimiter = "," | ";" | "\t";

/** Quotes a field when it holds the delimiter, a quote or a line break (RFC 4180). */
export function csvField(value: string, delimiter: Delimiter = ","): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * JSON → CSV. An array of objects becomes a header (every key, in first-seen order) plus one row per object;
 * an array of arrays becomes rows as they are; a single object is one row. Nested values are JSON text.
 */
export function jsonToCsv(input: string, delimiter: Delimiter = ","): Result {
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  if (isPlainObject(data)) data = [data];
  if (!Array.isArray(data)) return { ok: false, error: "Expected an array of objects or an array of arrays" };
  const line = (cells: string[]) => cells.map((c) => csvField(c, delimiter)).join(delimiter);

  if (data.length === 0) return { ok: true, value: "" };
  if (data.every(Array.isArray)) {
    return { ok: true, value: (data as unknown[][]).map((row) => line(row.map(cell))).join("\n") };
  }
  if (data.every(isPlainObject)) {
    const rows = data as Record<string, unknown>[];
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const r of rows)
      for (const k of Object.keys(r))
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
    return { ok: true, value: [line(keys), ...rows.map((r) => line(keys.map((k) => cell(r[k]))))].join("\n") };
  }
  if (data.every((v) => !isPlainObject(v) && !Array.isArray(v))) {
    return { ok: true, value: ["value", ...data.map((v) => csvField(cell(v), delimiter))].join("\n") };
  }
  return { ok: false, error: "Mixed array: use all objects, all arrays, or all plain values" };
}

/** RFC 4180 parser: quoted fields, "" escapes, CRLF / LF / CR, line breaks inside quotes. */
export function parseCsv(text: string, delimiter: Delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let quoteLine = 0;
  let line = 1;
  let i = 0;
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      quoteLine = line;
      i++;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\r" || ch === "\n") {
      endRow();
      line++;
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (quoted) throw new Error(`Unclosed quote starting on line ${quoteLine}`);
  if (field !== "" || row.length > 0) endRow();
  // Drop blank lines (a row with one empty cell).
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

/** "42" → 42, "true" → true, "null" → null; anything else (incl. "007", "") stays a string. */
export function detectType(v: string): string | number | boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (NUMBER.test(v)) return Number(v);
  return v;
}

/** CSV → JSON: the first row is the header; each later row becomes an object. */
export function csvToJson(input: string, delimiter: Delimiter = ",", detectTypes = true): Result {
  let rows: string[][];
  try {
    rows = parseCsv(input, delimiter);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (rows.length === 0) return { ok: true, value: "[]" };
  const width = Math.max(...rows.map((r) => r.length));
  const used = new Map<string, number>();
  const header = Array.from({ length: width }, (_, i) => {
    const base = rows[0][i]?.trim() || `field${i + 1}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}_${n}`;
  });
  const out = rows.slice(1).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, detectTypes ? detectType(r[i] ?? "") : (r[i] ?? "")])),
  );
  return { ok: true, value: JSON.stringify(out, null, 2) };
}
