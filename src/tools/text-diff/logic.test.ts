import { describe, it, expect } from "vitest";
import { diffText } from "./logic";

describe("diffText", () => {
  it("marks added and removed lines", () => {
    const parts = diffText("a\nb\n", "a\nc\n");
    const removed = parts.find((p) => p.removed);
    const added = parts.find((p) => p.added);
    expect(removed?.value).toContain("b");
    expect(added?.value).toContain("c");
  });
});
