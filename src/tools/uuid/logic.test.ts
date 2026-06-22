import { describe, it, expect } from "vitest";
import { generateUuids } from "./logic";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUuids", () => {
  it("generates the requested count of valid v4 UUIDs", () => {
    const ids = generateUuids(3);
    expect(ids).toHaveLength(3);
    ids.forEach((id) => expect(id).toMatch(V4));
    expect(new Set(ids).size).toBe(3);
  });
  it("clamps count to at least 1", () => {
    expect(generateUuids(0)).toHaveLength(1);
  });
});
