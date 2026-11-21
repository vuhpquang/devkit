import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Gauge, Play, Square, Timer } from "lucide-react";
import { fetch } from "@tauri-apps/plugin-http";
import type { ToolDef } from "../types";
import { Badge, Button, Notice, Spinner, ToolPage, cx } from "../../lib/ui";
import {
  BASE,
  formatBytes,
  formatMbps,
  runSpeedTest,
  type Phase,
  type Progress,
  type Result,
  type Transport,
  type Verdict,
} from "./logic";

const OFFLINE = "Couldn't reach Cloudflare. Check your connection.";

async function request(url: string, init: { method?: string; body?: Uint8Array; signal: AbortSignal }) {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || init.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    throw new Error(OFFLINE);
  }
  if (!res.ok) throw new Error(`Cloudflare answered ${res.status}. Try again in a minute.`);
  await res.arrayBuffer();
}

/** Cloudflare's speed endpoints through the Tauri HTTP plugin (speed.cloudflare.com is in the allow list). */
export const cloudflare: Transport = {
  now: () => performance.now(),
  download: (bytes, signal) => request(`${BASE}/__down?bytes=${bytes}`, { signal }),
  upload: (bytes, signal) =>
    request(`${BASE}/__up`, { method: "POST", body: new Uint8Array(bytes), signal }),
};

const VERDICT: Record<Verdict, { label: string; tone: "danger" | "accent" | "success"; hint: string }> = {
  slow: { label: "Slow", tone: "danger", hint: "Video calls and big downloads will struggle." },
  medium: { label: "Medium", tone: "accent", hint: "Fine for browsing, calls and HD video." },
  fast: { label: "Fast", tone: "success", hint: "Plenty for 4K video, large downloads and several people at once." },
};

const ORDER: Phase[] = ["latency", "download", "upload", "done"];

function Tile({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  active,
  pending,
}: {
  icon: typeof Gauge;
  label: string;
  value: string | null;
  unit: string;
  sub?: string;
  active: boolean;
  pending: boolean;
}) {
  return (
    <div
      className={cx(
        "flex-1 min-w-[11rem] rounded-xl border bg-surface px-5 py-4 transition-colors",
        active ? "border-accent/60 shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line",
      )}
    >
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Icon size={15} className={active ? "text-accent-text" : "text-fg-faint"} aria-hidden />
        {label}
        {active && <Spinner size={12} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cx("text-[34px] leading-none font-semibold tabular-nums", value === null ? "text-fg-faint" : "text-fg")}>
          {value ?? (pending ? "—" : "0")}
        </span>
        <span className="text-base text-fg-muted">{unit}</span>
      </div>
      <div className="mt-1.5 h-4 text-sm text-fg-faint tabular-nums">{sub}</div>
    </div>
  );
}

function SpeedTest() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function start() {
    const ac = new AbortController();
    abort.current = ac;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      setResult(await runSpeedTest(cloudflare, setProgress, ac.signal));
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError((e as Error).message || OFFLINE);
    } finally {
      setRunning(false);
      abort.current = null;
    }
  }

  const p = result ?? progress;
  const at = p ? ORDER.indexOf(p.phase) : -1;
  const active = (phase: Phase) => running && p?.phase === phase;
  const pending = (phase: Phase) => at < ORDER.indexOf(phase);
  const verdict = result ? VERDICT[result.verdict] : null;

  return (
    <ToolPage scroll>
      <div className="flex items-center gap-3 shrink-0">
        {running ? (
          <Button variant="primary" icon={Square} onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        ) : (
          <Button variant="primary" icon={Play} onClick={() => void start()}>
            {result ? "Test again" : "Start test"}
          </Button>
        )}
        <span className="text-sm text-fg-faint">
          {running
            ? p?.phase === "latency"
              ? "Measuring latency…"
              : p?.phase === "download"
                ? "Measuring download…"
                : "Measuring upload…"
            : "Latency, then download, then upload. Takes about 10–30 seconds."}
        </span>
      </div>

      {error && <Notice>{error}</Notice>}

      {verdict && result && (
        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface px-6 py-5 max-w-4xl shrink-0 dk-fade-in">
          <Gauge size={34} className="text-accent-text shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-fg">{verdict.label}</span>
              <Badge tone={verdict.tone}>{verdict.label} connection</Badge>
            </div>
            <p className="text-base text-fg-muted mt-1">{verdict.hint}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 max-w-4xl shrink-0">
        <Tile
          icon={Timer}
          label="Latency"
          value={p?.latencyMs != null ? p.latencyMs.toFixed(0) : null}
          unit="ms"
          sub={p?.jitterMs != null ? `jitter ${p.jitterMs.toFixed(1)} ms` : undefined}
          active={active("latency")}
          pending={pending("latency")}
        />
        <Tile
          icon={ArrowDown}
          label="Download"
          value={p?.downMbps != null ? formatMbps(p.downMbps) : null}
          unit="Mbit/s"
          active={active("download")}
          pending={pending("download")}
        />
        <Tile
          icon={ArrowUp}
          label="Upload"
          value={p?.upMbps != null ? formatMbps(p.upMbps) : null}
          unit="Mbit/s"
          active={active("upload")}
          pending={pending("upload")}
        />
      </div>

      {p && (
        <p className="text-sm text-fg-faint shrink-0">
          Measured against Cloudflare (speed.cloudflare.com); uses about {formatBytes(p.usedBytes)}.
        </p>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "speed-test",
  name: "Speed Test",
  category: "Network",
  description: "Latency, download and upload speed, rated slow, medium or fast",
  icon: Gauge,
  keywords: ["speed", "speedtest", "bandwidth", "internet", "download", "upload", "latency", "mbps", "slow", "fast"],
  online: true,
  component: SpeedTest,
};
