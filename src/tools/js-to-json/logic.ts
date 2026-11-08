import JSON5 from "json5";

export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Converts a JavaScript object literal into valid JSON.
 *
 * Accepts the relaxed syntax you'd copy out of JS/TS source — unquoted keys,
 * single quotes, trailing commas, comments, hex numbers, +Infinity/NaN — via
 * JSON5, then re-serialises as strict JSON.
 */
export function jsToJson(input: string, indent = 2): Result {
  if (input.trim() === "") {
    return { ok: true, value: "" };
  }
  try {
    return { ok: true, value: JSON.stringify(JSON5.parse(input), null, indent) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
