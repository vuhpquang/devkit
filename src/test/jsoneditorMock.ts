import { vi } from "vitest";

/** In-memory stand-in for vanilla-jsoneditor (a Svelte app jsdom can't lay out). */
export interface StubEditor {
  props: Record<string, unknown>;
  content: unknown;
  destroyed: boolean;
}
export const editors: StubEditor[] = [];
export const live = () => editors.filter((e) => !e.destroyed);

export const jsoneditorMock = () => ({
  Mode: { tree: "tree", text: "text", table: "table" },
  jsonQueryLanguage: { id: "jsonquery" },
  jmespathQueryLanguage: { id: "jmespath" },
  jsonpathQueryLanguage: { id: "jsonpath" },
  lodashQueryLanguage: { id: "lodash" },
  javascriptQueryLanguage: { id: "javascript" },
  createAjvValidator: vi.fn(({ schema }: { schema: unknown }) => Object.assign(() => [], { schema })),
  createJSONEditor: ({ props }: { props: Record<string, unknown> }) => {
    const e: StubEditor = { props: { ...props }, content: props.content, destroyed: false };
    editors.push(e);
    return {
      get: () => e.content,
      set: (c: unknown) => {
        e.content = c;
      },
      updateProps: (p: Record<string, unknown>) => Object.assign(e.props, p),
      scrollTo: () => Promise.resolve(),
      focus: () => {},
      destroy: async () => {
        e.destroyed = true;
      },
    };
  },
});
