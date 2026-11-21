import { describe, it, expect } from "vitest";
import {
  maskToCidr,
  parseDefaultRoute,
  parseHardwarePorts,
  parseIfconfig,
  parseScutilDns,
  parseSsid,
  summarize,
  visibleInterfaces,
} from "./logic";
import { RAW } from "./fixtures";

describe("maskToCidr", () => {
  it("reads hex and dotted masks", () => {
    expect(maskToCidr("0xffffff00")).toBe(24);
    expect(maskToCidr("0xfffffe00")).toBe(23);
    expect(maskToCidr("0xffffffff")).toBe(32);
    expect(maskToCidr("0xff000000")).toBe(8);
    expect(maskToCidr("255.255.240.0")).toBe(20);
    expect(maskToCidr("nope")).toBe(0);
  });
});

describe("parseIfconfig", () => {
  const ports = parseHardwarePorts(RAW.hardware_ports);
  const list = parseIfconfig(RAW.ifconfig, ports);
  const by = (n: string) => list.find((i) => i.name === n)!;

  it("finds every interface with its flags, MTU and status", () => {
    expect(list.map((i) => i.name)).toEqual(["lo0", "gif0", "en4", "en0", "en8", "bridge0", "utun3"]);
    expect(by("en0")).toMatchObject({ active: true, up: true, mtu: 1500, mac: "02:00:00:00:00:01", port: "Wi-Fi", virtual: false });
    expect(by("en4").active).toBe(false);
    expect(by("gif0").up).toBe(false);
  });

  it("reads IPv4 with CIDR and IPv6 with link-local / temporary markers", () => {
    expect(by("en0").ipv4).toEqual([{ address: "192.0.2.11", cidr: 24, broadcast: "192.0.2.255" }]);
    expect(by("en0").ipv6).toEqual([
      { address: "fe80::1890:df4a:258e:9ab1", prefix: 64, linkLocal: true, temporary: false },
      { address: "2001:db8:40c0::12", prefix: 64, linkLocal: false, temporary: false },
      { address: "2001:db8:40c0::34", prefix: 64, linkLocal: false, temporary: true },
    ]);
    expect(by("en8").ipv4[0].cidr).toBe(23);
  });

  it("marks loopback, tunnels and bridges as virtual; loopback counts as active", () => {
    expect(by("lo0")).toMatchObject({ virtual: true, active: true });
    expect(by("utun3").virtual).toBe(true);
    expect(by("bridge0").virtual).toBe(true);
    expect(by("en8").virtual).toBe(false);
  });

  it("shows only active interfaces with addresses; virtual ones on request", () => {
    expect(visibleInterfaces(list, false).map((i) => i.name)).toEqual(["en0", "en8"]);
    expect(visibleInterfaces(list, true).map((i) => i.name)).toEqual(["lo0", "en0", "en8"]);
  });
});

describe("other parsers", () => {
  it("reads the default route", () => {
    expect(parseDefaultRoute(RAW.route)).toEqual({ gateway: "192.0.2.1", iface: "en0" });
    expect(parseDefaultRoute("route: writing to routing socket: not in table")).toEqual({ gateway: undefined, iface: undefined });
  });

  it("lists DNS servers once, resolver #1 first, ignoring scoped queries", () => {
    expect(parseScutilDns(RAW.scutil_dns)).toEqual(["1.1.1.1", "8.8.8.8", "192.0.2.53"]);
  });

  it("maps devices to hardware port names", () => {
    expect([...parseHardwarePorts(RAW.hardware_ports)]).toEqual([
      ["en8", "AX88179B"],
      ["bridge0", "Thunderbolt Bridge"],
      ["en0", "Wi-Fi"],
    ]);
  });

  it("reads or reports the SSID", () => {
    expect(parseSsid(RAW.wifi_summary)).toEqual({ kind: "hidden" });
    expect(parseSsid("  SSID : Office Guest\n")).toEqual({ kind: "name", value: "Office Guest" });
    expect(parseSsid("")).toEqual({ kind: "none" });
  });

  it("summarises with the default-route interface as primary", () => {
    const s = summarize(RAW);
    expect(s.hostname).toBe("dev-mac.local");
    expect(s.primary?.name).toBe("en0");
    expect(s.gateway).toBe("192.0.2.1");
    expect(s.dns[0]).toBe("1.1.1.1");
  });

  it("falls back to the first active physical interface without a default route", () => {
    expect(summarize({ ...RAW, route: "" }).primary?.name).toBe("en0");
  });
});
