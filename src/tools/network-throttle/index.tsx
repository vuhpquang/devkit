import { useCallback, useEffect, useState } from "react";
import { Gauge, Power, ShieldCheck, Snail } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EmptyState, Field, Notice, Panel, Segmented, Spinner, ToolPage, cx } from "../../lib/ui";
import { isCancelled, throttleStart, throttleStatus, throttleStop, type ThrottleProfile } from "../../lib/system";
import { useSaved } from "../../lib/saved";
import { CUSTOM_DEFAULT, DURATIONS, formatKbps, parseActive, PRESETS, presetName, remaining, validate, type ActiveProfile } from "./logic";

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  log = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  /** Logarithmic scale (bandwidth spans 32 Kbit/s – 100 Mbit/s). */
  log?: boolean;
}) {
  const toPos = (v: number) => (log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min));
  const fromPos = (p: number) => (log ? Math.round(Math.exp(Math.log(min) + p * (Math.log(max) - Math.log(min)))) : Math.round((min + p * (max - min)) / (step ?? 1)) * (step ?? 1));
  return (
    <Field label={label} hint={<span className="font-mono text-fg">{format(value)}</span>}>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(toPos(value) * 1000)}
        onChange={(e) => onChange(fromPos(Number(e.target.value) / 1000))}
        className="accent-[var(--accent)] w-full"
        aria-label={label}
      />
    </Field>
  );
}

