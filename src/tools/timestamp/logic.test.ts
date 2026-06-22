import { describe, it, expect } from "vitest";
import { epochToIso, isoToEpoch } from "./logic";

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
