import { describe, it, expect } from "vitest";
import { hashAll } from "./logic";

describe("hashAll", () => {
  it("hashes the empty string with known digests", () => {
    const r = hashAll("");
    expect(r.md5).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(r.sha1).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(r.sha256).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
