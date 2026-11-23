import { describe, it, expect } from "vitest";
import { toolMenuEntries } from "./toolMenu";

const texts = (state: Parameters<typeof toolMenuEntries>[0]) =>
  toolMenuEntries(state).map((e) => (e === "separator" ? "—" : `${e.text}${e.enabled ? "" : " (off)"}`));

describe("toolMenuEntries", () => {
  it("offers Add to Favorites for a plain tool", () => {
    expect(texts({ favorite: false })).toEqual(["Open", "—", "Add to Favorites"]);
  });

  it("offers Remove plus Move Up / Move Down in the Favorites list, off at the edges", () => {
    expect(texts({ favorite: true, favoritesPosition: { index: 0, count: 3 } })).toEqual([
      "Open",
      "—",
      "Remove from Favorites",
      "Move Up (off)",
      "Move Down",
    ]);
    expect(texts({ favorite: true, favoritesPosition: { index: 2, count: 3 } }).slice(-2)).toEqual(["Move Up", "Move Down (off)"]);
  });
});
