import { describe, it, expect } from "vitest";
import {
  parseColor,
  toHex,
  toRgbString,
  toHslString,
  toHwbString,
  toOklchString,
  rgbToOklch,
  contrastRatio,
  wcag,
  colorName,
  NAMED_COLORS,
  WHITE,
  BLACK,
  type Rgba,
} from "./logic";

const parse = (s: string): Rgba => {
  const r = parseColor(s);
  if (!r.ok) throw new Error(r.error);
  return r.color;
};

describe("parseColor", () => {
  it("reads every hex length", () => {
    expect(parse("#f00")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parse("#f008")).toMatchObject({ r: 255, g: 0, b: 0 });
    expect(parse("#f008").a).toBeCloseTo(0x88 / 255);
    expect(parse("#F5A524")).toEqual({ r: 245, g: 165, b: 36, a: 1 });
    expect(parse("f5a52480").a).toBeCloseTo(128 / 255);
  });

  it("reads rgb() in comma and space syntax, with alpha and percentages", () => {
    expect(parse("rgb(245, 165, 36)")).toEqual({ r: 245, g: 165, b: 36, a: 1 });
    expect(parse("rgba(245, 165, 36, 0.5)").a).toBe(0.5);
    expect(parse("rgb(100% 0% 0% / 25%)")).toEqual({ r: 255, g: 0, b: 0, a: 0.25 });
  });

  it("reads hsl() and hwb() with hue units", () => {
    expect(parse("hsl(0 100% 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parse("hsl(0.5turn, 100%, 50%)")).toMatchObject({ r: 0, g: 255, b: 255 });
    expect(parse("hsla(120deg 100% 25% / .5)")).toMatchObject({ r: 0, g: 127.5, b: 0, a: 0.5 });
    expect(parse("hwb(0 0% 0%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parse("hwb(0 60% 60%)")).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  it("knows the CSS named colours", () => {
    expect(Object.keys(NAMED_COLORS)).toHaveLength(148);
    expect(parse("RebeccaPurple")).toEqual({ r: 0x66, g: 0x33, b: 0x99, a: 1 });
    expect(parse("transparent").a).toBe(0);
  });

  it("explains bad input", () => {
    expect(parseColor("").ok).toBe(false);
    expect(parseColor("#12").ok).toBe(false);
    expect(parseColor("#ggg").ok).toBe(false);
    expect(parseColor("rgb(1, 2)").ok).toBe(false);
    expect(parseColor("hsl(a b c)").ok).toBe(false);
    expect(parseColor("notacolor").ok).toBe(false);
  });
});

describe("formatting", () => {
  const red = parse("#ff0000");
  it("formats red in every notation", () => {
    expect(toHex(red)).toBe("#ff0000");
    expect(toRgbString(red)).toBe("rgb(255 0 0)");
    expect(toHslString(red)).toBe("hsl(0 100% 50%)");
    expect(toHwbString(red)).toBe("hwb(0 0% 0%)");
  });

  it("adds alpha only when translucent", () => {
    const c = parse("rgb(0 0 255 / 0.5)");
    expect(toHex(c)).toBe("#0000ff80");
    expect(toHex(c, false)).toBe("#0000ff");
    expect(toRgbString(c)).toBe("rgb(0 0 255 / 0.5)");
    expect(toHslString(c)).toBe("hsl(240 100% 50% / 0.5)");
  });

  it("converts to OKLCH (red ≈ oklch(62.8% 0.2577 29.23))", () => {
    const o = rgbToOklch(red);
    expect(o.l).toBeCloseTo(0.628, 3);
    expect(o.c).toBeCloseTo(0.2577, 3);
    expect(o.h).toBeCloseTo(29.23, 1);
    expect(toOklchString(WHITE)).toBe("oklch(100% 0 0)");
  });

  it("round-trips through HSL", () => {
    const amber = parse("#f5a524");
    expect(toHex(parse(toHslString(amber)))).toBe("#f5a524");
  });

  it("names exact named colours", () => {
    expect(colorName(parse("#ff7f50"))).toBe("coral");
    expect(colorName(parse("#ff7f51"))).toBeNull();
  });
});

describe("contrast", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it("matches a known pair (#767676 on white ≈ 4.54)", () => {
    expect(contrastRatio(parse("#767676"), WHITE)).toBeCloseTo(4.54, 2);
  });

  it("blends translucent colours over the background", () => {
    expect(contrastRatio(parse("rgb(0 0 0 / 0)"), WHITE)).toBeCloseTo(1, 5);
  });

  it("grades against WCAG thresholds", () => {
    expect(wcag(4.5)).toEqual({ aa: true, aaa: false, aaLarge: true });
    expect(wcag(7)).toEqual({ aa: true, aaa: true, aaLarge: true });
    expect(wcag(2.9)).toEqual({ aa: false, aaa: false, aaLarge: false });
  });
});
