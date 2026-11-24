import { useDeferredValue, useMemo, type MouseEvent } from "react";
import { BookOpen, Eye, FileText } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, CopyButton, EditorPane, EmptyState, Panel, Split, ToolBar, ToolPage } from "../../lib/ui";
import { openExternal } from "../../lib/openExternal";
import { useSaved } from "../../lib/saved";
import { countWords, isExternalLink, renderMarkdown } from "./logic";

/** Preview typography, scoped to .dk-md and built only from the design tokens. */
const CSS = `
.dk-md { color: var(--text); font-size: 14px; line-height: 1.65; padding: 16px 20px; overflow-wrap: anywhere; }
.dk-md > :first-child { margin-top: 0; }
.dk-md h1, .dk-md h2, .dk-md h3, .dk-md h4 { font-weight: 650; line-height: 1.3; margin: 1.4em 0 0.5em; }
.dk-md h1 { font-size: 1.7em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
.dk-md h2 { font-size: 1.35em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border); }
.dk-md h3 { font-size: 1.12em; }
.dk-md p, .dk-md ul, .dk-md ol, .dk-md blockquote, .dk-md pre, .dk-md table { margin: 0 0 0.9em; }
.dk-md ul, .dk-md ol { padding-left: 1.6em; }
.dk-md ul { list-style: disc; } .dk-md ol { list-style: decimal; }
.dk-md li + li { margin-top: 0.2em; }
.dk-md li input[type="checkbox"] { margin-right: 0.4em; accent-color: var(--accent); }
.dk-md a { color: var(--accent-text); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.dk-md strong { font-weight: 650; }
.dk-md code { font-family: var(--font-mono); font-size: 0.88em; background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 0.1em 0.35em; }
.dk-md pre { font-family: var(--font-mono); font-size: 12.5px; line-height: 1.6; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; overflow: auto; }
.dk-md pre code { background: none; border: 0; padding: 0; font-size: inherit; }
.dk-md blockquote { color: var(--text-muted); border-left: 3px solid var(--accent); padding: 0.1em 0 0.1em 1em; }
.dk-md hr { border: 0; border-top: 1px solid var(--border); margin: 1.5em 0; }
.dk-md table { border-collapse: collapse; display: block; overflow: auto; }
.dk-md th, .dk-md td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
.dk-md th { background: var(--surface-2); font-weight: 600; }
.dk-md img { max-width: 100%; border-radius: 6px; }
`;

const SAMPLE = `# DevKit notes

Offline-first **developer utilities**, with \`⌘K\` to jump anywhere.

## Checklist

- [x] Format JSON as you type
- [x] Diff two files
- [ ] Release *v0.3.0*

> Markdown is rendered locally and sanitized — scripts never run.

\`\`\`ts
const greet = (name: string) => \`Xin chào, \${name}!\`;
\`\`\`

| Tool | Offline |
|------|---------|
| JSON Format | yes |
| DNS Lookup | no |

Made by [Ha Phung Quang Vu](https://vuhpquang.com).
`;

function MarkdownPreview() {
  const [source, setSource] = useSaved("source", "");
  const deferred = useDeferredValue(source);
  const html = useMemo(() => renderMarkdown(deferred), [deferred]);
  const words = useMemo(() => countWords(deferred), [deferred]);

  /** Links never navigate the app's webview: external ones open in the browser. */
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (isExternalLink(href)) void openExternal(href);
  };

  return (
    <ToolPage>
      <style>{CSS}</style>
      <ToolBar
        end={
          <Button size="sm" variant="ghost" icon={FileText} onClick={() => setSource(SAMPLE)}>
            Sample
          </Button>
        }
      >
        <span className="text-sm text-fg-faint">GitHub-flavoured Markdown, rendered locally and sanitized</span>
      </ToolBar>
      <Split>
        <EditorPane title="Markdown" value={source} onChange={setSource} placeholder="# Write Markdown here" wrap autoFocus />
        <Panel
          title="Preview"
          icon={Eye}
          meta={words ? `${words.toLocaleString()} ${words === 1 ? "word" : "words"}` : undefined}
          actions={<CopyButton text={html} label="Copy HTML" />}
          bodyClassName="overflow-auto"
        >
          {deferred.trim() ? (
            <div
              className="dk-md selectable"
              aria-label="Rendered Markdown"
              onClick={onClick}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <EmptyState icon={BookOpen} title="Preview Markdown">
              Type or paste Markdown on the left. Headings, tables, task lists and code blocks render here.
            </EmptyState>
          )}
        </Panel>
      </Split>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "markdown-preview",
  name: "Markdown Preview",
  category: "Text",
  description: "Render GitHub-flavoured Markdown side by side, copy the HTML",
  icon: BookOpen,
  keywords: ["markdown", "md", "preview", "render", "html", "gfm", "readme"],
  component: MarkdownPreview,
};
