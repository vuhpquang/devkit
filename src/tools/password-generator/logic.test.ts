import { describe, it, expect } from "vitest";
import {
  DEFAULT_OPTIONS,
  LOOK_ALIKES,
  SETS,
  charsets,
  entropyBits,
  generatePassword,
  randomIndex,
  strength,
  type PasswordOptions,
  type RandomSource,
} from "./logic";

/** Deterministic source: returns the queued values, then counts up. */
function fakeSource(queue: number[] = []): RandomSource {
  let n = 0;
  return (count) => Uint32Array.from({ length: count }, () => (queue.length ? queue.shift()! : n++));
}

const gen = (o: Partial<PasswordOptions>, src: RandomSource = fakeSource()) => {
  const r = generatePassword({ ...DEFAULT_OPTIONS, ...o }, src);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("randomIndex", () => {
  it("rejects draws from the biased tail instead of folding them in", () => {
    // max 3: 2^32 % 3 = 1, so the limit is 2^32 - 1 and 0xFFFFFFFF must be rejected.
    expect(randomIndex(3, fakeSource([0xffffffff, 5]))).toBe(2);
  });
  it("stays in range", () => {
    const src = fakeSource();
    for (let i = 0; i < 200; i++) expect(randomIndex(7, src)).toBeLessThan(7);
  });
  it("refuses an empty range", () => {
    expect(() => randomIndex(0, fakeSource())).toThrow();
  });
});

describe("generatePassword", () => {
  it("has the requested length", () => {
    expect(gen({ length: 32 })).toHaveLength(32);
    expect(gen({ length: 2 })).toHaveLength(4); // clamped to the minimum
    expect(gen({ length: 500 })).toHaveLength(128);
  });

  it("contains at least one character from every selected set", () => {
    for (let seed = 0; seed < 30; seed++) {
      const pw = gen({ length: 4 }, fakeSource([seed * 7919, seed * 104729]));
      expect([...pw].some((c) => SETS.lower.includes(c)), pw).toBe(true);
      expect([...pw].some((c) => SETS.upper.includes(c)), pw).toBe(true);
      expect([...pw].some((c) => SETS.digits.includes(c)), pw).toBe(true);
      expect([...pw].some((c) => SETS.symbols.includes(c)), pw).toBe(true);
    }
  });

  it("only uses the selected sets", () => {
    expect(gen({ lower: false, upper: false, symbols: false, length: 50 })).toMatch(/^\d{50}$/);
  });

  it("leaves out look-alikes when asked", () => {
    const pw = gen({ avoidLookAlikes: true, length: 128 });
    for (const c of LOOK_ALIKES) expect(pw).not.toContain(c);
  });

  it("needs at least one set", () => {
    expect(generatePassword({ ...DEFAULT_OPTIONS, lower: false, upper: false, digits: false, symbols: false }).ok).toBe(false);
  });

  it("works with the real crypto source", () => {
    const a = generatePassword(DEFAULT_OPTIONS);
    const b = generatePassword(DEFAULT_OPTIONS);
    expect(a.ok && b.ok && a.value !== b.value).toBe(true);
  });
});

describe("entropy and strength", () => {
  it("is length × log2(pool)", () => {
    expect(entropyBits({ ...DEFAULT_OPTIONS, upper: false, symbols: false, lower: false, length: 10 })).toBeCloseTo(10 * Math.log2(10));
    const pool = charsets(DEFAULT_OPTIONS).join("").length;
    expect(pool).toBe(26 + 26 + 10 + SETS.symbols.length);
    expect(entropyBits(DEFAULT_OPTIONS)).toBeCloseTo(20 * Math.log2(pool));
  });

  it("labels the strength", () => {
    expect(strength(30).label).toBe("Weak");
    expect(strength(50).label).toBe("Fair");
    expect(strength(80).label).toBe("Strong");
    expect(strength(130).label).toBe("Very strong");
  });
});
