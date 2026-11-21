import { describe, it, expect } from "vitest";
import { addSample, capLines, hopTime, parsePingLine, parseTraceLine, pingStats, validHost, type Sample } from "./logic";

describe("parsePingLine", () => {
  it("reads IPv4 and IPv6 replies", () => {
    expect(parsePingLine("64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=12.345 ms")).toEqual({
      kind: "reply",
      from: "1.1.1.1",
      seq: 0,
      ttl: 57,
      ms: 12.345,
    });
    expect(parsePingLine("16 bytes from 2606:4700:4700::1111, icmp_seq=3 hlim=58 time=9.1 ms")).toEqual({
      kind: "reply",
      from: "2606:4700:4700::1111",
      seq: 3,
      ttl: 58,
      ms: 9.1,
    });
  });

  it("reads timeouts, errors and the summary", () => {
    expect(parsePingLine("Request timeout for icmp_seq 3")).toEqual({ kind: "timeout", seq: 3 });
    expect(parsePingLine("ping: cannot resolve nope.invalid: Unknown host")).toEqual({
      kind: "error",
      message: "cannot resolve nope.invalid: Unknown host",
    });
    expect(parsePingLine("5 packets transmitted, 4 packets received, 20.0% packet loss")).toEqual({
      kind: "summary",
      transmitted: 5,
      received: 4,
      lossPct: 20,
    });
    expect(parsePingLine("round-trip min/avg/max/stddev = 10.1/12.5/15.9/2.1 ms")).toEqual({
      kind: "rtt",
      min: 10.1,
      avg: 12.5,
      max: 15.9,
      stddev: 2.1,
    });
    expect(parsePingLine("PING 1.1.1.1 (1.1.1.1): 56 data bytes")).toEqual({ kind: "other" });
  });
});

describe("samples and stats", () => {
  it("computes loss, min/avg/max and jitter", () => {
    let s: Sample[] = [];
    for (const l of [
      "64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=10.0 ms",
      "Request timeout for icmp_seq 1",
      "64 bytes from 1.1.1.1: icmp_seq=2 ttl=57 time=14.0 ms",
      "64 bytes from 1.1.1.1: icmp_seq=3 ttl=57 time=12.0 ms",
    ])
      s = addSample(s, parsePingLine(l));
    const st = pingStats(s);
    expect(st).toMatchObject({ sent: 4, received: 3, lossPct: 25, min: 10, max: 14, avg: 12 });
    expect(st.jitter).toBe(3); // |14-10| + |12-14| = 6 over 2 gaps
  });

  it("lets a late reply replace its timeout and caps the list", () => {
    let s = addSample([], { kind: "timeout", seq: 0 });
    s = addSample(s, { kind: "reply", seq: 0, from: "x", ttl: 1, ms: 5 });
    expect(s).toEqual([{ seq: 0, ms: 5 }]);
    let big: Sample[] = [];
    for (let i = 0; i < 10; i++) big = addSample(big, { kind: "timeout", seq: i }, 4);
    expect(big.map((x) => x.seq)).toEqual([6, 7, 8, 9]);
  });

  it("has no numbers before any reply", () => {
    expect(pingStats([])).toEqual({ sent: 0, received: 0, lossPct: 0, min: null, avg: null, max: null, jitter: null });
  });
});

describe("parseTraceLine", () => {
  it("reads the header", () => {
    expect(parseTraceLine("traceroute to example.com (93.184.215.14), 30 hops max, 40 byte packets")).toEqual({
      kind: "header",
      target: "example.com",
      address: "93.184.215.14",
      maxHops: 30,
    });
    expect(parseTraceLine("traceroute6 to 2001:db8::1 (2001:db8::1) from 2001:db8::2, 30 hops max, 12 byte packets")).toMatchObject({
      kind: "header",
      address: "2001:db8::1",
    });
  });

  it("reads hops with times, silent hops and IPv6 hops", () => {
    expect(parseTraceLine(" 1  192.168.1.1  2.123 ms")).toEqual({ kind: "hop", hop: { hop: 1, address: "192.168.1.1", times: [2.123] } });
    expect(parseTraceLine(" 5  *")).toEqual({ kind: "hop", hop: { hop: 5, address: null, times: [] } });
    expect(parseTraceLine("12  10.0.0.1  20.1 ms  *  21.5 ms")).toEqual({ kind: "hop", hop: { hop: 12, address: "10.0.0.1", times: [20.1, 21.5] } });
    expect(parseTraceLine(" 3  2001:db8:1::1  8.4 ms")).toEqual({ kind: "hop", hop: { hop: 3, address: "2001:db8:1::1", times: [8.4] } });
  });

  it("reports errors and ignores other text", () => {
    expect(parseTraceLine("traceroute: unknown host nope.invalid")).toEqual({ kind: "error", message: "unknown host nope.invalid" });
    expect(parseTraceLine("something else")).toEqual({ kind: "other" });
  });

  it("gives the best time of a hop", () => {
    expect(hopTime({ hop: 1, address: "x", times: [5, 3, 4] })).toBe(3);
    expect(hopTime({ hop: 1, address: null, times: [] })).toBeNull();
  });
});

describe("helpers", () => {
  it("caps raw output", () => {
    expect(capLines(["a", "b"], "c", 2)).toEqual(["b", "c"]);
  });
  it("accepts only safe hosts", () => {
    expect(validHost("example.com")).toBe(true);
    expect(validHost("2001:db8::1")).toBe(true);
    expect(validHost("-c 100 x")).toBe(false);
    expect(validHost("a;b")).toBe(false);
  });
});
