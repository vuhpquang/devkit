import { describe, it, expect } from "vitest";
import { encodeUrl, decodeUrl } from "./logic";

describe("url-codec", () => {
  it("encodes spaces and symbols", () => {
    expect(encodeUrl("a b&c")).toEqual({ ok: true, value: "a%20b%26c" });
  });
  it("decodes", () => {
    expect(decodeUrl("a%20b%26c")).toEqual({ ok: true, value: "a b&c" });
  });
  it("errors on malformed percent-encoding", () => {
    expect(decodeUrl("%E0%A4%A").ok).toBe(false);
  });
});
