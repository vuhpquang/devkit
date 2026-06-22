import { describe, it, expect } from "vitest";
import { encodeBase64, decodeBase64 } from "./logic";

describe("base64", () => {
  it("encodes unicode", () => {
    expect(encodeBase64("héllo")).toEqual({ ok: true, value: "aMOpbGxv" });
  });
  it("round-trips", () => {
    const enc = encodeBase64("hello");
    expect(enc.ok && decodeBase64(enc.value)).toEqual({ ok: true, value: "hello" });
  });
  it("errors on invalid base64 decode", () => {
    expect(decodeBase64("@@@").ok).toBe(false);
  });
});
