import { describe, it, expect } from "vitest";
import { tools } from "./registry";

describe("registry integration", () => {
  it("registers all 20 tools (15 local + 5 v1.5 network)", () => {
    expect(tools).toHaveLength(20);
  });
  it("every tool has a component and unique id", () => {
    const ids = new Set<string>();
    for (const t of tools) {
      expect(typeof t.component).toBe("function");
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });
  it("covers all six categories including Network", () => {
    const cats = new Set(tools.map((t) => t.category));
    expect([...cats].sort()).toEqual(["Converters", "Diff", "Encoders", "Formatters", "Generators", "Network"]);
  });
  it("all Network tools have online: true", () => {
    const networkTools = tools.filter((t) => t.category === "Network");
    expect(networkTools.length).toBe(5);
    for (const t of networkTools) {
      expect(t.online).toBe(true);
    }
  });
});
