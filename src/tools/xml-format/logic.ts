import xmlFormat from "xml-formatter";

export type Result =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function formatXml(input: string): Result {
  try {
    // Validate first — xml-formatter is lenient about mismatched tags.
    const doc = new DOMParser().parseFromString(input, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return { ok: false, error: parseError.textContent?.trim() || "Invalid XML" };
    }
    return { ok: true, value: xmlFormat(input, { indentation: "  ", collapseContent: true }) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
