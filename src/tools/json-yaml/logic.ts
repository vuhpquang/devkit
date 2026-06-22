import { load, dump } from "js-yaml";

export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function jsonToYaml(input: string): Result {
  try {
    return { ok: true, value: dump(JSON.parse(input)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function yamlToJson(input: string): Result {
  try {
    return { ok: true, value: JSON.stringify(load(input), null, 2) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
