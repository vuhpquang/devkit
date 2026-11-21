import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  createJSONEditor,
  javascriptQueryLanguage,
  jmespathQueryLanguage,
  jsonpathQueryLanguage,
  jsonQueryLanguage,
  lodashQueryLanguage,
  Mode,
  type Content,
  type JSONEditorPropsOptional,
  type OnClassName,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";
import "./jsoneditor.css";
import type { EditorContent } from "./diff";

type EditorPath = Parameters<ReturnType<typeof createJSONEditor>["scrollTo"]>[0];

/** Every query language svelte-jsoneditor ships, for Transform (JSONQuery first, its default). */
export const QUERY_LANGUAGES = [jsonQueryLanguage, jmespathQueryLanguage, jsonpathQueryLanguage, lodashQueryLanguage, javascriptQueryLanguage];

export { Mode };
export type EditorOptions = JSONEditorPropsOptional;

export interface JsonEditorHandle {
  get: () => EditorContent;
  set: (content: EditorContent) => void;
  scrollTo: (path: string[]) => Promise<void>;
  /** The document as text, formatted with the editor's indentation when it holds parsed JSON. */
  getText: () => string;
  focus: () => void;
}

/** Follows the app's `dark` class on <html>, live. */
function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

interface Props {
  /** Content when the editor mounts; later changes go through the handle's `set`. */
  initial: EditorContent;
  onChange?: (content: EditorContent) => void;
  onChangeMode?: (mode: Mode) => void;
  onClassName?: OnClassName;
  /** Any other svelte-jsoneditor props (mode, indentation, validator, parser…), pushed with updateProps. */
  options?: EditorOptions;
  ariaLabel: string;
}

/**
 * React wrapper around vanilla-jsoneditor (svelte-jsoneditor's framework-free build): created once,
 * destroyed on unmount, props pushed through `updateProps`.
 */
export const JsonEditorView = forwardRef<JsonEditorHandle, Props>(function JsonEditorView(
  { initial, onChange, onChangeMode, onClassName, options, ariaLabel },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<ReturnType<typeof createJSONEditor> | null>(null);
  const dark = useDarkMode();
  const cb = useRef({ onChange, onChangeMode });
  cb.current = { onChange, onChangeMode };
  const firstOptions = useRef(options);

  useEffect(() => {
    if (!host.current) return;
    const ed = createJSONEditor({
      target: host.current,
      props: {
        mode: Mode.tree,
        queryLanguages: QUERY_LANGUAGES,
        ...firstOptions.current,
        content: initial as Content,
        ariaLabel,
        onChange: (content: Content) => cb.current.onChange?.(content as EditorContent),
        onChangeMode: (mode: Mode) => cb.current.onChangeMode?.(mode),
      },
    });
    editor.current = ed;
    return () => {
      editor.current = null;
      void ed.destroy();
    };
    // Created once; `initial` is only the first content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (options && options !== firstOptions.current) void editor.current?.updateProps(options);
  }, [options]);

  useEffect(() => {
    void editor.current?.updateProps({ onClassName });
  }, [onClassName]);

  useImperativeHandle(
    ref,
    () => ({
      get: () => (editor.current?.get() as EditorContent | undefined) ?? { json: undefined },
      set: (content) => void editor.current?.set(content as Content),
      scrollTo: (path) => editor.current?.scrollTo(path as EditorPath) ?? Promise.resolve(),
      getText: () => {
        const c = editor.current?.get() as EditorContent | undefined;
        if (!c) return "";
        if ("text" in c) return c.text;
        const indent = options?.indentation ?? 2;
        const parser = options?.parser ?? JSON;
        return parser.stringify(c.json, null, indent) ?? "";
      },
      focus: () => void editor.current?.focus(),
    }),
    [options],
  );

  return <div ref={host} className={`dk-jse h-full min-h-0 ${dark ? "jse-theme-dark" : ""}`} />;
});
