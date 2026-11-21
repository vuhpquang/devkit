import { describe, it, expect } from "vitest";
import { epochToIso, isoToEpoch, parseEpoch, guessUnit, relativeTime } from "./logic";

describe("timestamp", () => {
  it("converts epoch seconds to ISO", () => {
    expect(epochToIso(0)).toEqual({ ok: true, value: "1970-01-01T00:00:00.000Z" });
  });
  it("converts ISO to epoch seconds", () => {
    expect(isoToEpoch("1970-01-01T00:00:00.000Z")).toEqual({ ok: true, value: 0 });
  });
  it("errors on garbage", () => {
    expect(isoToEpoch("not-a-date").ok).toBe(false);
    expect(epochToIso(NaN).ok).toBe(false);
  });
});

describe("parseEpoch / guessUnit / relativeTime", () => {
  it("parses seconds and milliseconds", () => {
    expect(parseEpoch("1700000000", "s")).toEqual({ ok: true, value: new Date(1700000000000) });
    expect(parseEpoch("1700000000123", "ms")).toEqual({ ok: true, value: new Date(1700000000123) });
    expect(parseEpoch("abc", "s").ok).toBe(false);
    expect(parseEpoch("", "s").ok).toBe(false);
  });
  it("guesses the unit from the length", () => {
    expect(guessUnit("1700000000")).toBe("s");
    expect(guessUnit("1700000000123")).toBe("ms");
  });
  it("describes the distance from now", () => {
    const now = new Date("2026-01-10T12:00:00Z");
    expect(relativeTime(new Date("2026-01-10T09:00:00Z"), now)).toBe("3 hours ago");
    expect(relativeTime(new Date("2026-01-12T12:00:00Z"), now)).toBe("in 2 days");
    expect(relativeTime(now, now)).toBe("now");
  });
});
