import { describe, it, expect } from "vitest";
import {
  changeList,
  formatPath,
  preview,
  DIFF_CLASS,
  SAMPLE_LEFT,
  SAMPLE_RIGHT,
  classFor,
  contentJson,
  contentText,
  diffJson,
  pathKey,
  ratioAt,
  scrollTarget,
  splitFor,
  statusText,
  step,
} from "./diff";

const k = pathKey;

describe("diffJson", () => {
  it("finds nothing in equal documents", () => {
    const d = diffJson({ a: [1, { b: null }] }, { a: [1, { b: null }] });
    expect(d.list).toEqual([]);
    expect(d.left.size).toBe(0);
    expect(d.right.size).toBe(0);
  });

  it("marks a changed leaf on both sides and its ancestors as parents", () => {
    const d = diffJson({ a: { b: 1 } }, { a: { b: 2 } });
    expect(d.list).toEqual([["a", "b"]]);
    expect(d.left.get(k(["a", "b"]))).toBe(DIFF_CLASS.changed);
    expect(d.right.get(k(["a", "b"]))).toBe(DIFF_CLASS.changed);
    for (const side of [d.left, d.right]) {
      expect(side.get(k([]))).toBe(DIFF_CLASS.parent);
      expect(side.get(k(["a"]))).toBe(DIFF_CLASS.parent);
    }
  });

  it("marks keys only on the left as removed and only on the right as added", () => {
    const d = diffJson({ x: 1, gone: true }, { x: 1, fresh: "y" });
    expect(d.left.get(k(["gone"]))).toBe(DIFF_CLASS.removed);
    expect(d.right.has(k(["gone"]))).toBe(false);
    expect(d.right.get(k(["fresh"]))).toBe(DIFF_CLASS.added);
    expect(d.left.has(k(["fresh"]))).toBe(false);
    expect(d.list).toEqual([["gone"], ["fresh"]]);
  });

  it("compares arrays by index", () => {
    const d = diffJson({ t: ["a", "b"] }, { t: ["a", "c", "d"] });
    expect(d.list).toEqual([["t", "1"], ["t", "2"]]);
    expect(d.left.get(k(["t", "1"]))).toBe(DIFF_CLASS.changed);
    expect(d.right.get(k(["t", "2"]))).toBe(DIFF_CLASS.added);
    const shorter = diffJson([1, 2, 3], [1]);
    expect(shorter.list).toEqual([["1"], ["2"]]);
    expect(shorter.left.get(k(["2"]))).toBe(DIFF_CLASS.removed);
  });

  it("treats a type change (object vs array vs scalar) as a change of that node", () => {
    expect(diffJson({ a: [1] }, { a: { 0: 1 } }).list).toEqual([["a"]]);
    expect(diffJson({ a: null }, { a: {} }).list).toEqual([["a"]]);
    expect(diffJson("x", 1).list).toEqual([[]]);
  });

  it("does not let a parent mark overwrite a real difference", () => {
    const d = diffJson({ a: 1 }, { a: 1, b: { c: 1 } });
    expect(d.right.get(k(["b"]))).toBe(DIFF_CLASS.added);
  });

  it("does not treat inherited keys like __proto__ specially", () => {
    const a = JSON.parse('{"__proto__": 1}');
    const b = JSON.parse('{"__proto__": 2}');
    expect(diffJson(a, b).list).toEqual([["__proto__"]]);
  });

  it("lists every difference in the samples", () => {
    const d = diffJson(SAMPLE_LEFT, SAMPLE_RIGHT);
    expect(d.list.map((p) => p.join("."))).toEqual([
      "version",
      "replicas",
      "regions.2",
      "database.pool",
      "database.timeoutMs",
      "features.export",
    ]);
  });
});

describe("classFor / scrollTarget", () => {
  const d = diffJson({ a: 1, gone: 1 }, { a: 2 });
  it("adds the current outline to the selected difference", () => {
    expect(classFor(d.left, ["a"], k(["a"]))).toBe(`${DIFF_CLASS.changed} ${DIFF_CLASS.current}`);
    expect(classFor(d.left, ["a"], null)).toBe(DIFF_CLASS.changed);
    expect(classFor(undefined, ["a"], null)).toBeUndefined();
  });
  it("scrolls to the parent when a side lacks the node", () => {
    expect(scrollTarget(d.right, ["gone"])).toEqual([]);
    expect(scrollTarget(d.left, ["gone"])).toEqual(["gone"]);
  });
});

describe("content helpers", () => {
  it("reads json and text content", () => {
    expect(contentJson({ json: { a: 1 } })).toEqual({ a: 1 });
    expect(contentJson({ text: '{"a":1}' })).toEqual({ a: 1 });
    expect(() => contentJson({ text: "{nope" })).toThrow();
  });
  it("serialises for saving", () => {
    expect(contentText({ json: { a: 1 } })).toBe('{\n  "a": 1\n}\n');
    expect(contentText({ text: "raw" })).toBe("raw");
  });
});

describe("split geometry", () => {
  it("snaps near the edges and keeps the ratio otherwise", () => {
    expect(splitFor(0.03)).toEqual({ kind: "collapsed-left" });
    expect(splitFor(0.97)).toEqual({ kind: "collapsed-right" });
    expect(splitFor(0.4)).toEqual({ kind: "split", ratio: 0.4 });
    expect(splitFor(NaN)).toEqual({ kind: "split", ratio: 0.5 });
  });
  it("maps a pointer position to a ratio", () => {
    expect(ratioAt(565, 0, 1130, 130)).toBeCloseTo(0.5);
    expect(ratioAt(-50, 0, 1130, 130)).toBe(0);
    expect(ratioAt(5000, 0, 1130, 130)).toBe(1);
    expect(ratioAt(10, 0, 100, 130)).toBe(0.5);
  });
});

describe("status and navigation", () => {
  it("words the status", () => {
    expect(statusText({ kind: "same" })).toBe("No differences");
    expect(statusText({ kind: "diff", count: 1, current: -1 })).toBe("1 difference");
    expect(statusText({ kind: "diff", count: 4, current: -1 })).toBe("4 differences");
    expect(statusText({ kind: "diff", count: 4, current: 2 })).toBe("3 / 4");
    expect(statusText({ kind: "invalid", side: "right" })).toBe("Invalid JSON in the modified");
    expect(statusText({ kind: "off" })).toBe("");
  });
  it("steps with wrap-around", () => {
    expect(step(-1, 1, 3)).toBe(0);
    expect(step(-1, -1, 3)).toBe(2);
    expect(step(2, 1, 3)).toBe(0);
    expect(step(0, -1, 3)).toBe(2);
    expect(step(0, 1, 0)).toBe(-1);
  });
});


describe("changeList", () => {
  it("describes every difference with its values", () => {
    const a = { name: "x", tags: ["a"], old: 1, nested: { v: 1 } };
    const b = { name: "y", tags: ["a", "b"], nested: { v: 1 } };
    const list = changeList(a, b, diffJson(a, b));
    expect(list).toEqual([
      { kind: "changed", path: ["name"], before: "x", after: "y" },
      { kind: "added", path: ["tags", "1"], after: "b" },
      { kind: "removed", path: ["old"], before: 1 },
    ]);
  });

  it("formats paths and previews values", () => {
    expect(formatPath([])).toBe("(root)");
    expect(formatPath(["items", "2", "name"])).toBe("items[2].name");
    expect(formatPath(["a b", "c"])).toBe('["a b"].c');
    expect(preview({ a: 1 })).toBe('{"a":1}');
    expect(preview("x".repeat(100), 10)).toBe(`"xxxxxxxx…`);
  });
});
