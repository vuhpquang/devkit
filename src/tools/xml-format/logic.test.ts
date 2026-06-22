import { describe, it, expect } from "vitest";
import { formatXml } from "./logic";

describe("formatXml", () => {
  it("indents nested elements", () => {
    const r = formatXml("<a><b>1</b></a>");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toContain("\n  <b>1</b>");
  });
  it("errors on malformed XML", () => {
    expect(formatXml("<a><b></a>").ok).toBe(false);
  });
});
