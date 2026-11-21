export function epochToIso(epoch: number) {
  if (!Number.isFinite(epoch)) return { ok: false as const, error: "Not a number" };
  const d = new Date(epoch * 1000);
  if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Invalid epoch" };
  return { ok: true as const, value: d.toISOString() };
}

export function isoToEpoch(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { ok: false as const, error: "Invalid date string" };
  return { ok: true as const, value: Math.floor(ms / 1000) };
}

export type EpochUnit = "s" | "ms";

/** Parses a Unix time typed by the user (seconds or milliseconds, decimals allowed). */
export function parseEpoch(input: string, unit: EpochUnit) {
  const s = input.trim();
  if (!s) return { ok: false as const, error: "Empty" };
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false as const, error: "Not a number" };
  const ms = unit === "s" ? Number(s) * 1000 : Number(s);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Out of range" };
  return { ok: true as const, value: d };
}

/** Guesses the unit from the digit count: 13+ digits is milliseconds. */
export function guessUnit(input: string): EpochUnit {
  return input.trim().replace(/^-/, "").split(".")[0].length >= 13 ? "ms" : "s";
}

/** "3 hours ago", "in 2 days", "now". */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 5) return "now";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "now";
}
