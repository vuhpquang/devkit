/**
 * SVG ↔ React converters, written by hand (no SVGR / Babel): SVG → React component, SVG → React Native
 * (react-native-svg) component, and JSX/TSX → plain SVG.
 */

export type Mode = "react" | "native" | "svg";

export interface Options {
  /** Component name; cleaned to PascalCase. */
  name: string;
  typescript: boolean;
  exportKind: "default" | "named";
  spreadProps: boolean;
  /** Replace fixed width/height with a `size` prop (default 24). */
  sizeProps: boolean;
  /** fill / stroke colours → currentColor (none, transparent and url(#…) are kept). */
  currentColor: boolean;
  memo: boolean;
  /** React web only. */
  forwardRef: boolean;
  keepTitle: boolean;
  optimize: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  name: "Icon",
  typescript: true,
  exportKind: "default",
  spreadProps: true,
  sizeProps: true,
  currentColor: false,
  memo: false,
  forwardRef: false,
  keepTitle: false,
  optimize: false,
};

export type Result<T> = { ok: true; value: T; notes: string[] } | { ok: false; error: string };

/* ------------------------------------------------------------- helpers */

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** "my-icon.svg", "arrow_left 2" → "MyIcon", "ArrowLeft2"; falls back to "Icon". */
export function componentName(raw: string): string {
  const base = raw.replace(/\.[a-z0-9]+$/i, "");
  const words = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  if (!name) return "Icon";
  if (/^\d/.test(name)) name = `Svg${name}`;
  return name;
}

/** CSS declarations → [camelCase key, value] pairs. `-webkit-x` → `WebkitX`. */
export function parseStyle(style: string): [string, string][] {
  const out: [string, string][] = [];
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k || !v) continue;
    const key = k.startsWith("--") ? k : camel(k.replace(/^-(webkit|moz|ms|o)-/, (_, p: string) => `${p[0].toUpperCase()}${p.slice(1)}-`));
    out.push([key, v]);
  }
  return out;
}

