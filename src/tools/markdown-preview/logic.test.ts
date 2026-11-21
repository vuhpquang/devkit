import { describe, it, expect } from "vitest";
import { renderMarkdown, countWords, isExternalLink } from "./logic";

describe("renderMarkdown", () => {
  it("renders GitHub-flavoured Markdown", () => {
    const html = renderMarkdown("# Title\n\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`code` and **bold**");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("strips scripts, handlers and javascript: links", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[x](javascript:alert(1))');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });
});

describe("countWords / isExternalLink", () => {
  it("counts words outside code fences", () => {
    expect(countWords("# Hello world\n\n```js\nconst a = 1\n```\n\nXin chào")).toBe(4);
    expect(countWords("")).toBe(0);
  });

  it("only treats http(s) and mailto as external", () => {
    expect(isExternalLink("https://vuhpquang.com")).toBe(true);
    expect(isExternalLink("mailto:a@b.c")).toBe(true);
    expect(isExternalLink("#section")).toBe(false);
    expect(isExternalLink(null)).toBe(false);
  });
});
