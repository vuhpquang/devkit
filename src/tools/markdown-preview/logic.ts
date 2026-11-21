import { marked } from "marked";
import DOMPurify from "dompurify";

/** Markdown (GitHub flavoured) → sanitized HTML. Scripts, event handlers and javascript: URLs are stripped. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true }) as string;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/** Word count of the source, ignoring Markdown punctuation. */
export function countWords(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()!|]/g, " ")
    .match(/[\p{L}\p{N}]+/gu);
  return words ? words.length : 0;
}

/** Links worth opening outside the app: http(s) and mailto. Anything else (anchors, relative) is ignored. */
export function isExternalLink(href: string | null): href is string {
  return !!href && /^(https?:|mailto:)/i.test(href);
}
