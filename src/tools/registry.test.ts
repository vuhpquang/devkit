import { describe, it, expect } from "vitest";
import { tools, getToolById, CATEGORY_ORDER } from "./registry";

describe("registry", () => {
  it("has unique tool ids", () => {
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("only uses known categories", () => {
    for (const t of tools) {
      expect(CATEGORY_ORDER).toContain(t.category);
    }
  });
  it("getToolById returns undefined for unknown id", () => {
    expect(getToolById("does-not-exist")).toBeUndefined();
  });
});
