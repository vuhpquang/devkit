import { createContext, useContext, useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { javascript } from "@codemirror/lang-javascript";

/** App-wide editor defaults (Settings → Editor). Tools may still override wrap / line numbers per pane. */
export const EditorDefaults = createContext<{ wrap: boolean; lineNumbers: boolean }>({ wrap: false, lineNumbers: true });
export const useEditorDefaults = () => useContext(EditorDefaults);

export type Lang = "json" | "sql" | "xml" | "yaml" | "javascript" | "text";

function language(lang: Lang): Extension {
  switch (lang) {
    case "json":
      return json();
    case "sql":
      return sql();
    case "xml":
      return xml();
    case "yaml":
      return yaml();
    case "javascript":
      return javascript();
    default:
      return [];
  }
}

/** Colours come from the --syn-* tokens, so light/dark switch without reconfiguring the editor. */
const highlight = HighlightStyle.define([
  { tag: [t.propertyName, t.attributeName, t.definition(t.propertyName)], color: "var(--syn-key)" },
  { tag: [t.string, t.special(t.string), t.attributeValue], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syn-number)" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.typeName], color: "var(--syn-keyword)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.tagName, t.angleBracket], color: "var(--syn-tag)" },
  { tag: [t.punctuation, t.separator, t.bracket, t.squareBracket, t.brace], color: "var(--syn-punct)" },
  { tag: t.invalid, color: "var(--danger)" },
]);

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "var(--editor-font-size, 13px)",
    color: "var(--text)",
    backgroundColor: "transparent",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.65",
    overflow: "auto",
  },
  ".cm-content": { padding: "10px 0", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 14px 0 10px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--text-faint)",
    border: "none",
    paddingLeft: "6px",
    minWidth: "38px",
  },
  ".cm-lineNumbers .cm-gutterElement": { fontSize: "0.88em", paddingRight: "2px" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--surface-3) 45%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text-muted)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-ring) !important",
  },
  ".cm-matchingBracket": {
    backgroundColor: "var(--accent-soft)",
    outline: "1px solid color-mix(in srgb, var(--accent) 50%, transparent)",
  },
  ".cm-placeholder": { color: "var(--text-faint)", fontStyle: "normal" },
});

interface Props {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  lang?: Lang;
  placeholder?: string;
  wrap?: boolean;
  lineNumbers?: boolean;
  ariaLabel: string;
  autoFocus?: boolean;
}

/** CodeMirror 6 editor that fills its parent. Controlled: `value` wins over the editor's own text. */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  lang = "text",
  placeholder = "",
  wrap = false,
  lineNumbers: showLineNumbers = true,
  ariaLabel,
  autoFocus,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const langC = useRef(new Compartment());
  const roC = useRef(new Compartment());
  const wrapC = useRef(new Compartment());
  const phC = useRef(new Compartment());
  const gutterC = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          gutterC.current.of(showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          syntaxHighlighting(highlight),
          theme,
          langC.current.of(language(lang)),
          roC.current.of(EditorState.readOnly.of(readOnly)),
          wrapC.current.of(wrap ? EditorView.lineWrapping : []),
          phC.current.of(placeholder ? placeholderExt(placeholder) : []),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel, spellcheck: "false" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
    return () => {
      v.destroy();
      view.current = null;
    };
    // Created once; everything else is reconfigured below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: langC.current.reconfigure(language(lang)) });
  }, [lang]);
  useEffect(() => {
    view.current?.dispatch({ effects: roC.current.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);
  useEffect(() => {
    view.current?.dispatch({ effects: wrapC.current.reconfigure(wrap ? EditorView.lineWrapping : []) });
  }, [wrap]);
  useEffect(() => {
    view.current?.dispatch({ effects: phC.current.reconfigure(placeholder ? placeholderExt(placeholder) : []) });
  }, [placeholder]);
  useEffect(() => {
    view.current?.dispatch({
      effects: gutterC.current.reconfigure(showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
    });
  }, [showLineNumbers]);

  return <div ref={host} className="h-full min-h-0 w-full" />;
}
