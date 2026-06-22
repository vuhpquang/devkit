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
