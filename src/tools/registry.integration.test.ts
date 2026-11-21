import { describe, it, expect } from "vitest";
import { tools, CATEGORY_ORDER } from "./registry";

describe("registry integration", () => {
  it("registers all 40 tools (32 local + 8 online)", () => {
    expect(tools).toHaveLength(40);
    expect(tools.filter((t) => t.online)).toHaveLength(8);
  });

  it("every tool has a component and unique id", () => {
    const ids = new Set<string>();
    for (const t of tools) {
      expect(typeof t.component).toBe("function");
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });

  it("uses every category, in sidebar order", () => {
    const used = CATEGORY_ORDER.filter((c) => tools.some((t) => t.category === c));
    expect(used).toEqual(["Formatters", "Diff", "Converters", "Encoders", "Generators", "Text", "Design", "System", "Network"]);
  });

  it("online tools are exactly the Network category", () => {
    for (const t of tools) expect(t.online === true, t.id).toBe(t.category === "Network");
  });
});