function NetworkThrottle() {
  const [active, setActive] = useState<ActiveProfile | null>(null);
  const [checked, setChecked] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [choice, setChoice] = useSaved<string>("choice", "medium", {
    valid: (v) => v === "custom" || PRESETS.some((p) => p.preset === v),
  });
  const [custom, setCustom] = useSaved<ThrottleProfile>("custom", CUSTOM_DEFAULT, {
    valid: (v) => !!v && typeof v === "object" && (v as ThrottleProfile).preset === "custom" && validate(v as ThrottleProfile) === null,
  });
  const [minutes, setMinutes] = useSaved<(typeof DURATIONS)[number]>("minutes", 30, {
    valid: (v) => (DURATIONS as readonly unknown[]).includes(v),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const s = await throttleStatus();
      setActive(s.active ? parseActive(s.profile) : null);
      setUnavailable(null);
    } catch (e) {
      setUnavailable((e as Error).message);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);
  // While it's on: tick the countdown and notice when the watcher switched it off (time limit, quit).
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      tick((n) => n + 1);
      void refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [active, refresh]);

  const profile: ThrottleProfile = choice === "custom" ? custom : PRESETS.find((p) => p.preset === choice)!;
  const invalid = validate(profile);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await throttleStart(profile, minutes);
      await refresh();
    } catch (e) {
      if (!isCancelled(e)) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await throttleStop();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (unavailable) {
    return (
      <ToolPage>
        <EmptyState icon={Snail} title="Open DevKit to throttle the network">
          {unavailable}
        </EmptyState>
      </ToolPage>
    );
  }
  if (!checked) {
    return (
      <ToolPage>
        <div className="flex-1 grid place-items-center text-fg-muted">
          <Spinner size={18} />
        </div>
      </ToolPage>
    );
  }

  return (
    <ToolPage scroll>
      <div
        className={cx(
          "flex items-center gap-4 rounded-xl border px-5 py-4 shrink-0 max-w-4xl",
          active ? "bg-accent-soft border-accent/50" : "bg-surface border-line",
        )}
      >
        <span className={cx("grid place-items-center w-11 h-11 rounded-xl", active ? "bg-accent text-on-accent" : "bg-success-soft text-success")}>
          {active ? <Snail size={22} aria-hidden /> : <Gauge size={22} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-fg">{active ? `Throttled: ${presetName(active.preset)}` : "Network runs at full speed"}</p>
          <p className="text-base text-fg-muted tabular-nums">
            {active
              ? `↓ ${formatKbps(active.downKbps)} · ↑ ${formatKbps(active.upKbps)} · +${active.delayMs} ms · ${active.lossPct}% loss · ${remaining(active.until)}`
              : "Pick a profile below to simulate a slow connection for the whole Mac."}
          </p>
        </div>
        {active && (
          <Button variant="primary" icon={Power} onClick={() => void stop()} disabled={busy}>
            {busy ? "Turning off…" : "Turn off"}
          </Button>
        )}
      </div>

      {error && <Notice>{error}</Notice>}

      <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] max-w-4xl shrink-0">
        {[...PRESETS, { ...custom, name: "Custom", note: "Your own numbers" }].map((p) => {
          const on = choice === p.preset;
          const running = active?.preset === p.preset;
          return (
            <button
              key={p.preset}
              type="button"
              aria-pressed={on}
              onClick={() => setChoice(p.preset)}
              className={cx(
                "text-left flex flex-col gap-1 p-3.5 rounded-xl border bg-surface transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                on ? "border-accent/60 shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line hover:border-line-strong",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="text-md font-semibold text-fg">{p.name}</span>
                {running && <Badge tone="accent">On</Badge>}
              </span>
              <span className="text-sm text-fg-faint">{p.note}</span>
              {p.preset !== "custom" && (
                <span className="text-sm text-fg-muted tabular-nums mt-1">
                  ↓ {formatKbps(p.downKbps)} · ↑ {formatKbps(p.upKbps)}
                  <br />+{p.delayMs} ms{p.lossPct ? ` · ${p.lossPct}% loss` : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {choice === "custom" && (
        <Panel title="Custom profile" className="shrink-0 max-w-4xl" bodyClassName="p-4 grid gap-4 grid-cols-1 min-[760px]:grid-cols-2">
          <Slider label="Download" value={custom.downKbps} min={32} max={100_000} log format={formatKbps} onChange={(downKbps) => setCustom({ ...custom, downKbps })} />
          <Slider label="Upload" value={custom.upKbps} min={32} max={100_000} log format={formatKbps} onChange={(upKbps) => setCustom({ ...custom, upKbps })} />
          <Slider label="Added latency (round trip)" value={custom.delayMs} min={0} max={2000} step={10} format={(v) => `${v} ms`} onChange={(delayMs) => setCustom({ ...custom, delayMs })} />
          <Slider label="Packet loss" value={custom.lossPct} min={0} max={20} step={1} format={(v) => `${v} %`} onChange={(lossPct) => setCustom({ ...custom, lossPct })} />
        </Panel>
      )}

      <div className="flex items-center gap-3 flex-wrap shrink-0 max-w-4xl">
        <span className="text-base text-fg-muted">Turn off after</span>
        <Segmented
          label="Turn off after"
          size="sm"
          value={String(minutes)}
          onChange={(v) => setMinutes(Number(v) as (typeof DURATIONS)[number])}
          options={DURATIONS.map((m) => ({ value: String(m), label: m < 60 ? `${m} min` : `${m / 60} h` }))}
        />
        <div className="flex-1" />
        <Button variant="primary" icon={Snail} disabled={busy || !!invalid} onClick={() => void start()}>
          {busy && !active ? "Turning on…" : active ? `Switch to ${presetName(profile.preset)}` : `Throttle to ${presetName(profile.preset)}`}
        </Button>
      </div>
      {invalid && <Notice>{invalid}</Notice>}

      <p className="text-sm text-fg-faint flex items-start gap-1.5 max-w-4xl shrink-0">
        <ShieldCheck size={14} className="shrink-0 mt-[1px]" aria-hidden />
        Slows every app on this Mac except localhost. Turning it on asks for your administrator password; it switches off
        by itself when you press Turn off, quit DevKit, or the time runs out.
      </p>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "network-throttle",
  name: "Network Throttle",
  category: "System",
  description: "Simulate a slow, medium or fast connection for the whole Mac",
  icon: Snail,
  keywords: ["throttle", "slow", "network", "link conditioner", "3g", "4g", "latency", "bandwidth", "packet loss", "simulate"],
  component: NetworkThrottle,
};
