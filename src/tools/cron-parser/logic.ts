import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export const PRESETS: { label: string; expr: string }[] = [
  { label: "Every minute", expr: "* * * * *" },
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily 9:00", expr: "0 9 * * *" },
  { label: "Weekdays 9:00", expr: "0 9 * * 1-5" },
  { label: "Monthly", expr: "0 0 1 * *" },
];

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface Unit {
  name: string;
  singular: string;
  plural: string;
  label?: (n: number) => string;
  alias?: string[];
  aliasBase?: number;
}

const UNITS: Record<string, Unit> = {
  second: { name: "Second", singular: "second", plural: "seconds" },
  minute: { name: "Minute", singular: "minute", plural: "minutes" },
  hour: { name: "Hour", singular: "hour", plural: "hours" },
  dom: { name: "Day of month", singular: "day", plural: "days" },
  month: { name: "Month", singular: "month", plural: "months", label: (n) => MONTHS[n] ?? String(n), alias: MONTH_ABBR, aliasBase: 1 },
  dow: { name: "Day of week", singular: "weekday", plural: "weekdays", label: (n) => DAYS[n] ?? String(n), alias: DAY_ABBR, aliasBase: 0 },
};

export interface CronField {
  name: string;
  raw: string;
  meaning: string;
}

/** "3" → "3", "jan" → 1 → "January" (via the unit's labels). */
function value(token: string, unit: Unit): string {
  const t = token.toLowerCase();
  const idx = unit.alias?.indexOf(t) ?? -1;
  const n = idx >= 0 ? idx + (unit.aliasBase ?? 0) : Number(t);
  if (!Number.isFinite(n)) return token;
  return unit.label ? unit.label(n) : String(n);
}

/** Plain-English meaning of one cron field, e.g. "*\/15" in minutes → "every 15 minutes". */
export function describeField(raw: string, unitKey: keyof typeof UNITS): string {
  const unit = UNITS[unitKey];
  if (raw === "*" || raw === "?") return `every ${unit.singular}`;
  const parts = raw.split(",").map((part) => {
    const [range, step] = part.split("/");
    let base: string;
    if (range === "*" || range === "?") base = "";
    else if (range.includes("-")) {
      const [a, b] = range.split("-");
      base = `${value(a, unit)} through ${value(b, unit)}`;
    } else if (/[LW#]/i.test(range)) base = `${range} (special)`;
    else base = value(range, unit);
    if (step) return base ? `every ${step} ${unit.plural} from ${base}` : `every ${step} ${unit.plural}`;
    return base;
  });
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return list.startsWith("every") ? list : `${unit.singular === "weekday" || unit.singular === "month" ? "" : `${unit.singular} `}${list}`.trim();
}

export type Parsed =
  | { ok: true; expanded: string; description: string; fields: CronField[]; hasSeconds: boolean }
  | { ok: false; error: string };

/** Validates an expression and explains it. Accepts 5 fields, 6 with seconds first, or a @macro. */
export function parseCron(input: string): Parsed {
  const expr = input.trim().replace(/\s+/g, " ");
  if (!expr) return { ok: false, error: "Enter a cron expression" };
  const lower = expr.toLowerCase();
  if (lower === "@reboot") return { ok: false, error: "@reboot runs once at startup, not on a schedule" };
  const expanded = MACROS[lower] ?? expr;
  if (expanded.startsWith("@")) return { ok: false, error: `Unknown macro ${expr} — try @hourly, @daily, @weekly, @monthly or @yearly` };
  const tokens = expanded.split(" ");
  if (tokens.length !== 5 && tokens.length !== 6) {
    return {
      ok: false,
      error: `Expected 5 fields (minute hour day-of-month month day-of-week) or 6 with seconds first — got ${tokens.length}`,
    };
  }
  try {
    CronExpressionParser.parse(expanded, { currentDate: new Date(0), tz: "UTC" });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  let description: string;
  try {
    description = cronstrue.toString(expanded, { use24HourTimeFormat: true, throwExceptionOnParseError: true });
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) };
  }
  const hasSeconds = tokens.length === 6;
  const keys: (keyof typeof UNITS)[] = hasSeconds
    ? ["second", "minute", "hour", "dom", "month", "dow"]
    : ["minute", "hour", "dom", "month", "dow"];
  const fields = keys.map((k, i) => ({ name: UNITS[k].name, raw: tokens[i], meaning: describeField(tokens[i], k) }));
  return { ok: true, expanded, description, fields, hasSeconds };
}

/** The next `count` run times after `from`. `utc` evaluates the schedule in UTC instead of local time. */
export function nextRuns(expanded: string, from: Date, count = 10, utc = false): Date[] {
  const it = CronExpressionParser.parse(expanded, { currentDate: from, ...(utc ? { tz: "UTC" } : {}) });
  return it.take(count).map((d) => d.toDate());
}
