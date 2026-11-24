import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Globe, Radar, Route, Square } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, EditorPane, EmptyState, Notice, Panel, Segmented, Spinner, TextInput, ToolBar, ToolPage, cx } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { startProbe, stopProbe, type ProbeEvent } from "../../lib/system";
import {
  addSample,
  capLines,
  hopTime,
  parsePingLine,
  parseTraceLine,
  pingStats,
  validHost,
  type Hop,
  type Sample,
} from "./logic";

type Mode = "ping" | "traceroute";
type Count = "5" | "20" | "0";

const fmt = (ms: number | null, digits = 1) => (ms === null ? "—" : `${ms.toFixed(digits)} ms`);

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[5.5rem] px-3 py-2 rounded-lg border border-line bg-surface">
      <span className="text-xs text-fg-faint">{label}</span>
      <span className={cx("text-md font-semibold tabular-nums", tone === "danger" ? "text-danger" : "text-fg")}>{value}</span>
    </div>
  );
}

/** Latency of the last 60 samples; timeouts break the line and get a marker on the baseline. */
function LatencyChart({ samples }: { samples: Sample[] }) {
  const W = 600;
  const H = 140;
  const PAD_L = 44;
  const PAD_B = 14;
  const last = samples.slice(-60);
  const times = last.filter((s) => s.ms !== null).map((s) => s.ms as number);
  const top = Math.max(10, ...times) * 1.15;
  const x = (i: number) => PAD_L + (i / Math.max(59, 1)) * (W - PAD_L - 8);
  const y = (ms: number) => 8 + (1 - ms / top) * (H - PAD_B - 8);
  const segments: string[] = [];
  let cur = "";
  last.forEach((s, i) => {
    if (s.ms === null) {
      if (cur) segments.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(s.ms).toFixed(1)}`;
  });
  if (cur) segments.push(cur);
  const ticks = [0, top / 2, top];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[150px]" role="img" aria-label="Latency chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={W - 4} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={PAD_L - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-faint)">
            {t.toFixed(t < 10 ? 1 : 0)}
          </text>
        </g>
      ))}
      <text x={4} y={12} fontSize="10" fill="var(--text-faint)">
        ms
      </text>
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {last.map((s, i) =>
        s.ms === null ? (
          <g key={s.seq}>
            <title>{`Timeout (seq ${s.seq})`}</title>
            <line x1={x(i)} x2={x(i)} y1={y(0) - 10} y2={y(0)} stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" />
          </g>
        ) : (
          last.length <= 30 && <circle key={s.seq} cx={x(i)} cy={y(s.ms)} r={2.5} fill="var(--accent)" />
        ),
      )}
    </svg>
  );
}

function HopTable({ hops }: { hops: Hop[] }) {
  const slowest = Math.max(1, ...hops.map((h) => hopTime(h) ?? 0));
  return (
    <table className="w-full text-base">
      <thead>
        <tr className="text-left text-sm text-fg-faint border-b border-line">
          <th className="font-medium px-3 py-1.5 w-12 text-right">Hop</th>
          <th className="font-medium px-3 py-1.5">Address</th>
          <th className="font-medium px-3 py-1.5 w-24 text-right">Time</th>
          <th className="font-medium px-3 py-1.5 w-[30%]" />
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {hops.map((h) => {
          const t = hopTime(h);
          const silent = h.address === null;
          return (
            <tr key={h.hop} className={silent ? "text-fg-faint" : "text-fg"}>
              <td className="px-3 py-1.5 text-right tabular-nums">{h.hop}</td>
              <td className="px-3 py-1.5 font-mono text-[12.5px] selectable">{silent ? "* no reply" : h.address}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t === null ? "—" : `${t.toFixed(1)} ms`}</td>
              <td className="px-3 py-1.5">
                {t !== null && (
                  <span className="block h-1.5 rounded-full bg-accent/70" style={{ width: `${Math.max(3, (t / slowest) * 100)}%` }} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PingTraceroute() {
  const [mode, setMode] = useSaved<Mode>("mode", "ping", { valid: (v) => v === "ping" || v === "traceroute" });
  const [host, setHost] = useSaved("host", "");
  const [count, setCount] = useSaved<Count>("count", "5", { valid: (v) => v === "5" || v === "20" || v === "0" });
  const [runId, setRunId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [hops, setHops] = useState<Map<number, Hop>>(() => new Map());
  const [target, setTarget] = useState<string | null>(null);
  const runRef = useRef<number | null>(null);
  runRef.current = runId;

  // Stop a running probe when the tool closes.
  useEffect(
    () => () => {
      if (runRef.current !== null) void stopProbe(runRef.current).catch(() => {});
    },
    [],
  );

  const running = runId !== null;

  /** `run.done` lets a probe that ends before startProbe resolves (bad host) not leave Stop showing. */
  const onEvent = (kind: Mode, run: { done: boolean }) => (e: ProbeEvent) => {
    if (e.kind === "done") {
      run.done = true;
      setRunId(null);
      return;
    }
    setLines((l) => capLines(l, e.text));
    if (kind === "ping") {
      const p = parsePingLine(e.text);
      if (p.kind === "error") setError(p.message);
      else setSamples((s) => addSample(s, p));
    } else {
      const t = parseTraceLine(e.text);
      if (t.kind === "header") setTarget(t.address ? `${t.target} (${t.address})` : t.target);
      else if (t.kind === "hop") setHops((m) => new Map(m).set(t.hop.hop, t.hop));
      else if (t.kind === "error") setError(t.message);
    }
  };

  async function start() {
    if (!validHost(host)) {
      setError("Enter a host name or an IP address, e.g. 1.1.1.1 or example.com.");
      return;
    }
    setError(null);
    setLines([]);
    setSamples([]);
    setHops(new Map());
    setTarget(null);
    setStarted(true);
    setStarting(true);
    try {
      const run = { done: false };
      const id = await startProbe(mode, host.trim(), mode === "ping" ? Number(count) : 0, onEvent(mode, run));
      if (!run.done) setRunId(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    if (runId !== null) await stopProbe(runId).catch((e: Error) => setError(e.message));
  }

  const stats = useMemo(() => pingStats(samples), [samples]);
  const hopList = useMemo(() => [...hops.values()].sort((a, b) => a.hop - b.hop), [hops]);
  const raw = lines.join("\n");

  return (
    <ToolPage>
      <ToolBar>
        <Segmented<Mode>
          label="Probe"
          value={mode}
          onChange={(m) => {
            if (!running) setMode(m);
          }}
          options={[
            { value: "ping", label: "Ping", icon: Activity },
            { value: "traceroute", label: "Traceroute", icon: Route },
          ]}
        />
        {mode === "ping" && (
          <Segmented<Count>
            label="Count"
            size="sm"
            value={count}
            onChange={setCount}
            options={[
              { value: "5", label: "5" },
              { value: "20", label: "20" },
              { value: "0", label: "Continuous" },
            ]}
          />
        )}
      </ToolBar>

      <form
        className="flex items-center gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (running) void stop();
          else if (!starting) void start();
        }}
      >
        <TextInput
          autoFocus
          mono
          icon={Globe}
          aria-label="Host"
          placeholder="1.1.1.1 or example.com"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          disabled={running}
          className="flex-1 min-w-[16rem]"
        />
        {running ? (
          <Button type="submit" variant="primary" icon={Square}>
            Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" kbd={starting ? undefined : "↵"} disabled={starting || !host.trim()}>
            {starting && <Spinner />}
            {mode === "ping" ? "Ping" : "Trace"}
          </Button>
        )}
      </form>

      {error && <Notice>{error}</Notice>}

      {!started ? (
        <EmptyState icon={Radar} title={mode === "ping" ? "Ping a host" : "Trace the route to a host"} className="flex-1">
          {mode === "ping"
            ? "Round-trip time and packet loss, live, with a latency chart."
            : "Every router between this Mac and the host, with the time to each."}
        </EmptyState>
      ) : mode === "ping" ? (
        <>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Stat label="Sent" value={String(stats.sent)} />
            <Stat label="Received" value={String(stats.received)} />
            <Stat label="Loss" value={`${stats.lossPct.toFixed(stats.lossPct % 1 ? 1 : 0)}%`} tone={stats.lossPct > 0 ? "danger" : undefined} />
            <Stat label="Min" value={fmt(stats.min)} />
            <Stat label="Avg" value={fmt(stats.avg)} />
            <Stat label="Max" value={fmt(stats.max)} />
            <Stat label="Jitter" value={fmt(stats.jitter)} />
          </div>
          <Panel title="Latency" meta={samples.length > 60 ? "last 60" : undefined} className="shrink-0" bodyClassName="px-2 py-2">
            {samples.length ? <LatencyChart samples={samples} /> : <div className="h-[150px] grid place-items-center text-fg-faint"><Spinner /></div>}
          </Panel>
          <EditorPane title="Output" value={raw} readOnly wrap lineNumbers={false} className="flex-1 min-h-32" />
        </>
      ) : (
        <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 min-[980px]:grid-cols-[1.3fr_1fr] auto-rows-[minmax(0,1fr)]">
          <Panel title="Hops" meta={target ?? undefined} bodyClassName="overflow-auto">
            {hopList.length ? (
              <HopTable hops={hopList} />
            ) : (
              <div className="h-full grid place-items-center text-fg-faint">{running ? <Spinner /> : "No hops"}</div>
            )}
          </Panel>
          <EditorPane title="Output" value={raw} readOnly wrap lineNumbers={false} />
        </div>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "ping-traceroute",
  name: "Ping & Traceroute",
  category: "Network",
  description: "Latency, packet loss and the route to any host, live",
  icon: Radar,
  keywords: ["ping", "traceroute", "latency", "packet loss", "route", "hops", "icmp", "network"],
  online: true,
  component: PingTraceroute,
};
