import { describe, it, expect } from "vitest";
import { tools } from "./registry";

describe("registry integration", () => {
  it("registers all 14 v1 tools", () => {
    expect(tools).toHaveLength(14);
  });
  it("every tool has a component and unique id", () => {
    const ids = new Set<string>();
    for (const t of tools) {
      expect(typeof t.component).toBe("function");
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });
  it("covers all five categories", () => {
    const cats = new Set(tools.map((t) => t.category));
    expect([...cats].sort()).toEqual(["Converters", "Diff", "Encoders", "Formatters", "Generators"]);
  });
});
