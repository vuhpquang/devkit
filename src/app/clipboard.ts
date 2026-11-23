/** Guesses which tools fit what's on the clipboard (⌘K's "From clipboard" group). Pure. */

export interface ClipboardSuggestion {
  toolId: string;
  /** What the clipboard looks like, shown next to the tool: "JSON", "JWT", "Unix timestamp"… */
  label: string;
  /** TransformTool mode to open in (e.g. "decode"). */
  mode?: string;
}

/** Bigger than this is not inspected (and not offered). */
export const CLIPBOARD_MAX = 1_000_000;

const JWT = /^eyJ[\w-]*\.[\w-]+\.[\w-]*$/;
const UNIX = /^\d{10}(\d{3})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const PERCENT = /%[0-9A-Fa-f]{2}/;
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;
const SQL = /^(select|insert|update|delete|create|alter|drop|with)\s/i;
const CRON_FIELD = /^[\d*/,?LW#-]+$|^[A-Za-z]{3}(-[A-Za-z]{3})?$/;
const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR = /^(rgb|rgba|hsl|hsla|oklch)\(\s*[\d.%\s,/-]+\)$/i;
const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i;
const JS_OBJECT = /^[{[][\s\S]*[}\]]$/;

function base64urlJson(part: string): boolean {
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const v: unknown = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return !!v && typeof v === "object";
  } catch {
    return false;
  }
}

/** Decodes Base64 to text; null unless it is valid and reads as mostly printable UTF-8. */
function base64Text(s: string): string | null {
  if (s.length < 8 || !BASE64.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const printable = [...text].filter((c) => c >= " " || c === "\n" || c === "\r" || c === "\t").length;
    return text.length > 0 && printable / text.length > 0.95 ? text : null;
  } catch {
    return null;
  }
}

function isJson(s: string): boolean {
  if (!/^[{[]/.test(s)) return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

function isCron(s: string): boolean {
  const fields = s.split(/\s+/);
  return (fields.length === 5 || fields.length === 6) && fields.every((f) => CRON_FIELD.test(f)) && /[*/]/.test(s);
}

export function detectClipboard(raw: string): ClipboardSuggestion[] {
  const s = raw.trim();
  if (!s || s.length > CLIPBOARD_MAX) return [];
  const out: ClipboardSuggestion[] = [];
  const add = (toolId: string, label: string, mode?: string) => out.push(mode ? { toolId, label, mode } : { toolId, label });

  if (JWT.test(s) && base64urlJson(s.split(".")[0])) add("jwt-decode", "JWT");
  else if (isJson(s)) {
    add("json-format", "JSON");
    add("json-yaml", "JSON", "to-yaml");
    if (/^\[\s*\{/.test(s)) add("json-csv", "JSON array", "to-csv");
  } else if (UNIX.test(s)) add("timestamp", s.length === 13 ? "Unix timestamp (ms)" : "Unix timestamp");
  else if (ISO_DATE.test(s)) add("timestamp", "Date");
  else if (HEX_COLOR.test(s) || FUNC_COLOR.test(s)) add("color-converter", "Colour");
  else if (isCron(s)) add("cron-parser", "Cron expression");
  else if (/^<[\w?!]/.test(s) && />$/.test(s)) add("xml-format", "XML");
  else if (SQL.test(s)) add("sql-format", "SQL");
  else if (JS_OBJECT.test(s)) add("js-to-json", "JavaScript object");
  else {
    if (PERCENT.test(s)) {
      try {
        if (decodeURIComponent(s) !== s) add("url-codec", "Percent-encoded text", "decode");
      } catch {
        /* not valid percent-encoding */
      }
    }
    if (ENTITY.test(s)) add("html-entities", "HTML entities", "decode");
    if (!/\s/.test(s) && base64Text(s) !== null) add("base64", "Base64", "decode");
  }
  return out;
}
