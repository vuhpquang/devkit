import { describe, it, expect } from "vitest";
import { splitWords, convertAll } from "./logic";

const get = (input: string, label: string) => convertAll(input).find((r) => r.label === label)!.value;

describe("splitWords", () => {
  it("splits camelCase, PascalCase and acronyms", () => {
    expect(splitWords("XMLHttpRequest")).toEqual(["xml", "http", "request"]);
    expect(splitWords("getUserID")).toEqual(["get", "user", "id"]);
    expect(splitWords("parseHTMLString")).toEqual(["parse", "html", "string"]);
  });

  it("splits on separators and punctuation", () => {
    expect(splitWords("  hello_world-foo.bar/baz  qux!")).toEqual(["hello", "world", "foo", "bar", "baz", "qux"]);
  });

  it("keeps digits with the preceding word", () => {
    expect(splitWords("utf8Encoder")).toEqual(["utf8", "encoder"]);
    expect(splitWords("version2Beta")).toEqual(["version2", "beta"]);
    expect(splitWords("item 42")).toEqual(["item", "42"]);
  });

  it("handles Vietnamese and other unicode letters", () => {
    expect(splitWords("Xin chào Thế Giới")).toEqual(["xin", "chào", "thế", "giới"]);
    expect(splitWords("đườngPhố")).toEqual(["đường", "phố"]);
  });

  it("returns nothing for empty or symbol-only input", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords("--__..")).toEqual([]);
  });
});

describe("convertAll", () => {
  it("produces every case", () => {
    const s = "XMLHttpRequest handler";
    expect(get(s, "camelCase")).toBe("xmlHttpRequestHandler");
    expect(get(s, "PascalCase")).toBe("XmlHttpRequestHandler");
    expect(get(s, "snake_case")).toBe("xml_http_request_handler");
    expect(get(s, "CONSTANT_CASE")).toBe("XML_HTTP_REQUEST_HANDLER");
    expect(get(s, "kebab-case")).toBe("xml-http-request-handler");
    expect(get(s, "Train-Case")).toBe("Xml-Http-Request-Handler");
    expect(get(s, "dot.case")).toBe("xml.http.request.handler");
    expect(get(s, "path/case")).toBe("xml/http/request/handler");
    expect(get(s, "Title Case")).toBe("Xml Http Request Handler");
    expect(get(s, "Sentence case")).toBe("Xml http request handler");
  });

  it("keeps punctuation for lowercase / UPPERCASE", () => {
    expect(get("Hello, World!", "lowercase")).toBe("hello, world!");
    expect(get("chào bạn", "UPPERCASE")).toBe("CHÀO BẠN");
  });

  it("capitalizes unicode words", () => {
    expect(get("đường phố", "PascalCase")).toBe("ĐườngPhố");
  });
});
