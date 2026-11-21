import { describe, it, expect, beforeEach } from "vitest";
import { activeResolvers, BUILT_IN, isIp, loadCustom, matchPreset, newCustom, parseServers, saveCustom } from "./logic";

describe("isIp", () => {
  it("accepts IPv4 and IPv6, rejects the rest", () => {
    for (const ok of ["8.8.8.8", "119.29.29.29", "2001:4860:4860::8888", "::1"]) expect(isIp(ok), ok).toBe(true);
    for (const bad of ["256.1.1.1", "1.1.1", "dns.google", "8.8.8.8; rm", "", "1.1.1.1.1"]) expect(isIp(bad), bad).toBe(false);
  });
});

describe("parseServers", () => {
  it("splits on spaces, commas and semicolons and drops duplicates", () => {
    expect(parseServers("1.1.1.1, 1.0.0.1  1.1.1.1;2606:4700:4700::1111")).toEqual({
      ok: true,
      servers: ["1.1.1.1", "1.0.0.1", "2606:4700:4700::1111"],
    });
  });
  it("names the bad entry", () => {
    expect(parseServers("1.1.1.1 dns.google")).toEqual({ ok: false, error: "“dns.google” isn't an IP address." });
    expect(parseServers("  ").ok).toBe(false);
    expect(parseServers("1.1.1.1 1.1.1.2 1.1.1.3 1.1.1.4 1.1.1.5 1.1.1.6 1.1.1.7").ok).toBe(false);
  });
});

describe("activeResolvers", () => {
  it("reads resolver #1 only", () => {
    const scutil = `DNS configuration

resolver #1
  nameserver[0] : 1.1.1.1
  nameserver[1] : 1.0.0.1
  if_index : 14 (en0)
  reach    : 0x00000002 (Reachable)

resolver #2
  domain   : local
  options  : mdns

DNS configuration (for scoped queries)

resolver #1
  nameserver[0] : 1.1.1.1
`;
    expect(activeResolvers(scutil)).toEqual(["1.1.1.1", "1.0.0.1"]);
    expect(activeResolvers("")).toEqual([]);
  });
});

describe("presets", () => {
  beforeEach(() => localStorage.clear());

  it("ships Automatic, Google, Cloudflare and DNSPod 119.29.29.29", () => {
    expect(BUILT_IN.map((p) => p.name)).toEqual(["Automatic", "Google", "Cloudflare", "DNSPod"]);
    expect(BUILT_IN.find((p) => p.id === "dnspod")!.servers).toContain("119.29.29.29");
  });

  it("matches the current servers regardless of order", () => {
    expect(matchPreset(["8.8.4.4", "8.8.8.8"], BUILT_IN)?.id).toBe("google");
    expect(matchPreset([], BUILT_IN)?.id).toBe("auto");
    expect(matchPreset(["9.9.9.9"], BUILT_IN)).toBeUndefined();
  });

  it("creates, saves and reloads custom presets", () => {
    const r = newCustom("Quad9", "9.9.9.9 149.112.112.112", []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    saveCustom([r.preset]);
    expect(loadCustom()).toEqual([{ ...r.preset, custom: true }]);
    expect(newCustom("google", "1.2.3.4", []).ok).toBe(false);
    expect(newCustom("", "1.2.3.4", []).ok).toBe(false);
  });

  it("drops stored presets with bad servers", () => {
    localStorage.setItem("devkit.dns.presets", JSON.stringify([{ id: "x", name: "X", servers: ["evil; rm"] }, { id: "y", name: "Y", servers: ["9.9.9.9"] }]));
    expect(loadCustom().map((p) => p.id)).toEqual(["y"]);
  });
});
