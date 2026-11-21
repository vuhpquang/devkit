import { useDeferredValue, useMemo, useState } from "react";
import { FileText, ListOrdered, Regex, Replace, Highlighter } from "lucide-react";
import type { ToolDef } from "../types";
import {
  Badge,
  CopyButton,
  EditorPane,
  EmptyState,
  Notice,
  Panel,
  TextInput,
  Toggle,
  ToolBar,
  ToolPage,
  Button,
} from "../../lib/ui";
import { MAX_MATCHES, findMatches, replaceAll, segments } from "./logic";

const FLAGS: { flag: string; title: string }[] = [
  { flag: "g", title: "Global — find every match" },
  { flag: "i", title: "Ignore case" },
  { flag: "m", title: "Multiline — ^ and $ match at line breaks" },
  { flag: "s", title: "Dot all — . matches line breaks" },
  { flag: "u", title: "Unicode" },
  { flag: "y", title: "Sticky — match only at lastIndex" },
];

const SAMPLE_PATTERN = "(?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.]+)";
const SAMPLE_TEXT =
  "Contact: ha.vu@example.com, support@devkit.app\nInvalid: user@localhost, @nobody.com\nSales: sales+vn@shop.co.uk";

function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState("");
  const dText = useDeferredValue(text);
  const dPattern = useDeferredValue(pattern);

  const result = useMemo(() => findMatches(dPattern, flags, dText), [dPattern, flags, dText]);
  const matches = result.ok ? result.matches : [];
  const segs = useMemo(() => segments(dText, matches), [dText, matches]);
  const replaced = useMemo(
    () => (replacement !== "" && dPattern ? replaceAll(dPattern, flags, dText, replacement) : null),
    [replacement, dPattern, flags, dText],
  );

  const toggle = (f: string) =>
    setFlags((cur) => (cur.includes(f) ? cur.replace(f, "") : FLAGS.map((x) => x.flag).filter((x) => cur.includes(x) || x === f).join("")));

  return (
    <ToolPage>
      <ToolBar
        end={
          <Button
            size="sm"
            variant="ghost"
            icon={FileText}
            onClick={() => {
              setPattern(SAMPLE_PATTERN);
              setText(SAMPLE_TEXT);
              setFlags("g");
            }}
          >
            Sample
          </Button>
        }
      >
        <TextInput
          autoFocus
          mono
          icon={Regex}
          aria-label="Regular expression"
          placeholder="Pattern, e.g. \d+"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="flex-1 min-w-[16rem]"
        />
        <div role="group" aria-label="Flags" className="flex items-center gap-1">
          {FLAGS.map(({ flag, title }) => {
            const on = flags.includes(flag);
            return (
              <Toggle key={flag} mono on={on} onToggle={() => toggle(flag)} label={`Flag ${flag}`} title={title} className="w-8 px-0">
                {flag}
              </Toggle>
            );
          })}
        </div>
        {result.ok && dPattern && (
          <Badge tone={matches.length ? "accent" : "neutral"}>
            {result.truncated ? `${MAX_MATCHES}+` : matches.length} {matches.length === 1 ? "match" : "matches"}
          </Badge>
        )}
      </ToolBar>

      {!result.ok && <Notice>{result.error}</Notice>}

      <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 min-[720px]:grid-cols-2 auto-rows-[minmax(0,1fr)]">
        <div className="flex flex-col gap-3 min-h-0">
          <EditorPane title="Test string" value={text} onChange={setText} placeholder="Text to search" wrap className="flex-1" />
          <Panel title="Replace" icon={Replace} className="shrink-0" actions={<CopyButton text={replaced?.ok ? replaced.value : ""} />}>
            <div className="p-2.5 flex flex-col gap-2">
              <TextInput
                mono
                aria-label="Replacement"
                placeholder="Replacement — $1, $<name>, $& work"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
              {replaced && (
                <pre
                  aria-label="Replaced text"
                  className="max-h-32 overflow-auto rounded-md bg-surface-2 border border-line p-2.5 font-mono text-[12.5px] leading-[1.6] whitespace-pre-wrap break-all text-fg selectable"
                >
                  {replaced.ok ? replaced.value : ""}
                </pre>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <Panel title="Highlighted" icon={Highlighter} className="flex-1" bodyClassName="overflow-auto">
            {dText ? (
              <pre
                aria-label="Highlighted matches"
                className="p-3 font-mono text-[12.5px] leading-[1.7] whitespace-pre-wrap break-all text-fg selectable"
              >
                {segs.map((s, i) =>
                  s.match === null ? (
                    <span key={i}>{s.text}</span>
                  ) : (
                    <mark
                      key={i}
                      title={`Match ${s.match + 1}`}
                      className="bg-accent-soft text-fg rounded-xs ring-1 ring-accent/50 px-px"
                    >
                      {s.text}
                    </mark>
                  ),
                )}
              </pre>
            ) : (
              <EmptyState icon={Regex} title="Test a regular expression">
                Type a pattern and some text. Matches are highlighted as you type.
              </EmptyState>
            )}
          </Panel>
          <Panel
            title="Matches"
            icon={ListOrdered}
            meta={matches.length ? String(matches.length) : undefined}
            className="flex-1"
            bodyClassName="overflow-auto"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-4 text-base text-fg-faint">{dPattern && dText && result.ok ? "No matches" : "Matches and their groups show here"}</p>
            ) : (
              <ol className="divide-y divide-line">
                {matches.map((m, i) => (
                  <li key={i} className="group px-3 py-2 flex gap-3 items-start">
                    <Badge className="mt-[1px]">{i + 1}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <code className="font-mono text-[12.5px] text-fg font-medium break-all selectable">
                          {m.text === "" ? <span className="text-fg-faint italic">empty</span> : m.text}
                        </code>
                        <span className="text-sm text-fg-faint tabular-nums shrink-0">
                          {m.index}–{m.end}
                        </span>
                      </div>
                      {(m.groups.length > 0 || Object.keys(m.named).length > 0) && (
                        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                          {m.groups.map((g, gi) => (
                            <div key={`n${gi}`} className="contents">
                              <dt className="font-mono text-fg-faint">${gi + 1}</dt>
                              <dd className="font-mono text-fg-muted break-all selectable">{g ?? <span className="italic">undefined</span>}</dd>
                            </div>
                          ))}
                          {Object.entries(m.named).map(([name, g]) => (
                            <div key={`k${name}`} className="contents">
                              <dt className="font-mono text-accent-text">{name}</dt>
                              <dd className="font-mono text-fg-muted break-all selectable">{g ?? <span className="italic">undefined</span>}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <span className="opacity-60 group-hover:opacity-100">
                      <CopyButton text={m.text} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "regex-tester",
  name: "Regex Tester",
  category: "Text",
  description: "Test regular expressions with live highlighting, groups and replace",
  icon: Regex,
  keywords: ["regex", "regexp", "regular expression", "match", "pattern", "replace", "test"],
  component: RegexTester,
};
