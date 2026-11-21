/**
 * Splits text into lower-case words: separators and punctuation break words, so do camelCase
 * boundaries and the end of an acronym (XMLHttpRequest → xml, http, request). Digits stay with the
 * word before them (utf8, version2). Works on any script (Vietnamese diacritics included).
 */
export function splitWords(input: string): string[] {
  return input
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w: string) => {
  const [first = "", ...rest] = Array.from(w);
  return first.toUpperCase() + rest.join("");
};

export interface CaseRow {
  label: string;
  value: string;
}

/** Every supported case for one input. lowercase/UPPERCASE keep the original text's punctuation. */
export function convertAll(input: string): CaseRow[] {
  const w = splitWords(input);
  const join = (sep: string, f: (x: string, i: number) => string = (x) => x) => w.map(f).join(sep);
  return [
    { label: "camelCase", value: join("", (x, i) => (i === 0 ? x : cap(x))) },
    { label: "PascalCase", value: join("", cap) },
    { label: "snake_case", value: join("_") },
    { label: "CONSTANT_CASE", value: join("_", (x) => x.toUpperCase()) },
    { label: "kebab-case", value: join("-") },
    { label: "Train-Case", value: join("-", cap) },
    { label: "dot.case", value: join(".") },
    { label: "path/case", value: join("/") },
    { label: "Title Case", value: join(" ", cap) },
    { label: "Sentence case", value: join(" ", (x, i) => (i === 0 ? cap(x) : x)) },
    { label: "lowercase", value: input.toLowerCase() },
    { label: "UPPERCASE", value: input.toUpperCase() },
  ];
}
