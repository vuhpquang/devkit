import { describe, it, expect } from "vitest";
import { parseUrl } from "./logic";

const ok = (s: string) => {
  const r = parseUrl(s);
  if (!r.ok) throw new Error(r.error);
  return r.url;
};

describe("parseUrl", () => {
  it("splits a full URL into its parts", () => {
    const u = ok("https://user:p%40ss@api.example.com:8443/v1/search?q=%C4%91%C3%A0+n%E1%BA%B5ng&tag=a&tag=b#results");
    expect(u.protocol).toBe("https:");
    expect(u.username).toBe("user");
    expect(u.password).toBe("p@ss");
    expect(u.host).toBe("api.example.com:8443");
    expect(u.hostname).toBe("api.example.com");
    expect(u.port).toBe("8443");
    expect(u.defaultPort).toBe("443");
    expect(u.pathname).toBe("/v1/search");
    expect(u.hash).toBe("#results");
    expect(u.origin).toBe("https://api.example.com:8443");
    expect(u.params).toEqual([
      ["q", "đà nẵng"],
      ["tag", "a"],
      ["tag", "b"],
    ]);
    expect(u.assumedScheme).toBe(false);
  });

  it("assumes https:// when the scheme is missing", () => {
    const u = ok("example.com/path?x=1");
    expect(u.protocol).toBe("https:");
    expect(u.hostname).toBe("example.com");
    expect(u.assumedScheme).toBe(true);
    expect(ok("localhost:3000/api").port).toBe("3000");
  });

  it("leaves the port empty when it is the default", () => {
    const u = ok("http://example.com:80/");
    expect(u.port).toBe("");
    expect(u.defaultPort).toBe("80");
  });

  it("rejects empty and invalid input", () => {
    expect(parseUrl("").ok).toBe(false);
    expect(parseUrl("http://").ok).toBe(false);
    expect(parseUrl("not a url").ok).toBe(false);
  });

  it("parses non-http schemes", () => {
    const u = ok("mailto:someone@example.com?subject=Hi");
    expect(u.protocol).toBe("mailto:");
    expect(u.params).toEqual([["subject", "Hi"]]);
    expect(u.origin).toBe("");
  });
});
