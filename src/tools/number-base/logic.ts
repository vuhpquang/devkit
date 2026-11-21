export type Base = 2 | 8 | 10 | 16;

export type Result =
  | { ok: true; bin: string; oct: string; dec: string; hex: string }
  | { ok: false; error: string };

const DIGITS: Record<Base, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-f]+$/,
};
const PREFIX: Record<Base, string> = { 2: "0b", 8: "0o", 10: "", 16: "0x" };
const NAME: Record<Base, string> = { 2: "binary", 8: "octal", 10: "decimal", 16: "hex" };

/**
 * Converts a non-negative integer between bases. Arbitrary size (BigInt). Ignores spaces and `_`
 * separators and an optional 0b / 0o / 0x prefix that matches the base.
 */
export function convertBase(value: string, fromBase: Base): Result {
  let s = value.trim().toLowerCase().replace(/[\s_]/g, "");
  if (!s) return { ok: false, error: "Empty input" };
  if (PREFIX[fromBase] && s.startsWith(PREFIX[fromBase])) s = s.slice(2);
  if (!DIGITS[fromBase].test(s)) {
    return { ok: false, error: `Not a ${NAME[fromBase]} number — allowed digits: ${fromBase === 16 ? "0–9, a–f" : `0–${fromBase - 1}`}` };
  }
  const n = BigInt(fromBase === 10 ? s : `${PREFIX[fromBase]}${s}`);
  return { ok: true, bin: n.toString(2), oct: n.toString(8), dec: n.toString(10), hex: n.toString(16) };
}
