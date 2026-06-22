import { describe, it, expect } from "vitest";
import { formatJson, minifyJson } from "./logic";

describe("formatJson", () => {
  it("pretty-prints valid JSON", () => {
    const r = formatJson('{"a":1}', 2);
    expect(r).toEqual({ ok: true, value: '{\n  "a": 1\n}' });
  });
  it("returns an error for invalid JSON", () => {
    const r = formatJson("{bad}", 2);
    expect(r.ok).toBe(false);
  });
  it("minifies valid JSON", () => {
    expect(minifyJson('{ "a": 1 }')).toEqual({ ok: true, value: '{"a":1}' });
  });
});
