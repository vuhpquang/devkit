import { describe, it, expect } from "vitest";
import { compile, findMatches, segments, replaceAll } from "./logic";

describe("regex tester logic", () => {
  it("finds all matches with numbered and named groups", () => {
    const r = findMatches("(?<y>\\d{4})-(\\d{2})", "g", "2024-01 and 2025-12");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.matches.map((m) => [m.index, m.text])).toEqual([
      [0, "2024-01"],
      [12, "2025-12"],
    ]);
    expect(r.matches[1].groups).toEqual(["2025", "12"]);
    expect(r.matches[0].named).toEqual({ y: "2024" });
  });

  it("returns only the first match without g", () => {
    const r = findMatches("a", "", "aaa");
    expect(r.ok && r.matches.length).toBe(1);
  });

  it("does not loop on zero-length matches", () => {
    const r = findMatches("x*", "g", "abc");
    expect(r.ok && r.matches.length).toBe(4);
    const u = findMatches("(?:)", "gu", "😀a");
    expect(u.ok && u.matches.map((m) => m.index)).toEqual([0, 2, 3]);
  });

  it("caps the number of matches", () => {
    const r = findMatches(".", "g", "x".repeat(50), 10);
    expect(r.ok && r.matches.length).toBe(10);
    expect(r.ok && r.truncated).toBe(true);
  });

  it("reports invalid patterns and flags", () => {
    expect(compile("(", "").ok).toBe(false);
    const r = findMatches("a", "gg", "a");
    expect(r.ok).toBe(false);
  });

  it("splits text into highlight segments", () => {
    const r = findMatches("b+", "g", "abbcb");
    if (!r.ok) throw new Error();
    expect(segments("abbcb", r.matches)).toEqual([
      { text: "a", match: null },
      { text: "bb", match: 0 },
      { text: "c", match: null },
      { text: "b", match: 1 },
    ]);
  });

  it("replaces with group references", () => {
    expect(replaceAll("(\\w+)@(\\w+)", "g", "a@b c@d", "$2 at $1")).toEqual({ ok: true, value: "b at a d at c" });
    expect(replaceAll("(", "g", "x", "y").ok).toBe(false);
  });

  it("empty pattern means no matches", () => {
    expect(findMatches("", "g", "abc")).toEqual({ ok: true, matches: [], truncated: false });
  });
});