const jsString = (s: string) => JSON.stringify(s);
const styleObject = (pairs: [string, string][]) =>
  `{{ ${pairs.map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : jsString(k)}: ${jsString(v)}`).join(", ")} }}`;

const KEEP_COLOR = /^(none|transparent|currentcolor|inherit|url\(.*\))$/i;

/** Attribute names React wants spelled differently. */
const TO_JSX: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  "xlink:href": "xlinkHref",
  "xlink:title": "xlinkTitle",
  "xlink:show": "xlinkShow",
  "xlink:role": "xlinkRole",
  "xlink:arcrole": "xlinkArcrole",
  "xlink:actuate": "xlinkActuate",
  "xlink:type": "xlinkType",
  "xml:space": "xmlSpace",
  "xml:lang": "xmlLang",
  "xml:base": "xmlBase",
  "xmlns:xlink": "xmlnsXlink",
};
const FROM_JSX: Record<string, string> = Object.fromEntries(Object.entries(TO_JSX).map(([a, b]) => [b, a]));

/** JSX attribute name for an SVG attribute; null = drop it (editor namespaces like inkscape:, sodipodi:). */
export function jsxAttrName(attr: string): string | null {
  if (TO_JSX[attr]) return TO_JSX[attr];
  if (attr.startsWith("data-") || attr.startsWith("aria-")) return attr;
  if (attr.includes(":")) return null;
  return camel(attr);
}

/** SVG attributes that really are camelCase and must stay so going back from JSX. */
const CAMEL_SVG = new Set(
  (
    "viewBox preserveAspectRatio gradientUnits gradientTransform patternUnits patternContentUnits patternTransform " +
    "clipPathUnits maskUnits maskContentUnits markerWidth markerHeight markerUnits refX refY spreadMethod startOffset " +
    "textLength lengthAdjust baseFrequency numOctaves stdDeviation tableValues kernelMatrix kernelUnitLength filterUnits " +
    "primitiveUnits pathLength viewTarget zoomAndPan attributeName attributeType calcMode keyTimes keySplines keyPoints " +
    "repeatCount repeatDur systemLanguage requiredFeatures requiredExtensions edgeMode diffuseConstant specularConstant " +
    "specularExponent surfaceScale limitingConeAngle pointsAtX pointsAtY pointsAtZ targetX targetY xChannelSelector " +
    "yChannelSelector stitchTiles preserveAlpha baseProfile"
  ).split(" "),
);

/** SVG attribute name for a JSX attribute; null = drop it (ref, key). */
export function svgAttrName(attr: string): string | null {
  if (attr === "ref" || attr === "key") return null;
  if (FROM_JSX[attr]) return FROM_JSX[attr];
  if (attr.startsWith("data-") || attr.startsWith("aria-") || CAMEL_SVG.has(attr)) return attr;
  return kebab(attr);
}

/* --------------------------------------------------- React Native names */

const RN_NAMES: Record<string, string> = {
  svg: "Svg",
  path: "Path",
  g: "G",
  circle: "Circle",
  rect: "Rect",
  line: "Line",
  polyline: "Polyline",
  polygon: "Polygon",
  ellipse: "Ellipse",
  defs: "Defs",
  lineargradient: "LinearGradient",
  radialgradient: "RadialGradient",
  stop: "Stop",
  clippath: "ClipPath",
  mask: "Mask",
  use: "Use",
  text: "Text",
  tspan: "TSpan",
  textpath: "TextPath",
  symbol: "Symbol",
  pattern: "Pattern",
  image: "Image",
  marker: "Marker",
};
/** Back from react-native-svg names (and the lowercase-with-capitals SVG element names). */
const SVG_ELEMENT: Record<string, string> = {
  Svg: "svg",
  ...Object.fromEntries(
    Object.entries(RN_NAMES)
      .filter(([k]) => k !== "svg")
      .map(([k, v]) => [v, ({ lineargradient: "linearGradient", radialgradient: "radialGradient", clippath: "clipPath", textpath: "textPath" } as Record<string, string>)[k] ?? k]),
  ),
};

/* ------------------------------------------------------------ SVG → JSX */

interface Ctx {
  mode: "react" | "native";
  opts: Options;
  notes: Set<string>;
  usedRn: Set<string>;
}

function attrValueJsx(v: string): string {
  const collapsed = v.replace(/\s+/g, " ").trim();
  return collapsed.includes('"') ? `{${jsString(collapsed)}}` : `"${collapsed}"`;
}

function textJsx(t: string): string | null {
  const s = t.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return /[{}<>]/.test(s) ? `{${jsString(s)}}` : s;
}

function renderElement(el: Element, depth: number, ctx: Ctx, isRoot: boolean): string | null {
  const local = el.localName;
  const lower = local.toLowerCase();
  if (lower === "metadata" || (lower === "title" && !ctx.opts.keepTitle)) return null;
  if (el.namespaceURI && el.namespaceURI !== "http://www.w3.org/2000/svg") return null; // sodipodi:namedview etc.

  let tag = local;
  if (ctx.mode === "native") {
    const rn = RN_NAMES[lower];
    if (!rn) {
      ctx.notes.add(`<${local}> has no react-native-svg equivalent and was left out`);
      return null;
    }
    tag = rn;
    ctx.usedRn.add(rn);
  }

  const attrs: string[] = [];
  let width: string | null = null;
  let height: string | null = null;
  let hasViewBox = false;
  for (const a of Array.from(el.attributes)) {
    let name = a.name;
    let value = a.value;
    if (isRoot && (name === "width" || name === "height")) {
      if (name === "width") width = value;
      else height = value;
      if (ctx.opts.sizeProps) continue;
    }
    if (name === "viewBox") hasViewBox = true;
    if (ctx.mode === "native" && (name === "class" || name.startsWith("data-") || name.startsWith("aria-") || name.startsWith("xmlns"))) continue;
    if (ctx.opts.currentColor && (name === "fill" || name === "stroke") && !KEEP_COLOR.test(value.trim())) value = "currentColor";
    if (name === "style") {
      let pairs = parseStyle(value);
      if (ctx.opts.currentColor) pairs = pairs.map(([k, v]) => ((k === "fill" || k === "stroke") && !KEEP_COLOR.test(v) ? [k, "currentColor"] : [k, v]));
      if (pairs.length) attrs.push(`style=${styleObject(pairs)}`);
      continue;
    }
    const jsxName = jsxAttrName(name);
    if (!jsxName) continue;
    name = jsxName;
    attrs.push(`${name}=${attrValueJsx(value)}`);
  }
  if (isRoot && ctx.opts.sizeProps) {
    // Keep the drawing's coordinate system when width/height go away.
    const w = parseFloat(width ?? "");
    const h = parseFloat(height ?? "");
    if (!hasViewBox && w > 0 && h > 0) attrs.push(`viewBox="0 0 ${w} ${h}"`);
    attrs.push("width={size}", "height={size}");
  }
  if (isRoot && ctx.opts.forwardRef && ctx.mode === "react") attrs.push("ref={ref}");
  if (isRoot && ctx.opts.spreadProps) attrs.push("{...props}");

  const pad = "  ".repeat(depth);
  const inline = `${pad}<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  const open = inline.length <= 100 ? inline : `${pad}<${tag}\n${attrs.map((a) => `${pad}  ${a}`).join("\n")}\n${pad}`;

  const children: string[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 1) {
      const c = renderElement(node as Element, depth + 1, ctx, false);
      if (c) children.push(c);
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      const t = textJsx(node.textContent ?? "");
      if (t) children.push(`${pad}  ${t}`);
    }
  }
  const multiline = open.endsWith("\n" + pad);
  if (!children.length) return multiline ? `${open}/>` : `${open} />`;
  return `${open}>\n${children.join("\n")}\n${pad}</${tag}>`;
}

