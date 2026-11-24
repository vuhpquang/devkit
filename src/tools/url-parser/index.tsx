import { useDeferredValue, useMemo } from "react";
import { FileText, Link2, ListTree } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, CopyButton, EmptyState, KeyValueList, Notice, Panel, TextInput, ToolBar, ToolPage } from "../../lib/ui";
import { parseUrl } from "./logic";
import { useSaved } from "../../lib/saved";

const SAMPLE = "https://user:secret@api.example.com:8443/v1/search?q=%C4%91%C3%A0+n%E1%BA%B5ng&tag=dev&tag=tools&page=2#results";

function UrlParser() {
  const [input, setInput] = useSaved("input", "");
  const deferred = useDeferredValue(input);
  const result = useMemo(() => (deferred.trim() ? parseUrl(deferred) : null), [deferred]);
  const u = result?.ok ? result.url : null;

  const rows = u
    ? [
        { label: "Protocol", value: u.protocol },
        ...(u.username ? [{ label: "Username", value: u.username }] : []),
        ...(u.password ? [{ label: "Password", value: u.password }] : []),
        { label: "Host", value: u.host },
        { label: "Hostname", value: u.hostname },
        {
          label: "Port",
          value: u.port || (u.defaultPort ? <span className="text-fg-faint">{u.defaultPort} (default)</span> : <span className="text-fg-faint">—</span>),
          copyText: u.port || u.defaultPort,
        },
        { label: "Path", value: u.pathname },
        ...(u.search ? [{ label: "Query", value: u.search }] : []),
        ...(u.hash ? [{ label: "Fragment", value: u.hash }] : []),
        ...(u.origin ? [{ label: "Origin", value: u.origin }] : []),
        { label: "Full URL", value: u.href },
      ]
    : [];

  return (
    <ToolPage scroll>
      <ToolBar
        end={
          <Button size="sm" variant="ghost" icon={FileText} onClick={() => setInput(SAMPLE)}>
            Sample
          </Button>
        }
      >
        <TextInput
          autoFocus
          mono
          icon={Link2}
          aria-label="URL"
          placeholder="https://example.com/path?query=value#hash"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 min-w-[16rem]"
        />
      </ToolBar>
      <p className="text-sm text-fg-faint -mt-1 shrink-0">
        Parsed as you type. No scheme? <span className="font-mono">https://</span> is assumed.
      </p>

      {result && !result.ok && <Notice>{result.error}</Notice>}

      {u ? (
        <div className="flex flex-col gap-3 max-w-4xl">
          {u.assumedScheme && (
            <Notice tone="info">
              No scheme given — parsed as <span className="font-mono">{u.href}</span>
            </Notice>
          )}
          <Panel title="Parts" className="shrink-0">
            <KeyValueList copy mono labelWidth="6.5rem" rows={rows} />
          </Panel>
          <Panel title="Query parameters" icon={ListTree} meta={u.params.length ? String(u.params.length) : undefined} className="shrink-0">
            {u.params.length === 0 ? (
              <p className="px-3 py-3 text-base text-fg-faint">This URL has no query parameters.</p>
            ) : (
              <table className="w-full text-base" aria-label="Query parameters">
                <thead>
                  <tr className="text-left text-sm text-fg-faint border-b border-line">
                    <th className="font-medium px-3 py-1.5 w-[30%]">Key</th>
                    <th className="font-medium px-3 py-1.5">Value (decoded)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {u.params.map(([k, v], i) => {
                    const repeated = u.params.filter(([key]) => key === k).length > 1;
                    return (
                      <tr key={i} className="group">
                        <td className="px-3 py-2 font-mono text-[12.5px] text-accent-text break-all align-top selectable">
                          <span className="inline-flex items-center gap-1.5">
                            {k}
                            {repeated && <Badge>repeated</Badge>}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[12.5px] text-fg break-all align-top selectable">
                          {v === "" ? <span className="text-fg-faint italic">empty</span> : v}
                        </td>
                        <td className="pr-1.5 align-top opacity-60 group-hover:opacity-100">
                          <CopyButton text={v} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      ) : (
        !result && (
          <EmptyState icon={Link2} title="Take a URL apart" className="flex-1">
            Paste a URL to see its protocol, host, port, path, fragment and every decoded query parameter.
          </EmptyState>
        )
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "url-parser",
  name: "URL Parser",
  category: "Encoders",
  description: "Split a URL into host, path, port and decoded query parameters",
  icon: Link2,
  keywords: ["url", "uri", "parse", "query", "params", "host", "path", "querystring"],
  component: UrlParser,
};
