import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Check, Copy, FileJson2, FileText, FolderOpen, GitCompareArrows, Save, ShieldCheck } from "lucide-react";
import { parse as losslessParse, stringify as losslessStringify } from "lossless-json";
import { createAjvValidator, type JSONParser } from "vanilla-jsoneditor";
import type { ToolDef } from "../types";
import { Button, CodeEditor, Notice, Panel, Segmented, Toggle, ToolBar, ToolBarDivider, ToolPage } from "../../lib/ui";
import { JsonEditorView, Mode, type EditorOptions, type JsonEditorHandle } from "../../lib/jsoneditor/JsonEditorView";
import { openJsonFile, saveJsonFile } from "../../lib/jsoneditor/files";
import type { EditorContent } from "../../lib/jsoneditor/diff";
import { sendTo, takeHandoff } from "../../app/handoff";

const PREFS_KEY = "devkit.jsonFormat";

type View = "text" | "tree" | "table";
type Indent = "2" | "4" | "tab";

interface Prefs {
  view: View;
  indent: Indent;
  /** lossless-json: numbers past 2^53 and long decimals stay exact. */
  lossless: boolean;
  schemaOpen: boolean;
  schema: string;
}

const DEFAULT_PREFS: Prefs = { view: "text", indent: "2", lossless: false, schemaOpen: false, schema: "" };

