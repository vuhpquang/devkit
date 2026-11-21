export type Result =
  | { ok: true; header: object; payload: object }
  | { ok: false; error: string };

function decodeSegment(seg: string): object {
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function decodeJwt(token: string): Result {
  try {
    const parts = token.trim().split(".");
    if (parts.length < 2) throw new Error("Not a JWT (expected header.payload.signature)");
    return { ok: true, header: decodeSegment(parts[0]), payload: decodeSegment(parts[1]) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface TimeClaim {
  claim: "exp" | "iat" | "nbf";
  label: string;
  date: Date;
}

/** The standard time claims present in a payload (seconds since epoch), and whether the token is live. */
export function timeClaims(payload: object, now: Date = new Date()) {
  const p = payload as Record<string, unknown>;
  const labels = { iat: "Issued at", nbf: "Not before", exp: "Expires" } as const;
  const claims: TimeClaim[] = [];
  for (const claim of ["iat", "nbf", "exp"] as const) {
    const v = p[claim];
    if (typeof v === "number" && Number.isFinite(v)) claims.push({ claim, label: labels[claim], date: new Date(v * 1000) });
  }
  const exp = claims.find((c) => c.claim === "exp")?.date;
  const nbf = claims.find((c) => c.claim === "nbf")?.date;
  const state: "valid" | "expired" | "not-yet" | "no-expiry" =
    exp && exp <= now ? "expired" : nbf && nbf > now ? "not-yet" : exp ? "valid" : "no-expiry";
  return { claims, state };
}
