import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { ArrowLeftRight, FileText, WrapText } from "lucide-react";
import { Button, Segmented } from "./primitives";
import { EditorPane, Split, ToolBar, ToolBarDivider, ToolPage, type Status } from "./layout";
import type { Lang } from "./CodeEditor";

export type TransformResult = { ok: true; value: string } | { ok: false; error: string };

export interface TransformMode<M extends string> {
  value: M;
  label: string;
  run: (input: string) => TransformResult;
  inputLang?: Lang;
  outputLang?: Lang;
  /** Status text when the transform succeeds, e.g. "Valid JSON". */
  okText?: string;
  placeholder?: string;
  /** Mode to switch to when the output is moved back into the input. */
  inverse?: M;
}

/**
 * Input → output tool that runs as you type. Modes are a segmented control; the result (or the error)
 * shows in the output pane's status line. Used by the formatters, converters and encoders.
 */
export function TransformTool<M extends string>({
  modes,
  initialMode,
  inputTitle = "Input",
  outputTitle = "Output",
  sample,
  options,
  wrapByDefault = false,
}: {
  modes: TransformMode<M>[];
  initialMode?: M;
  inputTitle?: string;
  outputTitle?: string;
  /** Example input per mode (or one for all), loaded by the Sample button. */
  sample?: string | Partial<Record<M, string>>;
  /** Extra toolbar controls (indent etc.). */
  options?: ReactNode;
  wrapByDefault?: boolean;
}) {
  const [modeValue, setMode] = useState<M>(initialMode ?? modes[0].value);
  const [input, setInput] = useState("");
  const [wrap, setWrap] = useState(wrapByDefault);
  const mode = modes.find((m) => m.value === modeValue) ?? modes[0];
  const deferred = useDeferredValue(input);

  const result = useMemo<TransformResult | null>(
    () => (deferred.trim() ? mode.run(deferred) : null),
    [deferred, mode],
  );
  const output = result?.ok ? result.value : "";

  const status: Status = !result
    ? { kind: "idle", text: "Type or paste input — the result updates as you type" }
    : result.ok
      ? { kind: "ok", text: mode.okText ?? "Done" }
      : { kind: "error", text: result.error };

  const sampleText = typeof sample === "string" ? sample : sample?.[mode.value];

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            {sampleText && (
              <Button size="sm" variant="ghost" icon={FileText} onClick={() => setInput(sampleText)}>
                Sample
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={WrapText}
              label={wrap ? "Don't wrap lines" : "Wrap lines"}
              aria-pressed={wrap}
              className={wrap ? "!text-accent-text !bg-accent-soft" : undefined}
              onClick={() => setWrap((w) => !w)}
            />
          </>
        }
      >
        {modes.length > 1 && (
          <Segmented
            label="Mode"
            value={mode.value}
            onChange={setMode}
            options={modes.map((m) => ({ value: m.value, label: m.label }))}
          />
        )}
        {mode.inverse && (
          <Button
            icon={ArrowLeftRight}
            label="Use output as input"
            disabled={!output}
            onClick={() => {
              setInput(output);
              setMode(mode.inverse!);
            }}
          />
        )}
        {options && (
          <>
            {modes.length > 1 && <ToolBarDivider />}
            {options}
          </>
        )}
      </ToolBar>
      <Split>
        <EditorPane
          title={inputTitle}
          value={input}
          onChange={setInput}
          lang={mode.inputLang}
          placeholder={mode.placeholder}
          wrap={wrap}
          autoFocus
        />
        <EditorPane title={outputTitle} value={output} readOnly lang={mode.outputLang} wrap={wrap} status={status} />
      </Split>
    </ToolPage>
  );
}
