import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, fromHandoff, isSafeSuffix, outFormat, outputName, PRESETS, resizeOptions, runPool, targetSize } from "./logic";

describe("resizeOptions", () => {
  it("builds options per mode", () => {
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "width", width: "800" })).toEqual({ width: 800, fit: "fit", allowUpscale: false });
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "height", height: "600", allowUpscale: true })).toEqual({ height: 600, fit: "fit", allowUpscale: true });
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "box", width: "100", height: "100", fit: "fill" })).toEqual({ width: 100, height: 100, fit: "fill", allowUpscale: false });
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "percent", percent: "25" })).toEqual({ percent: 25, allowUpscale: false });
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "width", width: "" })).toBeNull();
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "box", width: "100", height: "" })).toBeNull();
    expect(resizeOptions({ ...DEFAULT_STATE, mode: "percent", percent: "-1" })).toBeNull();
  });

  it("has presets that all produce a size", () => {
    for (const p of PRESETS) expect(resizeOptions({ ...DEFAULT_STATE, ...p.patch }), p.label).not.toBeNull();
  });
});

describe("targetSize (mirrors img.rs)", () => {
  const r = (o: object) => ({ fit: "fit" as const, allowUpscale: false, ...o });
  it("matches the Rust cases", () => {
    expect(targetSize(400, 200, r({ width: 100 }), true)).toEqual({ width: 100, height: 50 });
    expect(targetSize(400, 200, r({ height: 50 }), true)).toEqual({ width: 100, height: 50 });
    expect(targetSize(400, 200, r({ width: 100, height: 100 }), true)).toEqual({ width: 100, height: 50 });
    expect(targetSize(400, 200, r({ width: 100, height: 100, fit: "fill" }), true)).toEqual({ width: 100, height: 100 });
    expect(targetSize(400, 200, r({ width: 100, height: 100, fit: "exact" }), true)).toEqual({ width: 100, height: 100 });
    expect(targetSize(400, 200, r({ percent: 50 }), true)).toEqual({ width: 200, height: 100 });
  });

  it("doesn't enlarge rasters unless allowed; SVGs scale freely", () => {
    expect(targetSize(100, 50, r({ width: 400 }), true)).toEqual({ width: 100, height: 50 });
    expect(targetSize(100, 50, r({ width: 400, allowUpscale: true }), true)).toEqual({ width: 400, height: 200 });
    expect(targetSize(100, 50, r({ width: 400 }), false)).toEqual({ width: 400, height: 200 });
    expect(targetSize(400, 200, r({ width: 100, height: 100, fit: "fill" }), false)).toEqual({ width: 200, height: 100 });
  });
});

describe("names and formats", () => {
  it("keeps the source format, but SVG becomes PNG", () => {
    expect(outFormat("same", "a.jpg", "image/jpeg")).toBe("jpeg");
    expect(outFormat("same", "a.webp", "image/webp")).toBe("webp");
    expect(outFormat("same", "icon.svg", "image/svg+xml")).toBe("png");
    expect(outFormat("same", "fav.ico", "image/x-icon")).toBe("png");
    expect(outFormat("webp", "a.jpg", "image/jpeg")).toBe("webp");
  });

  it("templates the suffix and refuses unsafe characters", () => {
    expect(outputName("photo.final.jpg", "@{w}x{h}", 1280, 720, "jpeg")).toBe("photo.final@1280x720.jpg");
    expect(outputName("photo.png", "", 10, 10, "webp")).toBe("photo.webp");
    expect(outputName("photo.png", "-small", 10, 10, "png")).toBe("photo-small.png");
    expect(isSafeSuffix("@{w}x{h}")).toBe(true);
    expect(isSafeSuffix("/../evil")).toBe(false);
    expect(isSafeSuffix("a:b")).toBe(false);
    expect(outputName("photo.png", "/../x", 1, 1, "png")).toBe("photo.png");
  });
});

describe("handoff and pool", () => {
  it("accepts one or many images", () => {
    const bytes = new Uint8Array([1]);
    expect(fromHandoff({ kind: "image", name: "a.png", mime: "image/png", bytes })).toHaveLength(1);
    expect(fromHandoff({ kind: "images", files: [{ name: "a", mime: "image/png", bytes }, { name: "b", mime: "image/png", bytes }] })).toHaveLength(2);
    expect(fromHandoff({ kind: "text", text: "x" })).toEqual([]);
    expect(fromHandoff(undefined)).toEqual([]);
  });

  it("never runs more than n at once", async () => {
    let live = 0;
    let peak = 0;
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (x) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      done.push(x);
      live--;
    });
    expect(peak).toBe(2);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
