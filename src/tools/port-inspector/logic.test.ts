import { describe, it, expect } from "vitest";
import { filterRows, parseLsof, parseName, scopeLabel, scopeOf, stillListening } from "./logic";
import { LSOF } from "./fixtures";

describe("parseName / scopeOf", () => {
  it("reads the local side of lsof names", () => {
    expect(parseName("*:3000")).toEqual({ host: "*", port: 3000 });
    expect(parseName("127.0.0.1:5432")).toEqual({ host: "127.0.0.1", port: 5432 });
    expect(parseName("[::1]:8080")).toEqual({ host: "[::1]", port: 8080 });
    expect(parseName("[fe80::1%lo0]:5353")).toEqual({ host: "[fe80::1%lo0]", port: 5353 });
    expect(parseName("127.0.0.1:53->127.0.0.1:60000")).toEqual({ host: "127.0.0.1", port: 53 });
    expect(parseName("*:*")).toBeNull();
  });

  it("classifies bind addresses", () => {
    expect(scopeOf("*")).toBe("all");
    expect(scopeOf("[::]")).toBe("all");
    expect(scopeOf("0.0.0.0")).toBe("all");
    expect(scopeOf("127.0.0.1")).toBe("localhost");
    expect(scopeOf("[::1]")).toBe("localhost");
    expect(scopeOf("192.0.2.11")).toBe("specific");
  });
});

describe("parseLsof", () => {
  const rows = parseLsof(LSOF);

  it("keeps listeners and bound UDP sockets, sorted by port", () => {
    expect(rows.map((r) => `${r.protocol} ${r.port} ${r.command}`)).toEqual([
      "UDP 53 dnsproxy",
      "TCP 3000 node",
      "TCP 5173 vite",
      "UDP 5353 identityservicesd",
      "TCP 5432 postgres",
      "TCP 7000 ControlCenter",
    ]);
  });

  it("drops established TCP connections and unbound UDP sockets", () => {
    expect(rows.some((r) => r.port === 61000)).toBe(false);
    expect(rows.filter((r) => r.command === "identityservicesd")).toHaveLength(1);
  });

  it("merges IPv4 + IPv6 entries of the same process and port", () => {
    const node = rows.find((r) => r.port === 3000)!;
    expect(node).toMatchObject({ pid: 350, user: "dev", scope: "all", ipv4: true, ipv6: true, addresses: ["*", "[::]"] });
    expect(scopeLabel(node)).toBe("All interfaces · IPv4 + IPv6");
    const pg = rows.find((r) => r.port === 5432)!;
    expect(pg.scope).toBe("localhost");
    expect(scopeLabel(pg)).toBe("Localhost only · IPv4 + IPv6");
    expect(scopeLabel(rows.find((r) => r.port === 5173)!)).toBe("Localhost only · IPv6");
    expect(scopeLabel(rows.find((r) => r.port === 7000)!)).toBe("192.0.2.11");
  });

  it("returns nothing for empty output", () => {
    expect(parseLsof("")).toEqual([]);
  });
});

describe("filterRows", () => {
  const rows = parseLsof(LSOF);
  it("filters by port prefix, PID, process name and protocol", () => {
    expect(filterRows(rows, "54", "all").map((r) => r.port)).toEqual([5432]);
    expect(filterRows(rows, "5", "all").map((r) => r.port)).toEqual([53, 5173, 5353, 5432]);
    expect(filterRows(rows, "762", "all").map((r) => r.command)).toEqual(["postgres"]);
    expect(filterRows(rows, "VITE", "all").map((r) => r.port)).toEqual([5173]);
    expect(filterRows(rows, "", "UDP").map((r) => r.port)).toEqual([53, 5353]);
  });

  it("tells whether a process still holds a port", () => {
    expect(stillListening(rows, 350, 3000)).toBe(true);
    expect(stillListening(rows, 350, 5432)).toBe(false);
  });
});
