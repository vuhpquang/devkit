import { describe, it, expect } from "vitest";
import { componentName, componentToSvg, jsxAttrName, objectToCss, parseStyle, svgAttrName, svgToComponent, type Options } from "./logic";
import { optimizeSvg, savedText } from "./optimize";

const ICON = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: something -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" viewBox="0 0 24 24" class="icon" data-name="star">
  <title>Star</title>
  <metadata>junk</metadata>
  <g fill="none" stroke="#1E2430" stroke-width="2" stroke-linecap="round" style="opacity: 0.8; -webkit-transform: none">
    <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" fill-rule="evenodd"/>
    <use xlink:href="#dot" x="1"/>
  </g>
</svg>`;

const opts = (o: Partial<Options> = {}) => ({ name: "star-icon.svg", sizeProps: false, spreadProps: false, typescript: false, ...o });

describe("names", () => {
  it("makes PascalCase component names", () => {
    expect(componentName("star-icon.svg")).toBe("StarIcon");
    expect(componentName("arrow_left 2")).toBe("ArrowLeft2");
    expect(componentName("24px")).toBe("Svg24px");
    expect(componentName("")).toBe("Icon");
  });

  it("maps attribute names both ways", () => {
    expect(jsxAttrName("class")).toBe("className");
    expect(jsxAttrName("stroke-width")).toBe("strokeWidth");
    expect(jsxAttrName("xlink:href")).toBe("xlinkHref");
    expect(jsxAttrName("xml:space")).toBe("xmlSpace");
    expect(jsxAttrName("data-name")).toBe("data-name");
    expect(jsxAttrName("aria-label")).toBe("aria-label");
    expect(jsxAttrName("inkscape:label")).toBeNull();
    expect(svgAttrName("className")).toBe("class");
    expect(svgAttrName("strokeWidth")).toBe("stroke-width");
    expect(svgAttrName("viewBox")).toBe("viewBox");
    expect(svgAttrName("gradientUnits")).toBe("gradientUnits");
    expect(svgAttrName("xlinkHref")).toBe("xlink:href");
    expect(svgAttrName("ref")).toBeNull();
  });
});

describe("style", () => {
  it("parses CSS into camelCase pairs", () => {
    expect(parseStyle("opacity: 0.8; -webkit-transform: none; --brand: red;")).toEqual([
      ["opacity", "0.8"],
      ["WebkitTransform", "none"],
      ["--brand", "red"],
    ]);
  });
  it("turns a style object back into CSS", () => {
    expect(objectToCss(`{ fill: "red", strokeWidth: 2, WebkitTransform: 'none' }`)).toBe("fill: red; stroke-width: 2; -webkit-transform: none");
    expect(objectToCss("{ fill: color }")).toBeNull();
  });
});

describe("SVG → React", () => {
  it("converts attributes, style, drops comments/metadata/title and editor junk", () => {
    const r = svgToComponent(ICON, "react", opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.value;
    expect(out).toContain('className="icon"');
    expect(out).toContain('data-name="star"');
    expect(out).toContain('strokeWidth="2"');
    expect(out).toContain('strokeLinecap="round"');
    expect(out).toContain('fillRule="evenodd"');
    expect(out).toContain('xlinkHref="#dot"');
    expect(out).toContain('style={{ opacity: "0.8", WebkitTransform: "none" }}');
    expect(out).toContain('width="24"');
    expect(out).not.toMatch(/<title>|metadata|Generator|<\?xml/);
    expect(out).toContain("const StarIcon = () => (");
    expect(out).toContain("export default StarIcon;");
    expect(out).not.toContain("import");
  });

  it("keeps <title> when asked", () => {
    const r = svgToComponent(ICON, "react", opts({ keepTitle: true }));
    expect(r.ok && r.value).toContain("<title>");
  });

  it("uses a size prop and spreads props", () => {
    const r = svgToComponent(ICON, "react", opts({ sizeProps: true, spreadProps: true, typescript: true }));
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toContain('import { type SVGProps } from "react";');
    expect(r.value).toContain("({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) => (");
    expect(r.value).toMatch(/width=\{size\}\s+height=\{size\}\s+\{\.\.\.props\}/);
    expect(r.value).not.toContain('width="24"');
    expect(r.value).toContain('viewBox="0 0 24 24"');
  });

  it("adds a viewBox from width/height when the size prop replaces them", () => {
    const r = svgToComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="4" height="4"/></svg>', "react", opts({ sizeProps: true }));
    expect(r.ok && r.value).toContain('viewBox="0 0 32 16" width={size} height={size}');
  });

  it("replaces colours with currentColor but keeps none and url()", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path fill="#f00" stroke="none"/><rect fill="url(#g)" stroke="rgb(0,0,0)" style="fill: blue"/></svg>`;
    const r = svgToComponent(svg, "react", opts({ currentColor: true }));
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toContain('fill="currentColor" stroke="none"');
    expect(r.value).toContain('fill="url(#g)" stroke="currentColor" style={{ fill: "currentColor" }}');
  });

  it("wraps with memo and forwardRef, named export", () => {
    const r = svgToComponent(ICON, "react", opts({ memo: true, forwardRef: true, typescript: true, exportKind: "named", spreadProps: true }));
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toContain('import { memo, forwardRef, type SVGProps } from "react";');
    expect(r.value).toContain("type Props = SVGProps<SVGSVGElement>;");
    expect(r.value).toContain("const StarIconBase = forwardRef<SVGSVGElement, Props>((props, ref) => (");
    expect(r.value).toMatch(/ref=\{ref\}\s+\{\.\.\.props\}/);
    expect(r.value).toContain('StarIconBase.displayName = "StarIcon";');
    expect(r.value).toContain("export const StarIcon = memo(StarIconBase);");
  });

  it("rejects things that aren't SVG", () => {
    expect(svgToComponent("<svg><path></svg>", "react").ok).toBe(false);
    expect(svgToComponent('<html xmlns="http://www.w3.org/1999/xhtml"/>', "react")).toEqual({ ok: false, error: "The markup's root element isn't <svg>." });
    expect(svgToComponent("  ", "react").ok).toBe(false);
  });
});

