/** An sRGB colour: r, g, b in 0–255 (may be fractional), a in 0–1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ParseResult = { ok: true; color: Rgba } | { ok: false; error: string };

const NAMED_SRC =
  "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4," +
  "black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0," +
  "chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff," +
  "darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9," +
  "darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000," +
  "darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f," +
  "darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969," +
  "dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc," +
  "ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,grey:808080," +
  "honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa," +
  "lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff," +
  "lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1," +
  "lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899," +
  "lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000," +
  "mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371," +
  "mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585," +
  "midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080," +
  "oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa," +
  "palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f," +
  "pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f," +
  "royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d," +
  "silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f," +
  "steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3," +
  "white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32";

/** The 148 CSS named colours, name → 6-digit hex (no #). */
export const NAMED_COLORS: Record<string, string> = Object.fromEntries(
  NAMED_SRC.split(",").map((pair) => pair.split(":") as [string, string]),
);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** "12", "12.5", "50%" (of `percentOf`), returns NaN when malformed. */
function num(token: string, percentOf: number): number {
  const t = token.trim();
  if (/^-?\d*\.?\d+(e-?\d+)?%$/i.test(t)) return (parseFloat(t) / 100) * percentOf;
  if (/^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) return parseFloat(t);
  return NaN;
}

/** Hue in degrees from "120", "120deg", "0.5turn", "3.14rad", "200grad". */
function hue(token: string): number {
  const t = token.trim().toLowerCase();
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)(deg|turn|rad|grad)?$/.exec(t);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? "deg";
  const deg = unit === "turn" ? v * 360 : unit === "rad" ? (v * 180) / Math.PI : unit === "grad" ? v * 0.9 : v;
  return ((deg % 360) + 360) % 360;
}

/** Splits "a b c / d" or "a, b, c, d" into [a, b, c, d?]. */
function args(body: string): string[] | null {
  const s = body.trim();
  if (s.includes(",")) {
    const parts = s.split(",").map((p) => p.trim());
    return parts.length === 3 || parts.length === 4 ? parts : null;
  }
  const [main, alpha, extra] = s.split("/").map((p) => p.trim());
  if (extra !== undefined) return null;
  const parts = main.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return null;
  return alpha !== undefined ? [...parts, alpha] : parts;
}

function alphaOf(token: string | undefined): number {
  if (token === undefined) return 1;
  return num(token, 1);
}

function hexToRgba(hex: string): Rgba | null {
  const h = hex.replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(h)) return null;
  if (h.length === 3 || h.length === 4) {
    const [r, g, b, a] = h.split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: a === undefined ? 1 : a / 255 };
  }
  if (h.length === 6 || h.length === 8) {
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) / 255 : 1 };
  }
  return null;
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // s, l in 0–1
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function hwbToRgb(h: number, w: number, bl: number): [number, number, number] {
  // w, bl in 0–1
  if (w + bl >= 1) {
    const gray = (w / (w + bl)) * 255;
    return [gray, gray, gray];
  }
  return hslToRgb(h, 1, 0.5).map((c) => (c / 255) * (1 - w - bl) * 255 + w * 255) as [number, number, number];
}

/** Parses any CSS colour this tool understands: hex, rgb(a), hsl(a), hwb and named colours. */
export function parseColor(input: string): ParseResult {
  const s = input.trim().toLowerCase();
  if (!s) return { ok: false, error: "Enter a colour" };
  if (s === "transparent") return { ok: true, color: { r: 0, g: 0, b: 0, a: 0 } };
  if (NAMED_COLORS[s]) return { ok: true, color: hexToRgba(NAMED_COLORS[s])! };

  if (s.startsWith("#") || /^[0-9a-f]{3,8}$/.test(s)) {
    const c = hexToRgba(s);
    return c ? { ok: true, color: c } : { ok: false, error: "Hex colours have 3, 4, 6 or 8 digits (0–9, a–f)" };
  }

  const fn = /^(rgba?|hsla?|hwb)\((.*)\)$/.exec(s);
  if (!fn) return { ok: false, error: "Not a colour — try #f5a524, rgb(245 165 36), hsl(37 91% 55%) or a name like coral" };
  const a = args(fn[2]);
  if (!a) return { ok: false, error: `${fn[1]}() needs 3 values and an optional alpha` };
  const alpha = alphaOf(a[3]);
  if (Number.isNaN(alpha)) return { ok: false, error: "Alpha must be a number 0–1 or a percentage" };

  let rgb: [number, number, number];
  if (fn[1].startsWith("rgb")) {
    rgb = [num(a[0], 255), num(a[1], 255), num(a[2], 255)];
  } else {
    const h = hue(a[0]);
    const x = num(a[1], 1);
    const y = num(a[2], 1);
    if ([h, x, y].some(Number.isNaN)) return { ok: false, error: `${fn[1]}() values must be numbers` };
    // hsl/hwb percentages: "50%" → 0.5; a bare number is read as a percentage too (CSS Color 4).
    const pct = (tok: string, v: number) => (tok.trim().endsWith("%") ? v : v / 100);
    rgb = fn[1] === "hwb" ? hwbToRgb(h, pct(a[1], x), pct(a[2], y)) : hslToRgb(h, clamp(pct(a[1], x), 0, 1), clamp(pct(a[2], y), 0, 1));
  }
  if (rgb.some(Number.isNaN)) return { ok: false, error: `${fn[1]}() values must be numbers` };
  const [r, g, b] = rgb.map((v) => clamp(v, 0, 255));
  return { ok: true, color: { r, g, b, a: clamp(alpha, 0, 1) } };
}

