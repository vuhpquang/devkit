import { useDeferredValue, useMemo } from "react";
import { CaseSensitive, FileText } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, EditorPane, KeyValueList, Panel, ToolBar, ToolPage } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { convertAll, splitWords } from "./logic";

const SAMPLE = "XMLHttpRequest user_id for Đường Phố";

function CaseConverter() {
  const [input, setInput] = useSaved("input", "");
  const deferred = useDeferredValue(input);
  const rows = useMemo(() => convertAll(deferred), [deferred]);
  const words = useMemo(() => splitWords(deferred), [deferred]);

  return (
    <ToolPage>
      <ToolBar
        end={
          <Button size="sm" variant="ghost" icon={FileText} onClick={() => setInput(SAMPLE)}>
            Sample
          </Button>
        }
      >
        <span className="text-sm text-fg-faint">Splits on spaces, punctuation, camelCase and acronyms — updated as you type</span>
      </ToolBar>
      <EditorPane
        title="Input"
        value={input}
        onChange={setInput}
        placeholder="Text, identifier or phrase"
        wrap
        lineNumbers={false}
        autoFocus
        className="h-36 shrink-0"
      />
      <Panel
        title="Cases"
        icon={CaseSensitive}
        meta={words.length ? `${words.length} ${words.length === 1 ? "word" : "words"}` : undefined}
        className="flex-1"
        bodyClassName="overflow-auto"
      >
        <KeyValueList copy mono labelWidth="8.5rem" rows={rows.map((r) => ({ label: r.label, value: r.value }))} />
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "case-converter",
  name: "Case Converter",
  category: "Text",
  description: "camelCase, snake_case, kebab-case and nine more from any text",
  icon: CaseSensitive,
  keywords: ["case", "camel", "snake", "kebab", "pascal", "constant", "title", "upper", "lower", "convert"],
  component: CaseConverter,
};
