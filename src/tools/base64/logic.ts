export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function encodeBase64(input: string): Result {
  try {
    const bytes = new TextEncoder().encode(input);
    const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    return { ok: true, value: btoa(bin) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function decodeBase64(input: string): Result {
  try {
    const trimmed = input.trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) throw new Error("Invalid base64");
    const bin = atob(trimmed);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return { ok: true, value: new TextDecoder().decode(bytes) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
