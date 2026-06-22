import { describe, it, expect } from "vitest";
import { generateLorem } from "./logic";

describe("generateLorem", () => {
  it("returns the requested number of paragraphs", () => {
    const text = generateLorem(3);
    expect(text.split("\n\n")).toHaveLength(3);
  });
  it("starts with 'Lorem ipsum'", () => {
    expect(generateLorem(1).startsWith("Lorem ipsum")).toBe(true);
  });
  it("clamps to at least 1 paragraph", () => {
    expect(generateLorem(0).split("\n\n")).toHaveLength(1);
  });
});
