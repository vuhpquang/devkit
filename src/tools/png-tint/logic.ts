/* Pure helpers for the PNG Tint Tester. */

/** Tint presets: two app colours plus neutrals. */
export const PRESETS: { name: string; hex: string }[] = [
  { name: "Pink", hex: "#eb2f96" },
  { name: "Grey", hex: "#727272" },
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#ffffff" },
  { name: "Charcoal", hex: "#1e2430" },
  { name: "Amber", hex: "#f5a524" },
];

/**
 * "#ABC", "abc", "#aabbcc", "aabbccdd" → lowercase "#rrggbb" / "#rrggbbaa".
 * Returns null when it isn't a hex colour.
 */
export function normalizeHex(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith("#")) s = s.slice(1);
  if (!/^([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) return null;
  if (s.length <= 4) s = [...s].map((c) => c + c).join("");
  return "#" + s;
}

/** The 6-digit form a native <input type="color"> accepts (alpha dropped). */
export function toPickerValue(hex: string): string {
  const n = normalizeHex(hex);
  return n ? n.slice(0, 7) : "#000000";
}

/** Whether a dropped / picked path or file name looks like a PNG. */
export function isPng(nameOrPath: string, mime = ""): boolean {
  return mime === "image/png" || /\.png$/i.test(nameOrPath.trim());
}

/** Last path segment, for showing what's loaded. */
export function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/** Only http(s) and data:image URLs are loaded from the URL field. */
export function isImageUrl(url: string): boolean {
  const s = url.trim();
  if (/^data:image\//i.test(s)) return true;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const SIZE_MIN = 32;
export const SIZE_MAX = 512;

export function clampSize(n: number): number {
  if (!Number.isFinite(n)) return 220;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(n)));
}
