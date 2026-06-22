export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function formatJson(input: string, indent: number): Result {
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(input), null, indent) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function minifyJson(input: string): Result {
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(input)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
