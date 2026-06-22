import { describe, it, expect } from "vitest";
import { formatSql } from "./logic";

describe("formatSql", () => {
  it("uppercases keywords and breaks lines", () => {
    const r = formatSql("select a from t where b=1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain("SELECT");
      expect(r.value).toContain("FROM");
    }
  });
});