describe("SVG → React Native", () => {
  it("maps elements to react-native-svg and builds the import line", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" class="x"><defs><linearGradient id="a"><stop offset="0"/></linearGradient></defs><g><path d="M0 0h10"/><circle r="1"/></g><foreignObject/></svg>`;
    const r = svgToComponent(svg, "native", opts({ typescript: true, forwardRef: true }));
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toContain('import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, type SvgProps } from "react-native-svg";');
    expect(r.value).toContain("<Svg viewBox=");
    expect(r.value).toContain("<LinearGradient id=\"a\">");
    expect(r.value).not.toContain("className");
    expect(r.value).not.toContain("xmlns");
    expect(r.value).not.toContain("forwardRef");
    expect(r.notes.join(" ")).toMatch(/foreignObject/);
  });
});

describe("React → SVG", () => {
  it("converts JSX back, dropping expressions it can't evaluate", () => {
    const code = `export const A = ({ size = 24, color, ...props }) => (
      <svg width={size} height={24} viewBox="0 0 24 24" className='a' strokeWidth={"2"} fill={color} style={{ opacity: 0.5, strokeLinecap: "round" }} {...props}>
        {/* comment */}
        <path d="M1 1" xlinkHref="#x" />
        <text xmlSpace="preserve">{"Hi"} there</text>
      </svg>
    );`;
    const r = componentToSvg(code);
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" class="a" stroke-width="2" style="opacity: 0.5; stroke-linecap: round">
  <path d="M1 1" xlink:href="#x"/>
  <text xml:space="preserve">
    Hi
    there
  </text>
</svg>
`,
    );
    expect(r.notes[0]).toContain("width={size}");
    expect(r.notes[0]).toContain("fill={color}");
  });

  it("reads react-native-svg components", () => {
    const r = componentToSvg(`<Svg viewBox="0 0 2 2"><G><Path d="M0 0" /><LinearGradient id="g"/></G></Svg>`);
    expect(r.ok && r.value).toContain("<g>\n    <path d=\"M0 0\"/>\n    <linearGradient id=\"g\"/>");
  });

  it("explains missing or broken markup", () => {
    expect(componentToSvg("const x = 1;")).toEqual({ ok: false, error: "No <svg> (or <Svg>) element found in the code." });
    expect(componentToSvg("<svg><path></svg").ok).toBe(false);
  });

  it("round-trips SVG → React → SVG without changing the drawing", () => {
    const jsx = svgToComponent(ICON, "react", opts({ keepTitle: true }));
    if (!jsx.ok) throw new Error(jsx.error);
    const back = componentToSvg(jsx.value);
    if (!back.ok) throw new Error(back.error);
    const shape = (s: string) => {
      const root = new DOMParser().parseFromString(s, "image/svg+xml").documentElement;
      const walk = (e: Element): unknown => ({
        tag: e.localName,
        attrs: Array.from(e.attributes)
          .filter((a) => !a.name.startsWith("xmlns") && a.name !== "style")
          .map((a) => `${a.name}=${a.value}`)
          .sort(),
        kids: Array.from(e.children).filter((c) => c.localName !== "metadata").map(walk),
      });
      return walk(root);
    };
    expect(shape(back.value)).toEqual(shape(ICON));
  });
});

describe("SVGO", () => {
  it("shrinks the markup and keeps the viewBox", () => {
    const o = optimizeSvg(ICON);
    expect(o).not.toBeNull();
    expect(o!.after).toBeLessThan(o!.before);
    expect(o!.svg).toContain('viewBox="0 0 24 24"');
    expect(savedText({ svg: "", before: 2048, after: 1024 })).toBe("2.0 KB → 1.0 KB (−50%)");
  });
});
