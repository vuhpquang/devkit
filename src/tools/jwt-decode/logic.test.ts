import { describe, it, expect } from "vitest";
import { decodeJwt, timeClaims } from "./logic";

// {"alg":"HS256","typ":"JWT"} . {"sub":"123","name":"Jo"} . sig
const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjMiLCJuYW1lIjoiSm8ifQ." +
  "sig";

describe("decodeJwt", () => {
  it("decodes header and payload", () => {
    const r = decodeJwt(TOKEN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.header).toMatchObject({ alg: "HS256", typ: "JWT" });
      expect(r.payload).toMatchObject({ sub: "123", name: "Jo" });
    }
  });
  it("errors on a non-token", () => {
    expect(decodeJwt("not.a.jwt").ok).toBe(false);
  });
});

describe("timeClaims", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const t = now.getTime() / 1000;
  it("lists time claims and reports a live token", () => {
    const r = timeClaims({ iat: t - 60, exp: t + 3600, sub: "x" }, now);
    expect(r.claims.map((c) => c.claim)).toEqual(["iat", "exp"]);
    expect(r.state).toBe("valid");
  });
  it("reports expired, not-yet-valid and no-expiry tokens", () => {
    expect(timeClaims({ exp: t - 1 }, now).state).toBe("expired");
    expect(timeClaims({ nbf: t + 60, exp: t + 120 }, now).state).toBe("not-yet");
    expect(timeClaims({ sub: "x" }, now).state).toBe("no-expiry");
  });
});
