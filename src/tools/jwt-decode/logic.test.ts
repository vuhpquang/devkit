import { describe, it, expect } from "vitest";
import { decodeJwt } from "./logic";

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
