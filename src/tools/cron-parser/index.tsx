import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CalendarClock, ListOrdered, Timer } from "lucide-react";
import type { ToolDef } from "../types";
import { Button, EmptyState, Field, Notice, Panel, Segmented, TextInput, ToolPage } from "../../lib/ui";
import { relativeTime } from "../timestamp/logic";
import { PRESETS, nextRuns, parseCron } from "./logic";

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function CronParser() {
  const [expr, setExpr] = useState("0 9 * * 1-5");
  const [zone, setZone] = useState<"local" | "utc">("local");
  const deferred = useDeferredValue(expr);
  const parsed = useMemo(() => parseCron(deferred), [deferred]);
  const now = useMinuteClock();
  const utc = zone === "utc";

  const runs = useMemo(() => {
    if (!parsed.ok) return [];
    try {
      return nextRuns(parsed.expanded, now, 10, utc);
    } catch {
      return [];
    }
  }, [parsed, now, utc]);

  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: parsed.ok && parsed.hasSeconds ? "2-digit" : undefined,
      timeZone: utc ? "UTC" : undefined,
    });

  return (
    <ToolPage scroll>
      <div className="flex items-end gap-2 shrink-0 max-w-4xl flex-wrap">
        <Field label="Cron expression" className="flex-1 min-w-[18rem]" hint="minute hour day-of-month month day-of-week · seconds first if 6 fields · @daily and friends">
          <TextInput
            autoFocus
            mono
            aria-label="Cron expression"
            value={expr}
            placeholder="*/15 * * * *"
            onChange={(e) => setExpr(e.target.value)}
            className="text-md"
          />
        </Field>
        <div className="mb-[22px]">
          <Segmented
            label="Time zone"
            value={zone}
            onChange={setZone}
            options={[
              { value: "local", label: "Local" },
              { value: "utc", label: "UTC" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        <span className="text-sm text-fg-faint mr-1">Presets</span>
        {PRESETS.map((p) => (
          <Button key={p.expr} size="sm" onClick={() => setExpr(p.expr)} aria-pressed={expr.trim() === p.expr}>
            {p.label}
          </Button>
        ))}
      </div>

      {!parsed.ok ? (
        expr.trim() ? (
          <Notice>{parsed.error}</Notice>
        ) : (
          <EmptyState icon={Timer} title="Explain a cron schedule" className="flex-1">
            Type an expression or pick a preset to see what it means and when it runs next.
          </EmptyState>
        )
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface px-5 py-4 max-w-4xl shrink-0">
            <p className="text-sm text-fg-faint">Runs</p>
            <p className="text-xl font-semibold text-fg mt-0.5 selectable" data-testid="cron-description">
              {parsed.description}
            </p>
            {parsed.expanded !== expr.trim() && (
              <p className="text-sm text-fg-faint mt-1 font-mono selectable">= {parsed.expanded}</p>
            )}
          </div>
          <div className="grid gap-3 max-w-4xl shrink-0 grid-cols-1 min-[900px]:grid-cols-2">
            <Panel title="Fields" icon={ListOrdered}>
              <table className="w-full text-base">
                <tbody className="divide-y divide-line">
                  {parsed.fields.map((f) => (
                    <tr key={f.name}>
                      <td className="px-3 py-2 text-sm text-fg-muted w-32">{f.name}</td>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-accent-text w-24 selectable">{f.raw}</td>
                      <td className="px-3 py-2 text-fg selectable">{f.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Next runs" icon={CalendarClock} meta={utc ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone}>
              <ol className="divide-y divide-line">
                {runs.map((d, i) => (
                  <li key={d.getTime()} className="flex items-center gap-3 px-3 h-9">
                    <span className="w-5 text-right text-sm text-fg-faint tabular-nums">{i + 1}</span>
                    <span className="flex-1 text-fg tabular-nums selectable">{fmt(d)}</span>
                    <span className="text-sm text-fg-faint">{relativeTime(d, now)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "cron-parser",
  name: "Cron Parser",
  category: "Converters",
  description: "Explain a cron expression and list its next runs",
  icon: Timer,
  keywords: ["cron", "crontab", "schedule", "job", "quartz", "next run"],
  component: CronParser,
};
