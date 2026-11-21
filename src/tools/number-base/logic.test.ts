import { describe, it, expect } from "vitest";
import { convertBase } from "./logic";

describe("convertBase", () => {
  it("converts decimal 255 to all bases", () => {
    const r = convertBase("255", 10);
    expect(r).toEqual({ ok: true, bin: "11111111", oct: "377", dec: "255", hex: "ff" });
  });
  it("converts hex ff", () => {
    const r = convertBase("ff", 16);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dec).toBe("255");
  });
  it("errors on invalid digits", () => {
    expect(convertBase("xyz", 10).ok).toBe(false);
  });
});

describe("convertBase validation and range", () => {
  it("rejects digits that don't belong to the base", () => {
    expect(convertBase("12", 2).ok).toBe(false);
    expect(convertBase("8", 8).ok).toBe(false);
    expect(convertBase("ff", 10).ok).toBe(false);
  });
  it("accepts a matching prefix and separators", () => {
    expect(convertBase("0xFF", 16)).toMatchObject({ ok: true, dec: "255" });
    expect(convertBase("0b1010_1010", 2)).toMatchObject({ ok: true, dec: "170" });
    expect(convertBase("1 000 000", 10)).toMatchObject({ ok: true, hex: "f4240" });
  });
  it("keeps precision past 2^53", () => {
    expect(convertBase("18446744073709551615", 10)).toMatchObject({ ok: true, hex: "ffffffffffffffff" });
  });
});
