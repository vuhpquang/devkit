import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlugZap, RefreshCw, Search } from "lucide-react";
import type { ToolDef } from "../types";
import {
  Badge,
  Button,
  CopyButton,
  EmptyState,
  Notice,
  Panel,
  Segmented,
  TextInput,
  Toggle,
  ToolBar,
  ToolBarDivider,
  ToolPage,
  cx,
} from "../../lib/ui";
import { killProcess, listPorts, NotInApp } from "../../lib/system";
import { COMMON_PORTS, filterRows, parseLsof, scopeLabel, stillListening, type PortRow, type ProtoFilter } from "./logic";

const rowKey = (r: PortRow) => `${r.pid}/${r.protocol}/${r.port}`;

/** Per-row action state: confirming a stop, waiting to see if it worked, offering Force quit, or an error. */
type RowState = { kind: "confirm" } | { kind: "stopping" } | { kind: "stubborn" } | { kind: "error"; message: string };

function PortInspector() {
  const [rows, setRows] = useState<PortRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<{ message: string; notInApp: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [proto, setProto] = useState<ProtoFilter>("TCP");
  const [auto, setAuto] = useState(false);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const live = useRef(true);

  const refresh = useCallback(async (): Promise<PortRow[] | null> => {
    try {
      const next = parseLsof(await listPorts());
      if (live.current) {
        setRows(next);
        setError(null);
        setLoaded(true);
      }
      return next;
    } catch (e) {
      if (live.current) setError({ message: (e as Error).message, notInApp: e instanceof NotInApp });
      return null;
    }
  }, []);

  useEffect(() => {
    live.current = true;
    void refresh();
    return () => {
      live.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [auto, refresh]);

  const setState = (key: string, s: RowState | null) =>
    setStates((prev) => {
      const next = { ...prev };
      if (s) next[key] = s;
      else delete next[key];
      return next;
    });

  const stop = async (r: PortRow, force: boolean) => {
    const key = rowKey(r);
    setState(key, { kind: "stopping" });
    try {
      await killProcess(r.pid, force);
    } catch (e) {
      setState(key, { kind: "error", message: (e as Error).message });
      return;
    }
    await new Promise((res) => setTimeout(res, 2000));
    const next = await refresh();
    if (!live.current) return;
    setState(key, next && stillListening(next, r.pid, r.port) ? { kind: "stubborn" } : null);
  };

  const shown = useMemo(() => filterRows(rows, query, proto), [rows, query, proto]);

  if (error?.notInApp) {
    return (
      <ToolPage>
        <EmptyState icon={PlugZap} title="Open DevKit to inspect ports">
          {error.message}
        </EmptyState>
      </ToolPage>
    );
  }

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            <Toggle size="sm" on={auto} onToggle={() => setAuto((v) => !v)} title="Refresh every 3 seconds" className="font-medium">
              Auto refresh
            </Toggle>
            <Button size="sm" icon={RefreshCw} onClick={() => void refresh()}>
              Refresh
            </Button>
          </>
        }
      >
        <TextInput
          icon={Search}
          aria-label="Filter by port, process or PID"
          placeholder="Port, process or PID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-56"
          autoFocus
        />
        <Segmented<ProtoFilter>
          label="Protocol"
          size="sm"
          value={proto}
          onChange={setProto}
          options={[
            { value: "TCP", label: "TCP" },
            { value: "UDP", label: "UDP" },
            { value: "all", label: "All" },
          ]}
        />
        <ToolBarDivider />
        <div role="group" aria-label="Common dev ports" className="flex items-center gap-1 flex-wrap">
          {COMMON_PORTS.map((p) => (
            <Toggle key={p} size="sm" mono on={query === String(p)} onToggle={() => setQuery(query === String(p) ? "" : String(p))}>
              {p}
            </Toggle>
          ))}
        </div>
      </ToolBar>

      {error && <Notice>{error.message}</Notice>}

      <Panel
        title="Listening"
        meta={loaded ? `${shown.length} of ${rows.length}` : undefined}
        className="flex-1"
        bodyClassName="overflow-auto"
        footer={
          <p className="px-3 h-8 flex items-center text-sm text-fg-faint">
            Shows your own processes. Ports held by other users or the system need sudo lsof.
          </p>
        }
      >
        {loaded && rows.length === 0 ? (
          <EmptyState icon={PlugZap} title="Nothing is listening">
            None of your processes has a port open right now.
          </EmptyState>
        ) : loaded && shown.length === 0 ? (
          <EmptyState icon={Search} title="No match">
            Nothing on “{query.trim()}”{proto !== "all" ? ` over ${proto}` : ""}.
          </EmptyState>
        ) : (
          <table className="w-full text-base">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="text-left text-sm text-fg-faint border-b border-line">
                <th className="font-medium px-3 py-1.5 w-24">Port</th>
                <th className="font-medium px-3 py-1.5">Process</th>
                <th className="font-medium px-3 py-1.5 w-20 text-right">PID</th>
                <th className="font-medium px-3 py-1.5">Address</th>
                <th className="w-[13.5rem]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => {
                const key = rowKey(r);
                const st = states[key];
                return (
                  <tr key={key} className={cx("group align-middle", st?.kind === "confirm" && "bg-danger-soft")}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-md font-semibold text-fg tabular-nums selectable">{r.port}</span>
                        {r.protocol === "UDP" && <Badge>UDP</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-fg selectable">{r.command}</span>
                      <span className="text-sm text-fg-faint ml-1.5">{r.user}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12.5px] text-fg-muted tabular-nums selectable">{r.pid}</td>
                    <td className="px-3 py-2 text-sm text-fg-muted">{scopeLabel(r)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        {!st && (
                          <>
                            <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={`kill ${r.pid}`} label={`Copy “kill ${r.pid}”`} />
                            </span>
                            <Button size="sm" onClick={() => setState(key, { kind: "confirm" })}>
                              Stop
                            </Button>
                          </>
                        )}
                        {st?.kind === "confirm" && (
                          <>
                            <span className="text-sm text-danger mr-1 whitespace-nowrap">Stop {r.command}?</span>
                            <Button size="sm" onClick={() => setState(key, null)}>
                              Cancel
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => void stop(r, false)}>
                              Stop
                            </Button>
                          </>
                        )}
                        {st?.kind === "stopping" && <span className="text-sm text-fg-muted">Stopping…</span>}
                        {st?.kind === "stubborn" && (
                          <>
                            <span className="text-sm text-fg-muted mr-1 whitespace-nowrap">Still running</span>
                            <Button size="sm" onClick={() => setState(key, null)}>
                              Leave it
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => void stop(r, true)}>
                              Force quit
                            </Button>
                          </>
                        )}
                        {st?.kind === "error" && (
                          <>
                            <span className="text-sm text-danger mr-1 truncate max-w-[9rem]" title={st.message}>
                              {st.message}
                            </span>
                            <Button size="sm" onClick={() => setState(key, null)}>
                              OK
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "port-inspector",
  name: "Port Inspector",
  category: "System",
  description: "Which process is using a port, and stop it",
  icon: PlugZap,
  keywords: ["port", "lsof", "listen", "kill", "process", "in use", "eaddrinuse", "address already in use", "pid"],
  component: PortInspector,
};
