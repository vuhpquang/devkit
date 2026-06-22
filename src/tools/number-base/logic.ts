export type Result =
  | { ok: true; bin: string; oct: string; dec: string; hex: string }
  | { ok: false; error: string };

export function convertBase(value: string, fromBase: 2 | 8 | 10 | 16): Result {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "Empty input" };
  const n = parseInt(trimmed, fromBase);
  if (Number.isNaN(n) || !/^[0-9a-fA-F]+$/.test(trimmed)) {
    return { ok: false, error: `Invalid base-${fromBase} number` };
  }
  return { ok: true, bin: n.toString(2), oct: n.toString(8), dec: n.toString(10), hex: n.toString(16) };
}