export function loadPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return {
      view: v.view === "tree" || v.view === "table" ? v.view : "text",
      indent: v.indent === "4" || v.indent === "tab" ? v.indent : "2",
      lossless: v.lossless === true,
      schemaOpen: v.schemaOpen === true,
      schema: typeof v.schema === "string" ? v.schema : "",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const LOSSLESS: JSONParser = { parse: losslessParse as JSONParser["parse"], stringify: losslessStringify as JSONParser["stringify"] };

const MODE: Record<View, Mode> = { text: Mode.text, tree: Mode.tree, table: Mode.table };
const VIEW: Record<string, View> = { text: "text", tree: "tree", table: "table" };

/** Schema text → a validator, or the reason it can't be one. Empty = no validation. */
export function schemaValidator(text: string): { validator?: EditorOptions["validator"]; error?: string } {
  if (!text.trim()) return {};
  let schema: unknown;
  try {
    schema = JSON.parse(text);
  } catch (e) {
    return { error: `The schema isn't valid JSON: ${(e as Error).message}` };
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { error: "A JSON Schema is an object." };
  try {
    return { validator: createAjvValidator({ schema: schema as Record<string, unknown> }) };
  } catch (e) {
    return { error: `The schema can't be compiled: ${(e as Error).message}` };
  }
}

const SAMPLE = `{"name":"devkit","version":"0.5.0","private":true,"tags":["json","format"],"author":{"name":"Ha Phung Quang Vu","url":"https://vuhpquang.com"},"stars":42,"id":9007199254740993,"license":null,"releases":[{"version":"0.3.0","tools":40},{"version":"0.4.0","tools":43}]}`;

const SAMPLE_SCHEMA = `{
  "type": "object",
  "required": ["name", "version"],
  "properties": {
    "name": { "type": "string" },
    "version": { "type": "string", "pattern": "^\\\\d+\\\\.\\\\d+\\\\.\\\\d+$" },
    "stars": { "type": "integer", "minimum": 0 }
  }
}`;

/** The document survives switching to another tool and back (not app restarts). */
let lastDoc: EditorContent = { text: "" };
let lastName: string | null = null;

function JsonFormat() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [name, setName] = useState<string | null>(lastName);
  const [error, setError] = useState<string | null>(null);
  const editor = useRef<JsonEditorHandle>(null);
  const update = (p: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });

  // Text handed over by another tool loads once.
  const initial = useRef<EditorContent>(lastDoc);
  const handed = useRef(false);
  if (!handed.current) {
    handed.current = true;
    const h = takeHandoff("json-format");
    if (h?.kind === "text") initial.current = { text: h.text };
  }

  const schema = useMemo(() => (prefs.schemaOpen ? schemaValidator(prefs.schema) : {}), [prefs.schemaOpen, prefs.schema]);

  const options = useMemo<EditorOptions>(
    () => ({
      mode: MODE[prefs.view],
      indentation: prefs.indent === "tab" ? "\t" : Number(prefs.indent),
      tabSize: 4,
      askToFormat: true,
      parser: prefs.lossless ? LOSSLESS : JSON,
      validator: schema.validator,
    }),
    [prefs.view, prefs.indent, prefs.lossless, schema.validator],
  );

  useEffect(
    () => () => {
      if (editor.current) lastDoc = editor.current.get();
    },
    [],
  );

  const open = async () => {
    try {
      setError(null);
      const f = await openJsonFile();
      if (!f) return;
      editor.current?.set({ text: f.text });
      setName(f.name);
      lastName = f.name;
    } catch (e) {
      setError(`Couldn't open the file: ${(e as Error).message ?? e}`);
    }
  };
  const save = async () => {
    try {
      setError(null);
      const saved = await saveJsonFile(name ?? "document.json", editor.current?.getText() ?? "");
      if (saved) {
        setName(saved);
        lastName = saved;
      }
    } catch (e) {
      setError(`Couldn't save the file: ${(e as Error).message ?? e}`);
    }
  };

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(editor.current?.getText() ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={FileText} onClick={() => editor.current?.set({ text: SAMPLE })}>
              Sample
            </Button>
            <Button size="sm" variant="ghost" icon={FolderOpen} label="Open a JSON file…" onClick={() => void open()} />
            <Button size="sm" variant="ghost" icon={Save} label="Save as a file…" onClick={() => void save()} />
            <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={() => void copy()} className={copied ? "!text-success" : undefined}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={GitCompareArrows}
              label="Open this document in JSON Diff"
              onClick={() => sendTo("json-diff", { kind: "text", text: editor.current?.getText() ?? "" })}
            >
              Compare…
            </Button>
          </>
        }
      >
        <Segmented<View>
          label="View"
          value={prefs.view}
          onChange={(view) => update({ view })}
          options={[
            { value: "text", label: "Text" },
            { value: "tree", label: "Tree" },
            { value: "table", label: "Table" },
          ]}
        />
        <ToolBarDivider />
        <Segmented<Indent>
          label="Indent"
          size="sm"
          value={prefs.indent}
          onChange={(indent) => update({ indent })}
          options={[
            { value: "2", label: "2" },
            { value: "4", label: "4" },
            { value: "tab", label: "Tab" },
          ]}
        />
        <Toggle size="sm" on={prefs.lossless} onToggle={() => update({ lossless: !prefs.lossless })} title="Keep numbers past 2^53 and long decimals exact (lossless-json)">
          Big numbers
        </Toggle>
        <Toggle size="sm" on={prefs.schemaOpen} onToggle={() => update({ schemaOpen: !prefs.schemaOpen })} title="Validate against a JSON Schema">
          <ShieldCheck size={13} className="mr-1" aria-hidden /> Schema
        </Toggle>
      </ToolBar>

      {error && <Notice>{error}</Notice>}

      <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 auto-rows-[minmax(0,1fr)]" style={prefs.schemaOpen ? { gridTemplateColumns: "minmax(0,1fr) minmax(16rem,0.55fr)" } : undefined}>
        <Panel title="Document" icon={Braces} meta={name ?? undefined}>
          <JsonEditorView
            ref={editor}
            initial={initial.current}
            options={options}
            onChangeMode={(m) => VIEW[m] && VIEW[m] !== prefs.view && update({ view: VIEW[m] })}
            ariaLabel="JSON document"
          />
        </Panel>
        {prefs.schemaOpen && (
          <Panel
            title="JSON Schema"
            icon={FileJson2}
            meta={schema.validator ? "Validating" : undefined}
            actions={
              <Button size="sm" variant="ghost" icon={FileText} label="Sample schema" onClick={() => update({ schema: SAMPLE_SCHEMA })} />
            }
            footer={
              schema.error ? (
                <p role="alert" className="px-3 py-2 text-sm text-danger bg-danger-soft">
                  {schema.error}
                </p>
              ) : (
                <p className="px-3 py-2 text-sm text-fg-faint">Problems show in the document, next to the values that break the schema.</p>
              )
            }
          >
            <CodeEditor value={prefs.schema} onChange={(schema) => update({ schema })} lang="json" ariaLabel="JSON Schema" placeholder='{ "type": "object", … }' />
          </Panel>
        )}
      </div>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "json-format",
  name: "JSON Format",
  category: "Formatters",
  description: "Format, repair, query and validate JSON as text, a tree or a table",
  icon: Braces,
  keywords: ["json", "pretty", "minify", "compact", "validate", "beautify", "repair", "editor", "tree", "table", "schema", "jmespath", "jsonpath", "query", "transform", "sort"],
  component: JsonFormat,
};
