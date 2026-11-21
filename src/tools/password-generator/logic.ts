/** Returns `n` uniformly random 32-bit unsigned integers. */
export type RandomSource = (n: number) => Uint32Array;

export const cryptoSource: RandomSource = (n) => crypto.getRandomValues(new Uint32Array(n));

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Leave out characters that are easy to confuse: I l 1 O 0. */
  avoidLookAlikes: boolean;
}

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidLookAlikes: false,
};

export const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  // No quotes, backslash or backtick: safe to paste into shells and config files.
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const;

export const LOOK_ALIKES = "Il1O0";
export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

/** The character sets the options select, look-alikes removed. */
export function charsets(o: PasswordOptions): string[] {
  const keys = (["lower", "upper", "digits", "symbols"] as const).filter((k) => o[k]);
  return keys
    .map((k) => (o.avoidLookAlikes ? [...SETS[k]].filter((c) => !LOOK_ALIKES.includes(c)).join("") : SETS[k]))
    .filter((s) => s.length > 0);
}

/**
 * Uniform integer in [0, max) by rejection sampling: draws that fall in the incomplete last block of
 * 2^32 are thrown away, so there is no modulo bias.
 */
export function randomIndex(max: number, src: RandomSource): number {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("max out of range");
  const limit = 2 ** 32 - (2 ** 32 % max);
  for (;;) {
    const v = src(1)[0];
    if (v < limit) return v % max;
  }
}

export type GenerateResult = { ok: true; value: string } | { ok: false; error: string };

/** One password with at least one character from every selected set, in random positions. */
export function generatePassword(o: PasswordOptions, src: RandomSource = cryptoSource): GenerateResult {
  const sets = charsets(o);
  if (sets.length === 0) return { ok: false, error: "Pick at least one kind of character" };
  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.floor(o.length) || MIN_LENGTH, sets.length));
  const pool = sets.join("");
  const chars = sets.map((s) => s[randomIndex(s.length, src)]);
  while (chars.length < length) chars.push(pool[randomIndex(pool.length, src)]);
  // Fisher–Yates so the guaranteed characters don't always lead.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, src);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return { ok: true, value: chars.join("") };
}

/** Entropy of a password drawn uniformly from the selected pool: length × log2(pool size). */
export function entropyBits(o: PasswordOptions): number {
  const pool = charsets(o).join("").length;
  if (pool === 0) return 0;
  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.floor(o.length) || MIN_LENGTH));
  return length * Math.log2(pool);
}

export type Strength = { label: "Weak" | "Fair" | "Strong" | "Very strong"; tone: "danger" | "accent" | "success" };

export function strength(bits: number): Strength {
  if (bits < 40) return { label: "Weak", tone: "danger" };
  if (bits < 60) return { label: "Fair", tone: "accent" };
  if (bits < 100) return { label: "Strong", tone: "success" };
  return { label: "Very strong", tone: "success" };
}
