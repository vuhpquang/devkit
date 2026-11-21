import { describe, it, expect } from "vitest";
import { clampSize, fileName, isImageUrl, isPng, normalizeHex, toPickerValue, PRESETS } from "./logic";

describe("normalizeHex", () => {
  it("accepts 3, 4, 6 and 8 digits with or without #", () => {
    expect(normalizeHex("#EB2F96")).toBe("#eb2f96");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex(" #abcd ")).toBe("#aabbccdd");
    expect(normalizeHex("11223344")).toBe("#11223344");
  });
  it("rejects anything else", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("ggg")).toBeNull();
    expect(normalizeHex("rgb(0,0,0)")).toBeNull();
  });
  it("gives the colour picker a 6-digit value", () => {
    expect(toPickerValue("#abcd")).toBe("#aabbcc");
    expect(toPickerValue("nope")).toBe("#000000");
  });
  it("has valid presets", () => {
    for (const p of PRESETS) expect(normalizeHex(p.hex)).toBe(p.hex);
  });
});

describe("files and URLs", () => {
  it("recognises PNGs by name or type", () => {
    expect(isPng("/a/b/Icon.PNG")).toBe(true);
    expect(isPng("photo.jpg")).toBe(false);
    expect(isPng("clip", "image/png")).toBe(true);
  });
  it("takes the last path segment", () => {
    expect(fileName("/Users/me/icons/star.png")).toBe("star.png");
    expect(fileName("C:\\icons\\star.png")).toBe("star.png");
  });
  it("loads only web and data image URLs", () => {
    expect(isImageUrl("https://example.com/a.png")).toBe(true);
    expect(isImageUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isImageUrl("javascript:alert(1)")).toBe(false);
    expect(isImageUrl("not a url")).toBe(false);
  });
  it("keeps the preview size in range", () => {
    expect(clampSize(10)).toBe(32);
    expect(clampSize(9999)).toBe(512);
    expect(clampSize(NaN)).toBe(220);
  });
});
