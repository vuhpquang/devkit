export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function encodeUrl(input: string): Result {
  try {
    return { ok: true, value: encodeURIComponent(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function decodeUrl(input: string): Result {
  try {
    return { ok: true, value: decodeURIComponent(input) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
