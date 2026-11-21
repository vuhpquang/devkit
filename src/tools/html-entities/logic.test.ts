import { describe, it, expect } from "vitest";
import { encodeEntities, decodeEntities } from "./logic";

const dec = (s: string) => {
  const r = decodeEntities(s);
  return r.ok ? r.value : null;
};

describe("encodeEntities", () => {
  it("escapes the five HTML-special characters", () => {
    expect(encodeEntities(`<a href="x">Tom & 'Jerry'</a>`)).toEqual({
      ok: true,
      value: "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    });
  });

  it("leaves non-ASCII alone unless asked", () => {
    expect(encodeEntities("chào ©")).toEqual({ ok: true, value: "chào ©" });
    expect(encodeEntities("chào © 😀", true)).toEqual({ ok: true, value: "ch&#224;o &#169; &#128512;" });
  });
});

describe("decodeEntities", () => {
  it("decodes named entities", () => {
    expect(dec("&lt;p&gt;Fish &amp; Chips&hellip; &copy; 2026&nbsp;&mdash;&nbsp;&euro;5")).toBe("<p>Fish & Chips… © 2026 — €5");
    expect(dec("caf&eacute; na&iuml;ve &Uuml;ber &agrave;")).toBe("café naïve Über à");
  });

  it("decodes decimal and hex entities, including astral code points", () => {
    expect(dec("&#169; &#xA9; &#X1F600;")).toBe("© © 😀");
  });

  it("keeps unknown or malformed entities and replaces invalid code points", () => {
    expect(dec("&notanentity; & alone &amp")).toBe("&notanentity; & alone &amp");
    expect(dec("&#0; &#xD800; &#x110000;")).toBe("� � �");
  });

  it("round-trips with encode", () => {
    const s = `<b class="x">"Đà Nẵng" & 'Huế' 😀</b>`;
    const enc = encodeEntities(s, true);
    expect(enc.ok && dec(enc.value)).toBe(s);
  });
});
