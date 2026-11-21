import { describe, it, expect } from "vitest";
import { addEntry, invalidLines, isHostName, parseHosts, removeLine, toggleEntry } from "./logic";

const FILE = `##
# Host Database
##
127.0.0.1\tlocalhost
255.255.255.255\tbroadcasthost
::1             localhost

127.0.0.1 api.test admin.test # local dev
# 10.0.0.5 staging.example.com
this is broken
`;

describe("parseHosts", () => {
  it("tells entries, disabled entries, comments, blanks and broken lines apart", () => {
    const p = parseHosts(FILE);
    expect(p.map((l) => l.kind)).toEqual(["comment", "comment", "comment", "entry", "entry", "entry", "blank", "entry", "entry", "invalid", "blank"]);
    expect(p[3]).toMatchObject({ ip: "127.0.0.1", names: ["localhost"], system: true, enabled: true });
    expect(p[7]).toMatchObject({ names: ["api.test", "admin.test"], note: "local dev", system: false, enabled: true });
    expect(p[8]).toMatchObject({ ip: "10.0.0.5", names: ["staging.example.com"], enabled: false });
  });
});

describe("editing", () => {
  it("comments an entry out and back in, leaving system lines alone", () => {
    const off = toggleEntry(FILE, 7);
    expect(off.split("\n")[7]).toBe("# 127.0.0.1 api.test admin.test # local dev");
    expect(toggleEntry(off, 7)).toBe(FILE);
    expect(toggleEntry(FILE, 8).split("\n")[8]).toBe("10.0.0.5 staging.example.com");
    expect(toggleEntry(FILE, 3)).toBe(FILE);
  });

  it("removes lines but never system entries", () => {
    expect(removeLine(FILE, 9)).not.toContain("this is broken");
    expect(removeLine(FILE, 5)).toBe(FILE);
  });

  it("appends a validated entry", () => {
    const r = addEntry(FILE, "127.0.0.1", "shop.test, www.shop.test");
    expect(r.ok && r.text.endsWith("127.0.0.1\tshop.test www.shop.test\n")).toBe(true);
    expect(addEntry(FILE, "127.0.0.300", "a.test")).toEqual({ ok: false, error: "“127.0.0.300” isn't an IP address." });
    expect(addEntry(FILE, "127.0.0.1", "bad name!")).toMatchObject({ ok: false });
    expect(addEntry(FILE, "127.0.0.1", "")).toMatchObject({ ok: false });
  });

  it("lists broken lines and validates host names", () => {
    expect(invalidLines(FILE).map((l) => l.index)).toEqual([9]);
    expect(isHostName("my-app.local")).toBe(true);
    expect(isHostName("-x")).toBe(false);
    expect(isHostName("a..b")).toBe(false);
  });
});
