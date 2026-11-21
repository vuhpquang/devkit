import { describe, it, expect } from "vitest";
import { CUSTOM_DEFAULT, formatKbps, parseActive, PRESETS, presetName, remaining, validate } from "./logic";

describe("presets", () => {
  it("offers Slow, Medium and Fast, each valid and slower than the next", () => {
    expect(PRESETS.map((p) => p.name)).toEqual(["Slow", "Medium", "Fast"]);
    for (const p of PRESETS) expect(validate(p), p.name).toBeNull();
    expect(PRESETS[0].downKbps).toBeLessThan(PRESETS[1].downKbps);
    expect(PRESETS[1].downKbps).toBeLessThan(PRESETS[2].downKbps);
    expect(validate(CUSTOM_DEFAULT)).toBeNull();
  });
});

describe("validate", () => {
  it("matches the Rust limits", () => {
    expect(validate({ ...CUSTOM_DEFAULT, downKbps: 16 })).toMatch(/Bandwidth/);
    expect(validate({ ...CUSTOM_DEFAULT, upKbps: 1.5 })).toMatch(/Bandwidth/);
    expect(validate({ ...CUSTOM_DEFAULT, delayMs: 6000 })).toMatch(/Latency/);
    expect(validate({ ...CUSTOM_DEFAULT, lossPct: 80 })).toMatch(/loss/);
    expect(validate({ ...CUSTOM_DEFAULT, preset: "x;y" })).toMatch(/preset/);
  });
});

describe("formatting", () => {
  it("formats bandwidth", () => {
    expect(formatKbps(400)).toBe("400 Kbit/s");
    expect(formatKbps(1600)).toBe("1.6 Mbit/s");
    expect(formatKbps(12000)).toBe("12 Mbit/s");
  });
  it("counts down the time left", () => {
    expect(remaining(1000 + 725, 1000_000)).toBe("12:05 left");
    expect(remaining(1000 + 3729, 1000_000)).toBe("1:02:09 left");
    expect(remaining(10, 1000_000)).toBe("0:00 left");
  });
  it("names presets", () => {
    expect(presetName("medium")).toBe("Medium");
    expect(presetName("custom")).toBe("Custom");
  });
});

describe("parseActive", () => {
  it("reads the state the root script wrote", () => {
    expect(parseActive('{"preset":"slow","downKbps":400,"upKbps":128,"delayMs":400,"lossPct":2,"until":1900000000}')).toEqual({
      preset: "slow",
      downKbps: 400,
      upKbps: 128,
      delayMs: 400,
      lossPct: 2,
      until: 1900000000,
    });
    expect(parseActive(null)).toBeNull();
    expect(parseActive("{bad")).toBeNull();
    expect(parseActive('{"preset":"slow"}')).toBeNull();
  });
});
