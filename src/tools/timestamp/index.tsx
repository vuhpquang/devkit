import { useEffect, useState } from "react";
import { CalendarClock, Clock } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, CopyButton, Field, KeyValueList, Panel, Segmented, TextInput, ToolPage } from "../../lib/ui";
import { guessUnit, isoToEpoch, parseEpoch, relativeTime, type EpochUnit } from "./logic";

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function Timestamp() {
  const now = useNow();
  const [epoch, setEpoch] = useState("");
  const [unit, setUnit] = useState<EpochUnit>("s");
  const [iso, setIso] = useState("");
  const [epochErr, setEpochErr] = useState<string | null>(null);
  const [isoErr, setIsoErr] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);

  const fromEpoch = (text: string, u: EpochUnit) => {
    setEpoch(text);
    setIsoErr(null);
    if (!text.trim()) {
      setEpochErr(null);
      setDate(null);
      setIso("");
      return;
    }
    const r = parseEpoch(text, u);
    if (r.ok) {
      setEpochErr(null);
      setDate(r.value);
      setIso(r.value.toISOString());
    } else setEpochErr(r.error);
  };

  const fromIso = (text: string) => {
    setIso(text);
    setEpochErr(null);
    if (!text.trim()) {
      setIsoErr(null);
      setDate(null);
      setEpoch("");
      return;
    }
    const r = isoToEpoch(text);
    if (r.ok) {
      const d = new Date(Date.parse(text));
      setIsoErr(null);
      setDate(d);
      setEpoch(unit === "s" ? String(r.value) : String(d.getTime()));
    } else setIsoErr("Not a date this tool can read — try 2026-01-31T12:00:00Z");
  };

  const useNowValue = () => {
    const ms = Date.now();
    fromEpoch(unit === "s" ? String(Math.floor(ms / 1000)) : String(ms), unit);
  };

  const nowSec = String(Math.floor(now.getTime() / 1000));

  return (
    <ToolPage scroll>
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 h-12 shrink-0 max-w-3xl">
        <Clock size={16} className="text-accent-text" aria-hidden />
        <span className="text-base text-fg-muted">Now</span>
        <span className="font-mono text-md text-fg tabular-nums selectable">{nowSec}</span>
        <span className="text-sm text-fg-faint truncate hidden min-[760px]:inline">{now.toISOString()}</span>
        <div className="flex-1" />
        <CopyButton text={nowSec} label="Copy current Unix time" />
        <Button size="sm" onClick={useNowValue}>Use now</Button>
      </div>

      <div className="grid gap-4 max-w-3xl shrink-0 min-[760px]:grid-cols-2">
        <Field label="Unix time" hint={epochErr ? <span className="text-danger">{epochErr}</span> : unit === "s" ? "Seconds since 1970-01-01 UTC" : "Milliseconds since 1970-01-01 UTC"}>
          <div className="flex gap-2">
            <TextInput
              mono
              autoFocus
              className="flex-1 min-w-0"
              value={epoch}
              placeholder={unit === "s" ? "1700000000" : "1700000000000"}
              onChange={(e) => {
                const text = e.target.value;
                const guessed = guessUnit(text);
                if (text.trim().length >= 10 && guessed !== unit) setUnit(guessed);
                fromEpoch(text, text.trim().length >= 10 ? guessed : unit);
              }}
            />
            <Segmented
              label="Unit"
              size="md"
              value={unit}
              onChange={(u) => {
                setUnit(u);
                fromEpoch(epoch, u);
              }}
              options={[
                { value: "s", label: "s", hint: "Seconds" },
                { value: "ms", label: "ms", hint: "Milliseconds" },
              ]}
            />
          </div>
        </Field>
        <Field label="Date and time (ISO 8601)" hint={isoErr ? <span className="text-danger">{isoErr}</span> : "Any format JavaScript's Date can parse"}>
          <TextInput mono value={iso} placeholder="2026-01-31T12:00:00.000Z" onChange={(e) => fromIso(e.target.value)} />
        </Field>
      </div>

      {date && (
        <Panel title="Result" icon={CalendarClock} className="shrink-0 max-w-3xl">
          <KeyValueList
            copy
            labelWidth="9rem"
            rows={[
              { label: "UTC (ISO 8601)", value: date.toISOString(), mono: true },
              { label: `Local · ${tz}`, value: date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }) },
              { label: "Relative", value: relativeTime(date, now) },
              { label: "Unix seconds", value: String(Math.floor(date.getTime() / 1000)), mono: true },
              { label: "Unix milliseconds", value: String(date.getTime()), mono: true },
              { label: "RFC 2822", value: date.toUTCString(), mono: true },
            ]}
          />
        </Panel>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "timestamp",
  name: "Timestamp Converter",
  category: "Converters",
  description: "Unix time ↔ human dates, in UTC and your time zone",
  icon: CalendarClock,
  keywords: ["timestamp", "epoch", "unix", "date", "iso"],
  component: Timestamp,
};
