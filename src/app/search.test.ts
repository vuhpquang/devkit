import { describe, it, expect, beforeEach } from "vitest";
import { searchTools, matchScore } from "./search";
import { toggleId, pushRecent, loadIds } from "./prefs";
import { tools, getToolById } from "../tools/registry";

describe("searchTools", () => {
  it("returns every tool for an empty query", () => {
    expect(searchTools(tools, "  ")).toHaveLength(tools.length);
  });

  it("ranks a name prefix above keyword hits", () => {
    const ids = searchTools(tools, "json").map((t) => t.id);
    expect(ids[0]).toBe("json-format");
    expect(ids).toContain("json-yaml");
    expect(ids).toContain("js-to-json");
  });

  it("finds tools by keyword", () => {
    expect(searchTools(tools, "sha256").map((t) => t.id)).toEqual(["hash"]);
    expect(searchTools(tools, "epoch").map((t) => t.id)).toEqual(["timestamp"]);
  });

  it("requires every word to match", () => {
    expect(searchTools(tools, "json zzz")).toEqual([]);
    expect(searchTools(tools, "url decode").map((t) => t.id)[0]).toBe("url-codec");
  });

  it("scores a non-match as -1", () => {
    expect(matchScore(getToolById("uuid")!, "nothing-like-this")).toBe(-1);
  });
});

describe("prefs helpers", () => {
  beforeEach(() => localStorage.clear());

  it("toggles ids", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("keeps recent ids unique, newest first, capped", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("loads only string arrays from storage", () => {
    localStorage.setItem("k", JSON.stringify(["x", 3, "y"]));
    expect(loadIds("k")).toEqual(["x", "y"]);
    localStorage.setItem("k", "{not json");
    expect(loadIds("k")).toEqual([]);
    expect(loadIds("missing")).toEqual([]);
  });
});
