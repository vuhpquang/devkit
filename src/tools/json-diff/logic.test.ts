import { describe, it, expect } from "vitest";
import { diffJson } from "./logic";

describe("diffJson", () => {
  it("detects a changed value", () => {
    const r = diffJson('{"a":1}', '{"a":2}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.changes).toHaveLength(1);
      expect(r.changes[0]).toMatchObject({ type: "CHANGE", path: "a", value: 2, oldValue: 1 });
    }
  });
  it("errors on invalid JSON", () => {
    expect(diffJson("{bad}", "{}").ok).toBe(false);
  });
});