/** Parses SVG markup; errors say what's wrong. */
export function parseSvg(svg: string): Result<Element> {
  const text = svg.trim();
  if (!text) return { ok: false, error: "Paste SVG markup or open an .svg file." };
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) {
    const msg = (err.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    return { ok: false, error: `Not valid SVG: ${msg || "the markup doesn't parse"}` };
  }
  const root = doc.documentElement;
  if (!root || root.localName !== "svg") return { ok: false, error: "The markup's root element isn't <svg>." };
  return { ok: true, value: root, notes: [] };
}

/** SVG markup → a React (web) or react-native-svg component. */
export function svgToComponent(svg: string, mode: "react" | "native", options: Partial<Options> = {}): Result<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parsed = parseSvg(svg);
  if (!parsed.ok) return parsed;
  const ctx: Ctx = { mode, opts, notes: new Set(), usedRn: new Set() };
  const jsx = renderElement(parsed.value, 2, ctx, true)!;
  const name = componentName(opts.name);
  const ts = opts.typescript;
  const native = mode === "native";
  const useRef = opts.forwardRef && !native;

  const propsType = native ? "SvgProps" : "SVGProps<SVGSVGElement>";
  const fullType = opts.sizeProps ? `${propsType} & { size?: number | string }` : propsType;
  const params = opts.sizeProps ? (opts.spreadProps ? "{ size = 24, ...props }" : "{ size = 24 }") : opts.spreadProps ? "props" : useRef ? "_props" : "";
  const typedParams = ts && params ? `${params}: ${fullType}` : params;

  const reactImports: string[] = [];
  if (opts.memo) reactImports.push("memo");
  if (useRef) reactImports.push("forwardRef");

  const lines: string[] = [];
  if (native) {
    const named = [...ctx.usedRn].filter((n) => n !== "Svg").sort();
    if (ts) named.push("type SvgProps");
    if (reactImports.length) lines.push(`import { ${reactImports.join(", ")} } from "react";`);
    lines.push(`import Svg${named.length ? `, { ${named.join(", ")} }` : ""} from "react-native-svg";`);
  } else {
    const parts = [...reactImports];
    if (ts) parts.push("type SVGProps");
    if (parts.length) lines.push(`import { ${parts.join(", ")} } from "react";`);
  }
  lines.push("");
  if (ts && useRef) lines.push(`type Props = ${fullType};`, "");

  const body = `(\n${jsx}\n)`;
  // With forwardRef the generic carries the types, so the parameters stay untyped.
  const value = useRef
    ? `forwardRef${ts ? `<SVGSVGElement, Props>` : ""}((${params || "_props"}, ref) => ${body})`
    : `(${typedParams}) => ${body}`;
  const baseName = opts.memo ? `${name}Base` : name;
  if (opts.memo) {
    lines.push(`const ${baseName} = ${value};`, "");
    if (useRef) lines.push(`${baseName}.displayName = ${jsString(name)};`, "");
    lines.push(opts.exportKind === "named" ? `export const ${name} = memo(${baseName});` : `const ${name} = memo(${baseName});\n\nexport default ${name};`);
  } else {
    lines.push(`${opts.exportKind === "named" ? "export " : ""}const ${name} = ${value};`, "");
    if (useRef) lines.push(`${name}.displayName = ${jsString(name)};`, "");
    if (opts.exportKind === "default") lines.push(`export default ${name};`);
  }
  if (opts.forwardRef && native) ctx.notes.add("forwardRef is for React web; left out for React Native");
  return { ok: true, value: lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n", notes: [...ctx.notes] };
}

