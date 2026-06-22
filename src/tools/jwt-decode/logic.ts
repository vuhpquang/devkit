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
