import { describe, it, expect } from "vitest";
import {
  buildOptions,
  DEFAULT_ICO,
  DEFAULT_STATE,
  deltaPercent,
  fromHandoff,
  hexToRgb,
  lockedOther,
  resizeFor,
  svgPresets,
  usesBackground,
  usesQuality,
} from "./logic";
import { baseName, extOf, isImageName, mimeFor, uniqueNames } from "./files";

describe("options", () => {
  it("only sends what the format uses", () => {
    expect(buildOptions({ ...DEFAULT_STATE, format: "png" })).toEqual({ format: "png" });
    expect(buildOptions({ ...DEFAULT_STATE, format: "jpeg", quality: 72.4, background: "#000000" })).toEqual({
      format: "jpeg",
      quality: 72,
      background: [0, 0, 0],
    });
    expect(buildOptions({ ...DEFAULT_STATE, format: "webp", lossless: true })).toEqual({ format: "webp", lossless: true });
    expect(buildOptions({ ...DEFAULT_STATE, format: "webp", quality: 150 })).toEqual({ format: "webp", quality: 100, lossless: false });
    expect(buildOptions({ ...DEFAULT_STATE, format: "ico", icoSizes: [48, 16] })).toEqual({ format: "ico", icoSizes: [16, 48] });
    expect(buildOptions({ ...DEFAULT_STATE, format: "ico", icoSizes: [] }).icoSizes).toEqual(DEFAULT_ICO);
  });

  it("knows which controls apply", () => {
    expect(usesQuality("jpeg", false)).toBe(true);
    expect(usesQuality("webp", true)).toBe(false);
    expect(usesQuality("png", false)).toBe(false);
    expect(usesBackground("bmp")).toBe(true);
    expect(usesBackground("webp")).toBe(false);
  });

  it("builds the resize part", () => {
    expect(resizeFor({ ...DEFAULT_STATE, sizeMode: "size", width: "300", height: "" })).toEqual({ width: 300, height: undefined, fit: "fit", allowUpscale: true });
    expect(resizeFor({ ...DEFAULT_STATE, sizeMode: "size", width: "300", height: "150" })).toMatchObject({ fit: "exact" });
    expect(resizeFor({ ...DEFAULT_STATE, sizeMode: "size", width: "x", height: "" })).toBeUndefined();
    expect(resizeFor({ ...DEFAULT_STATE, sizeMode: "percent", percent: "50" })).toEqual({ percent: 50, allowUpscale: true });
    expect(resizeFor({ ...DEFAULT_STATE, sizeMode: "percent", percent: "100" })).toBeUndefined();
    expect(resizeFor({ ...DEFAULT_STATE, format: "ico", sizeMode: "size", width: "64" })).toBeUndefined();
  });

  it("parses colours", () => {
    expect(hexToRgb("#ff8800")).toEqual([255, 136, 0]);
    expect(hexToRgb("nope")).toEqual([255, 255, 255]);
  });
});

describe("sizes", () => {
  it("keeps the aspect when one side changes", () => {
    expect(lockedOther(400, 200, "width", "100")).toBe("50");
    expect(lockedOther(400, 200, "height", "50")).toBe("100");
    expect(lockedOther(400, 200, "width", "")).toBe("");
    expect(lockedOther(0, 0, "width", "10")).toBe("");
  });

  it("offers SVG render sizes", () => {
    expect(svgPresets(24, 12)).toEqual([
      { label: "1×", width: 24, height: 12 },
      { label: "2×", width: 48, height: 24 },
      { label: "3×", width: 72, height: 36 },
      { label: "512", width: 512, height: 256 },
      { label: "1024", width: 1024, height: 512 },
    ]);
  });

  it("formats the size change", () => {
    expect(deltaPercent(1000, 370)).toBe("−63 %");
    expect(deltaPercent(1000, 1120)).toBe("+12 %");
    expect(deltaPercent(1000, 1001)).toBe("±0 %");
    expect(deltaPercent(0, 10)).toBe("");
  });
});

describe("files and handoff", () => {
  it("recognises image names", () => {
    expect(mimeFor("a.SVG")).toBe("image/svg+xml");
    expect(mimeFor("photo.jpeg")).toBe("image/jpeg");
    expect(isImageName("notes.txt")).toBe(false);
    expect(extOf("archive.tar.gz")).toBe("gz");
    expect(baseName("/Users/a/Pictures/cat.png")).toBe("cat.png");
    expect(baseName("C:\\x\\dog.webp")).toBe("dog.webp");
  });

  it("de-duplicates names within a batch", () => {
    expect(uniqueNames(["a.png", "b.png", "a.png", "A.png", "a (1).png"])).toEqual(["a.png", "b.png", "a (1).png", "A (2).png", "a (1) (1).png"]);
    // Names already in the target folder are never reused, so nothing is overwritten.
    expect(uniqueNames(["a.png", "b.png"], ["A.png", "a (1).png"])).toEqual(["a (2).png", "b.png"]);
  });

  it("takes the first image of a handoff", () => {
    const bytes = new Uint8Array([1]);
    expect(fromHandoff({ kind: "image", name: "i.svg", mime: "image/svg+xml", bytes })).toEqual({ name: "i.svg", mime: "image/svg+xml", bytes });
    expect(fromHandoff({ kind: "images", files: [{ name: "a.png", mime: "image/png", bytes }] })?.name).toBe("a.png");
    expect(fromHandoff({ kind: "images", files: [] })).toBeNull();
    expect(fromHandoff({ kind: "text", text: "x" })).toBeNull();
    expect(fromHandoff(undefined)).toBeNull();
  });
});