/* ------------------------------------------------------------ JSX → SVG */

interface JNode {
  tag: string;
  attrs: [string, string][];
  children: (JNode | string)[];
}

class JsxParser {
  i = 0;
  dropped: string[] = [];
  constructor(private s: string) {}

  private ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  /** Reads a `{…}` block (balanced, strings and template literals skipped); returns the inner text. */
  private braces(): string {
    const start = this.i;
    let depth = 0;
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (c === '"' || c === "'" || c === "`") {
        this.i++;
        while (this.i < this.s.length && this.s[this.i] !== c) this.i += this.s[this.i] === "\\" ? 2 : 1;
      } else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          this.i++;
          return this.s.slice(start + 1, this.i - 1);
        }
      }
      this.i++;
    }
    throw new Error("Unclosed { in the JSX");
  }

  element(): JNode {
    if (this.s[this.i] !== "<") throw new Error("Expected an element");
    this.i++;
    const tag = /^[A-Za-z][\w.:-]*/.exec(this.s.slice(this.i))?.[0];
    if (!tag) throw new Error("Expected an element name after <");
    this.i += tag.length;
    const node: JNode = { tag, attrs: [], children: [] };
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c === undefined) throw new Error(`<${tag}> is never closed`);
      if (c === "/" && this.s[this.i + 1] === ">") {
        this.i += 2;
        return node;
      }
      if (c === ">") {
        this.i++;
        break;
      }
      if (c === "{") {
        this.braces(); // {...props}
        continue;
      }
      const name = /^[A-Za-z_][\w.:-]*/.exec(this.s.slice(this.i))?.[0];
      if (!name) throw new Error(`Unexpected “${c}” in <${tag}>`);
      this.i += name.length;
      this.ws();
      if (this.s[this.i] !== "=") {
        node.attrs.push([name, "true"]);
        continue;
      }
      this.i++;
      this.ws();
      const q = this.s[this.i];
      if (q === '"' || q === "'") {
        const end = this.s.indexOf(q, this.i + 1);
        if (end < 0) throw new Error(`Unclosed string in ${name}`);
        node.attrs.push([name, this.s.slice(this.i + 1, end)]);
        this.i = end + 1;
      } else if (q === "{") {
        const expr = this.braces().trim();
        const lit = literal(expr);
        if (lit !== null) node.attrs.push([name, lit]);
        else if (name === "style" && expr.startsWith("{")) {
          const css = objectToCss(expr);
          if (css !== null) node.attrs.push([name, css]);
          else this.dropped.push(`style={${expr}}`);
        } else this.dropped.push(`${name}={${expr}}`);
      } else throw new Error(`Unexpected value for ${name}`);
    }
    // children
    for (;;) {
      if (this.i >= this.s.length) throw new Error(`<${tag}> is never closed`);
      if (this.s.startsWith("</", this.i)) {
        const end = this.s.indexOf(">", this.i);
        this.i = end + 1;
        return node;
      }
      const c = this.s[this.i];
      if (c === "<") node.children.push(this.element());
      else if (c === "{") {
        const expr = this.braces().trim();
        if (expr.startsWith("/*")) continue;
        const lit = literal(expr);
        if (lit !== null) node.children.push(lit);
        else if (expr) this.dropped.push(`{${expr}}`);
      } else {
        const next = this.s.slice(this.i).search(/[<{]/);
        const text = next < 0 ? this.s.slice(this.i) : this.s.slice(this.i, this.i + next);
        this.i += text.length;
        const t = text.replace(/\s+/g, " ").trim();
        if (t) node.children.push(t);
      }
    }
  }
}

