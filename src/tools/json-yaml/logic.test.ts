import { describe, it, expect } from "vitest";
import { jsonToYaml, yamlToJson } from "./logic";

describe("json-yaml", () => {
  it("converts JSON to YAML", () => {
    const r = jsonToYaml('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.trim()).toBe("a: 1");
  });
  it("converts YAML to JSON", () => {
    const r = yamlToJson("a: 1");
    expect(r).toEqual({ ok: true, value: '{\n  "a": 1\n}' });
  });
  it("errors on bad YAML", () => {
    expect(yamlToJson("a: : :").ok).toBe(false);
  });
});
