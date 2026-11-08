import { describe, it, expect } from "vitest";
import { jsToJson } from "./logic";

describe("js-to-json", () => {
  it("quotes unquoted keys", () => {
    expect(jsToJson("{ a: 1 }")).toEqual({ ok: true, value: '{\n  "a": 1\n}' });
  });

  it("converts single quotes to double quotes", () => {
    expect(jsToJson("{ name: 'vu' }")).toEqual({ ok: true, value: '{\n  "name": "vu"\n}' });
  });

  it("drops trailing commas", () => {
    expect(jsToJson("[1, 2, 3,]")).toEqual({ ok: true, value: "[\n  1,\n  2,\n  3\n]" });
  });

  it("strips comments", () => {
    const r = jsToJson("{ a: 1, // count\n b: 2 }");
    expect(r).toEqual({ ok: true, value: '{\n  "a": 1,\n  "b": 2\n}' });
  });

  it("returns empty string for empty input", () => {
    expect(jsToJson("   ")).toEqual({ ok: true, value: "" });
  });

  it("errors on invalid input", () => {
    expect(jsToJson("{ a: }").ok).toBe(false);
  });
});