/** `"x"`, `'x'`, `12`, `-1.5`, a template without `${}` → its text; anything else → null. */
function literal(expr: string): string | null {
  const e = expr.trim();
  if (/^-?\d+(\.\d+)?$/.test(e)) return e;
  const m = /^(["'`])([\s\S]*)\1$/.exec(e);
  if (m && !(m[1] === "`" && m[2].includes("${"))) return m[2].replace(/\\(["'`\\])/g, "$1");
  return null;
}

/** `{ fill: "red", strokeWidth: 2 }` → "fill: red; stroke-width: 2"; null when it isn't a plain literal. */
export function objectToCss(expr: string): string | null {
  const inner = expr.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  if (!inner) return "";
  const out: string[] = [];
  for (const part of inner.split(/,(?=(?:[^"'`]|["'`][^"'`]*["'`])*$)/)) {
    const p = part.trim();
    if (!p) continue;
    const i = p.indexOf(":");
    if (i < 0) return null;
    const key = p.slice(0, i).trim().replace(/^["'](.*)["']$/, "$1");
    const val = literal(p.slice(i + 1).trim());
    if (val === null || !key) return null;
    const css = key.startsWith("--") ? key : kebab(key).replace(/^(webkit|moz|ms|o)-/, "-$1-");
    out.push(`${css}: ${val}`);
  }
  return out.join("; ");
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function printSvg(n: JNode, depth: number, root: boolean): string {
  const tag = SVG_ELEMENT[n.tag] ?? n.tag;
  const attrs: string[] = [];
  for (const [k, v] of n.attrs) {
    const name = svgAttrName(k);
    if (name) attrs.push(`${name}="${escAttr(v)}"`);
  }
  if (root && !n.attrs.some(([k]) => k === "xmlns")) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
  const pad = "  ".repeat(depth);
  const open = `${pad}<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  if (!n.children.length) return `${open}/>`;
  const kids = n.children.map((c) => (typeof c === "string" ? `${pad}  ${escText(c)}` : printSvg(c, depth + 1, false)));
  return `${open}>\n${kids.join("\n")}\n${pad}</${tag}>`;
}

/** JSX / TSX containing an <svg> (or react-native-svg <Svg>) → plain SVG markup. */
export function componentToSvg(code: string): Result<string> {
  const start = code.search(/<(svg|Svg)\b/);
  if (start < 0) return { ok: false, error: "No <svg> (or <Svg>) element found in the code." };
  const p = new JsxParser(code);
  p.i = start;
  try {
    const node = p.element();
    const notes = p.dropped.length ? [`Left out (not a fixed value): ${p.dropped.join(", ")}`] : [];
    return { ok: true, value: printSvg(node, 0, true) + "\n", notes };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The SVG text inside a result, for previews and the image converter. */
export function byteSize(s: string): number {
  return new TextEncoder().encode(s).length;
}
