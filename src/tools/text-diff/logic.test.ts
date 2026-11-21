import { describe, it, expect } from "vitest";
import { diffText, toDiffRows } from "./logic";

describe("diffText", () => {
  it("marks added and removed lines", () => {
    const parts = diffText("a\nb\n", "a\nc\n");
    const removed = parts.find((p) => p.removed);
    const added = parts.find((p) => p.added);
    expect(removed?.value).toContain("b");
    expect(added?.value).toContain("c");
  });
});

describe("toDiffRows", () => {
  it("numbers both sides and counts changes", () => {
    const { rows, added, removed } = toDiffRows(diffText("a\nb\nc\n", "a\nx\nc\nd\n"));
    expect(rows.map((r) => [r.kind, r.left, r.right, r.text])).toEqual([
      ["same", 1, 1, "a"],
      ["del", 2, null, "b"],
      ["add", null, 2, "x"],
      ["same", 3, 3, "c"],
      ["add", null, 4, "d"],
    ]);
    expect(added).toBe(2);
    expect(removed).toBe(1);
  });

  it("handles input without a trailing newline", () => {
    const { rows } = toDiffRows(diffText("a", "a"));
    expect(rows).toEqual([{ kind: "same", left: 1, right: 1, text: "a" }]);
  });

  it("returns nothing for two empty inputs", () => {
    expect(toDiffRows(diffText("", "")).rows).toEqual([]);
  });
});
