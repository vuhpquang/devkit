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
