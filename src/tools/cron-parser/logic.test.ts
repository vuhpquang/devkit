import { describe, it, expect } from "vitest";
import { parseCron, nextRuns, describeField, PRESETS } from "./logic";

const FROM = new Date("2026-01-10T12:00:00Z"); // a Saturday

describe("parseCron", () => {
  it("explains a 5-field expression", () => {
    const r = parseCron("0 9 * * 1-5");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.description).toBe("At 09:00, Monday through Friday");
    expect(r.hasSeconds).toBe(false);
    expect(r.fields.map((f) => [f.name, f.raw])).toEqual([
      ["Minute", "0"],
      ["Hour", "9"],
      ["Day of month", "*"],
      ["Month", "*"],
      ["Day of week", "1-5"],
    ]);
    expect(r.fields[4].meaning).toBe("Monday through Friday");
  });

  it("accepts 6 fields with seconds and collapses extra spaces", () => {
    const r = parseCron("  */30   *  * * * * ");
    expect(r.ok && r.hasSeconds).toBe(true);
    if (r.ok) expect(r.fields[0]).toEqual({ name: "Second", raw: "*/30", meaning: "every 30 seconds" });
  });

  it("expands macros", () => {
    const r = parseCron("@daily");
    expect(r.ok && r.expanded).toBe("0 0 * * *");
    expect(parseCron("@WEEKLY").ok).toBe(true);
  });

  it("rejects bad input with a reason", () => {
    expect(parseCron("")).toMatchObject({ ok: false });
    expect(parseCron("* * *")).toMatchObject({ ok: false, error: expect.stringContaining("got 3") });
    expect(parseCron("61 * * * *")).toMatchObject({ ok: false, error: expect.stringContaining("0-59") });
    expect(parseCron("@reboot")).toMatchObject({ ok: false, error: expect.stringContaining("startup") });
    expect(parseCron("@sometimes")).toMatchObject({ ok: false, error: expect.stringContaining("Unknown macro") });
  });

  it("parses every preset", () => {
    for (const p of PRESETS) expect(parseCron(p.expr).ok, p.expr).toBe(true);
  });
});

describe("describeField", () => {
  it("covers steps, ranges, lists and names", () => {
    expect(describeField("*", "minute")).toBe("every minute");
    expect(describeField("*/15", "minute")).toBe("every 15 minutes");
    expect(describeField("0-30/10", "minute")).toBe("every 10 minutes from 0 through 30");
    expect(describeField("1,15", "dom")).toBe("day 1 and 15");
    expect(describeField("jan-mar", "month")).toBe("January through March");
    expect(describeField("0,6", "dow")).toBe("Sunday and Saturday");
  });
});

describe("nextRuns", () => {
  it("lists upcoming weekday runs in UTC", () => {
    const runs = nextRuns("0 9 * * 1-5", FROM, 3, true).map((d) => d.toISOString());
    expect(runs).toEqual(["2026-01-12T09:00:00.000Z", "2026-01-13T09:00:00.000Z", "2026-01-14T09:00:00.000Z"]);
  });

  it("returns the requested count", () => {
    expect(nextRuns("* * * * *", FROM, 10, true)).toHaveLength(10);
    expect(nextRuns("*/5 * * * * *", FROM, 2, true).map((d) => d.toISOString())).toEqual([
      "2026-01-10T12:00:05.000Z",
      "2026-01-10T12:00:10.000Z",
    ]);
  });
});
