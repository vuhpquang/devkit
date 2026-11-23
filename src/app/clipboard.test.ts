import { describe, it, expect } from "vitest";
import { detectClipboard, CLIPBOARD_MAX } from "./clipboard";

const first = (s: string) => detectClipboard(s)[0];
const ids = (s: string) => detectClipboard(s).map((x) => x.toolId);

describe("detectClipboard", () => {
  it("finds a JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(first(jwt)).toEqual({ toolId: "jwt-decode", label: "JWT" });
  });

  it("finds JSON, with YAML and CSV conversions where they fit", () => {
    expect(ids('{"a": 1}')).toEqual(["json-format", "json-yaml"]);
    expect(ids('[{"a": 1}, {"a": 2}]')).toEqual(["json-format", "json-yaml", "json-csv"]);
    expect(detectClipboard('{"a": 1}')[1].mode).toBe("to-yaml");
  });

  it("tells JSON from a JavaScript object literal", () => {
    expect(ids("{ name: 'devkit', tags: ['a'] }")).toEqual(["js-to-json"]);
  });

  it("finds timestamps and dates", () => {
    expect(first("1700000000")).toEqual({ toolId: "timestamp", label: "Unix timestamp" });
    expect(first("1700000000000").label).toBe("Unix timestamp (ms)");
    expect(first("2026-11-23T09:30:00Z").toolId).toBe("timestamp");
    expect(ids("12345")).toEqual([]);
  });

  it("finds colours, cron, XML and SQL", () => {
    expect(first("#F5A524").toolId).toBe("color-converter");
    expect(first("rgb(245, 165, 36)").toolId).toBe("color-converter");
    expect(first("0 9 * * 1-5").toolId).toBe("cron-parser");
    expect(first("<root><a>1</a></root>").toolId).toBe("xml-format");
    expect(first("SELECT * FROM users WHERE id = 1").toolId).toBe("sql-format");
  });

  it("opens decoders in decode mode", () => {
    expect(first("hello%20world%21")).toEqual({ toolId: "url-codec", label: "Percent-encoded text", mode: "decode" });
    expect(first("Tom &amp; Jerry")).toEqual({ toolId: "html-entities", label: "HTML entities", mode: "decode" });
    expect(first("aGVsbG8gZGV2a2l0")).toEqual({ toolId: "base64", label: "Base64", mode: "decode" });
  });

  it("doesn't call plain words or binary Base64", () => {
    expect(detectClipboard("hello")).toEqual([]);
    expect(detectClipboard("just a sentence of text")).toEqual([]);
    expect(ids("/w==AAAA")).not.toContain("base64");
  });

  it("ignores empty and huge clipboards", () => {
    expect(detectClipboard("   ")).toEqual([]);
    expect(detectClipboard("{" + " ".repeat(CLIPBOARD_MAX) + "}")).toEqual([]);
  });
});
