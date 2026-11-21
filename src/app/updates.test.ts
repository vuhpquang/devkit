import { describe, it, expect, beforeEach } from "vitest";
import { checkWhatsNew, compareVersions, noteBlocks, shouldShowWhatsNew, toRelease } from "./updates";

describe("compareVersions", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBe(1);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2", "1.2.1")).toBe(-1);
  });
});

describe("toRelease", () => {
  it("reads tag, notes and page from GitHub's JSON", () => {
    expect(toRelease({ tag_name: "v0.3.0", body: "## What's new\n- x", html_url: "https://g/r" })).toEqual({
      version: "0.3.0",
      notes: "## What's new\n- x",
      url: "https://g/r",
    });
  });
  it("rejects a release without a tag", () => {
    expect(() => toRelease({ body: "x" })).toThrow();
    expect(() => toRelease(null)).toThrow();
  });
});

describe("noteBlocks", () => {
  it("splits release notes into headings, bullets and paragraphs", () => {
    expect(noteBlocks("## What's new\n\n- Settings\n* Sidebar toggle\nThanks!\r\n")).toEqual([
      { kind: "heading", text: "What's new" },
      { kind: "bullet", text: "Settings" },
      { kind: "bullet", text: "Sidebar toggle" },
      { kind: "paragraph", text: "Thanks!" },
    ]);
  });
});

describe("What's New", () => {
  beforeEach(() => localStorage.clear());

  it("stays quiet on first run and opens once per newer version", () => {
    expect(shouldShowWhatsNew(null, "0.3.0")).toBe(false);
    expect(shouldShowWhatsNew("0.2.0", "0.3.0")).toBe(true);
    expect(shouldShowWhatsNew("0.3.0", "0.3.0")).toBe(false);
    expect(shouldShowWhatsNew("0.4.0", "0.3.0")).toBe(false);
  });

  it("records the running version", () => {
    expect(checkWhatsNew("0.2.0")).toBe(false);
    expect(checkWhatsNew("0.3.0")).toBe(true);
    expect(checkWhatsNew("0.3.0")).toBe(false);
  });
});
