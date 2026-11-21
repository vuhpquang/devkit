import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createJSONEditor, Mode, type Content, type OnClassName } from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";
import "./json-editor.css";
import type { EditorContent } from "./logic";

type EditorPath = Parameters<ReturnType<typeof createJSONEditor>["scrollTo"]>[0];

export interface JsonEditorHandle {
  get: () => EditorContent;
  set: (content: EditorContent) => void;
  scrollTo: (path: string[]) => Promise<void>;
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
  ariaLabel: string;
}

/**
 * React wrapper around vanilla-jsoneditor (svelte-jsoneditor's framework-free build): created once,
 * destroyed on unmount, callbacks pushed through `updateProps`.
 */
export const JsonEditorView = forwardRef<JsonEditorHandle, Props>(function JsonEditorView(
  { initial, onChange, onChangeMode, onClassName, ariaLabel },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<ReturnType<typeof createJSONEditor> | null>(null);
  const dark = useDarkMode();
  const cb = useRef({ onChange, onChangeMode });
  cb.current = { onChange, onChangeMode };

  useEffect(() => {
    if (!host.current) return;
    const ed = createJSONEditor({
      target: host.current,
      props: {
        content: initial as Content,
        mode: Mode.tree,
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
    editor.current?.updateProps({ onClassName });
  }, [onClassName]);

  useImperativeHandle(
    ref,
    () => ({
      get: () => (editor.current?.get() as EditorContent | undefined) ?? { json: undefined },
      set: (content) => editor.current?.set(content as Content),
      scrollTo: (path) => editor.current?.scrollTo(path as EditorPath) ?? Promise.resolve(),
    }),
    [],
  );

  return <div ref={host} className={`dk-jse h-full min-h-0 ${dark ? "jse-theme-dark" : ""}`} />;
});
