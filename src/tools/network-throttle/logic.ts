import type { ThrottleProfile } from "../../lib/system";

export interface Preset extends ThrottleProfile {
  name: string;
  note: string;
}

/** Slow / Medium / Fast, roughly a weak 3G, a decent 3G and an average 4G link. */
export const PRESETS: Preset[] = [
  { preset: "slow", name: "Slow", note: "Weak 3G / crowded Wi-Fi", downKbps: 400, upKbps: 128, delayMs: 400, lossPct: 2 },
  { preset: "medium", name: "Medium", note: "3G", downKbps: 1600, upKbps: 768, delayMs: 150, lossPct: 0 },
  { preset: "fast", name: "Fast", note: "Average 4G", downKbps: 12000, upKbps: 5000, delayMs: 50, lossPct: 0 },
];

export const CUSTOM_DEFAULT: ThrottleProfile = { preset: "custom", downKbps: 2000, upKbps: 1000, delayMs: 100, lossPct: 0 };

export const DURATIONS = [15, 30, 60, 120] as const;

/** Mirrors the Rust checks so the form can say what's wrong before asking for the password. */
export function validate(p: ThrottleProfile): string | null {
  if (!/^[a-z0-9-]{1,24}$/.test(p.preset)) return "Unknown preset.";
  for (const v of [p.downKbps, p.upKbps]) if (!Number.isInteger(v) || v < 32 || v > 1_000_000) return "Bandwidth must be between 32 Kbit/s and 1 Gbit/s.";
  if (!Number.isInteger(p.delayMs) || p.delayMs < 0 || p.delayMs > 5000) return "Latency must be between 0 and 5000 ms.";
  if (!Number.isFinite(p.lossPct) || p.lossPct < 0 || p.lossPct > 50) return "Packet loss must be between 0 and 50 %.";
  return null;
}

/** 400 → "400 Kbit/s", 1600 → "1.6 Mbit/s", 12000 → "12 Mbit/s". */
export function formatKbps(k: number): string {
  if (k < 1000) return `${k} Kbit/s`;
  const m = k / 1000;
  return `${Number.isInteger(m) ? m : m.toFixed(1)} Mbit/s`;
}

export interface ActiveProfile extends ThrottleProfile {
  until: number;
}

/** The JSON the root script wrote; null when it's missing or malformed. */
export function parseActive(json: string | null): ActiveProfile | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const num = (k: string) => (typeof v[k] === "number" ? (v[k] as number) : NaN);
    const p = { preset: String(v.preset ?? ""), downKbps: num("downKbps"), upKbps: num("upKbps"), delayMs: num("delayMs"), lossPct: num("lossPct"), until: num("until") };
    return Object.values(p).some((x) => typeof x === "number" && Number.isNaN(x)) ? null : p;
  } catch {
    return null;
  }
}

/** "12:05 left", "1:02:09 left". */
export function remaining(untilSec: number, nowMs = Date.now()): string {
  const s = Math.max(0, Math.round(untilSec - nowMs / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec} left` : `${m}:${sec} left`;
}

export function presetName(id: string): string {
  return PRESETS.find((p) => p.preset === id)?.name ?? "Custom";
}