/* ------------------------------------------------------------- formatting */

const round = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
const hex2 = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
const alphaText = (a: number) => String(round(a, 3));

export function toHex(c: Rgba, withAlpha = c.a < 1): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${withAlpha ? hex2(c.a * 255) : ""}`;
}

export function toRgbString(c: Rgba): string {
  const body = `${round(c.r)} ${round(c.g)} ${round(c.b)}`;
  return c.a < 1 ? `rgb(${body} / ${alphaText(c.a)})` : `rgb(${body})`;
}

/** h in degrees, s and l in 0–100. */
export function rgbToHsl(c: Rgba): { h: number; s: number; l: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function toHslString(c: Rgba): string {
  const { h, s, l } = rgbToHsl(c);
  const body = `${round(h, 1)} ${round(s, 1)}% ${round(l, 1)}%`;
  return c.a < 1 ? `hsl(${body} / ${alphaText(c.a)})` : `hsl(${body})`;
}

export function toHwbString(c: Rgba): string {
  const { h } = rgbToHsl(c);
  const w = (Math.min(c.r, c.g, c.b) / 255) * 100;
  const bl = (1 - Math.max(c.r, c.g, c.b) / 255) * 100;
  const body = `${round(h, 1)} ${round(w, 1)}% ${round(bl, 1)}%`;
  return c.a < 1 ? `hwb(${body} / ${alphaText(c.a)})` : `hwb(${body})`;
}

const linear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** sRGB → OKLab → OKLCH (Björn Ottosson's matrices). L in 0–1, C ≥ 0, h in degrees. */
export function rgbToOklch(c: Rgba): { l: number; c: number; h: number } {
  const r = linear(c.r);
  const g = linear(c.g);
  const b = linear(c.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h: C < 1e-4 ? 0 : h };
}

export function toOklchString(c: Rgba): string {
  const o = rgbToOklch(c);
  const body = `${round(o.l * 100, 2)}% ${round(o.c, 4)} ${round(o.h, 2)}`;
  return c.a < 1 ? `oklch(${body} / ${alphaText(c.a)})` : `oklch(${body})`;
}

/** Name of the CSS named colour with exactly this value, if any (prefers "gray" over "grey"). */
export function colorName(c: Rgba): string | null {
  if (c.a < 1) return null;
  const hex = toHex(c, false).slice(1);
  const hit = Object.entries(NAMED_COLORS).find(([, v]) => v === hex);
  return hit ? hit[0] : null;
}

/* --------------------------------------------------------------- contrast */

/** WCAG 2 relative luminance of an opaque colour. */
export function luminance(c: Rgba): number {
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

/** Blends a translucent colour over an opaque background. */
export function over(c: Rgba, bg: Rgba): Rgba {
  return { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 };
}

/** WCAG contrast ratio of `fg` on the opaque `bg` (1–21). A translucent `fg` is blended over `bg` first. */
export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const f = luminance(fg.a < 1 ? over(fg, bg) : fg);
  const b = luminance(bg);
  const [hi, lo] = f > b ? [f, b] : [b, f];
  return (hi + 0.05) / (lo + 0.05);
}

export interface WcagGrade {
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
}

export function wcag(ratio: number): WcagGrade {
  return { aa: ratio >= 4.5, aaa: ratio >= 7, aaLarge: ratio >= 3 };
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
