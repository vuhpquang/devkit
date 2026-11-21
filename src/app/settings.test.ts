import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_SETTINGS, initialToolId, isToolSearchable, isToolVisible, parseSettings, toggledSidebar } from "./settings";
import { getToolById } from "../tools/registry";

describe("parseSettings", () => {
  it("gives defaults for nothing, garbage or a non-object", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{oops")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[1,2]")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid fields and replaces invalid ones", () => {
    const s = parseSettings(
      JSON.stringify({ sidebar: "autohide", startup: "nope", editorFontSize: 99, hiddenTools: ["uuid", 4], wrapLines: true, extra: 1 }),
    );
    expect(s.sidebar).toBe("autohide");
    expect(s.startup).toBe("last");
    expect(s.editorFontSize).toBe(13);
    expect(s.hiddenTools).toEqual(["uuid"]);
    expect(s.wrapLines).toBe(true);
    expect(s).not.toHaveProperty("extra");
  });
});

describe("tool visibility", () => {
  const uuid = getToolById("uuid")!;
  const whois = getToolById("whois")!;

  it("hides tools listed as hidden but keeps them searchable", () => {
    const s = { ...DEFAULT_SETTINGS, hiddenTools: ["uuid"] };
    expect(isToolVisible(uuid, s)).toBe(false);
    expect(isToolSearchable(uuid, s)).toBe(true);
  });

  it("switching online tools off removes them everywhere", () => {
    const s = { ...DEFAULT_SETTINGS, showOnlineTools: false };
    expect(isToolVisible(whois, s)).toBe(false);
    expect(isToolSearchable(whois, s)).toBe(false);
    expect(isToolVisible(uuid, s)).toBe(true);
  });
});

describe("sidebar toggle", () => {
  it("collapses a shown sidebar and pins a hidden or auto-hiding one", () => {
    expect(toggledSidebar("shown")).toBe("hidden");
    expect(toggledSidebar("hidden")).toBe("shown");
    expect(toggledSidebar("autohide")).toBe("shown");
  });
});

describe("startup", () => {
  beforeEach(() => localStorage.clear());
  it("reopens the last tool unless set to start on the home grid", () => {
    expect(initialToolId("uuid")).toBe("uuid");
    localStorage.setItem("devkit.settings", JSON.stringify({ startup: "home" }));
    expect(initialToolId("uuid")).toBeNull();
  });
});
