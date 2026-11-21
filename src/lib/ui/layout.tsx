import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, ClipboardPaste, Eraser, Info, type LucideIcon } from "lucide-react";
import { Button, CopyButton, cx } from "./primitives";
import { CodeEditor, type Lang } from "./CodeEditor";

/* ---------------------------------------------------------------- ToolPage */

/** The body of every tool: padded column that fills the content area. */
export function ToolPage({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  return (
    <div className={cx("h-full min-h-0 flex flex-col gap-3 p-4", scroll ? "overflow-auto" : "overflow-hidden")}>
      {children}
    </div>
  );
}

/** Row of controls above a tool's panes: options on the left, actions on the right. */
export function ToolBar({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap shrink-0 min-h-8">
      {children}
      <div className="flex-1" />
      {end}
    </div>
  );
}

/** Thin vertical rule between toolbar groups. */
export function ToolBarDivider() {
  return <span className="w-px h-5 bg-line mx-1" aria-hidden />;
}

/** Side-by-side panes that stack below ~720 px. */
export function Split({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("grid gap-3 min-h-0 flex-1 grid-cols-1 min-[720px]:grid-cols-2 auto-rows-[minmax(0,1fr)]", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Panel */

export function Panel({
  title,
  icon: Icon,
  meta,
  actions,
  footer,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cx(
        "flex flex-col min-h-0 min-w-0 rounded-lg border border-line bg-surface overflow-hidden",
        "shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center gap-2 h-9 pl-3 pr-1.5 border-b border-line bg-surface-2/70 shrink-0">
          {Icon && <Icon size={14} className="text-fg-faint" aria-hidden />}
          {title && <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-[0.04em]">{title}</h2>}
          {meta && <span className="text-sm text-fg-faint tabular-nums truncate">{meta}</span>}
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">{actions}</div>
        </header>
      )}
      <div className={cx("flex-1 min-h-0", bodyClassName)}>{children}</div>
      {footer && <footer className="shrink-0 border-t border-line">{footer}</footer>}
    </section>
  );
}

/* -------------------------------------------------------------- StatusLine */

export type Status =
  | { kind: "idle"; text: string }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

export function StatusLine({ status, end }: { status: Status; end?: ReactNode }) {
  const Icon = status.kind === "error" ? AlertCircle : status.kind === "ok" ? CheckCircle2 : Info;
  return (
    <div
      role={status.kind === "error" ? "alert" : "status"}
      className={cx(
        "flex items-center gap-2 h-8 px-3 text-sm",
        status.kind === "error" ? "bg-danger-soft text-danger" : "text-fg-faint",
      )}
    >
      <Icon size={13} className={cx("shrink-0", status.kind === "ok" && "text-success")} aria-hidden />
      <span className="truncate selectable" title={status.text}>
        {status.text}
      </span>
      <div className="flex-1" />
      {end && <span className="tabular-nums shrink-0">{end}</span>}
    </div>
  );
}

/** "12 lines · 340 chars" */
export function textStats(s: string): string {
  if (!s) return "";
  const lines = s.split("\n").length;
  return `${lines.toLocaleString()} ${lines === 1 ? "line" : "lines"} · ${s.length.toLocaleString()} chars`;
}

/* -------------------------------------------------------------- EditorPane */

/** An editor in a panel. Input panes get Paste + Clear, output panes get Copy. */
export function EditorPane({
  title,
  value,
  onChange,
  readOnly,
  lang,
  placeholder,
  wrap,
  status,
  actions,
  autoFocus,
  className,
  lineNumbers,
}: {
  title: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  lang?: Lang;
  placeholder?: string;
  wrap?: boolean;
  status?: Status;
  actions?: ReactNode;
  autoFocus?: boolean;
  className?: string;
  lineNumbers?: boolean;
}) {
  const editable = !readOnly && !!onChange;
  return (
    <Panel
      title={title}
      meta={textStats(value)}
      className={className}
      actions={
        <>
          {actions}
          {editable && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={ClipboardPaste}
                label="Paste"
                onClick={async () => onChange!(await navigator.clipboard.readText())}
              />
              <Button variant="ghost" size="sm" icon={Eraser} label="Clear" disabled={!value} onClick={() => onChange!("")} />
            </>
          )}
          {readOnly && <CopyButton text={value} />}
        </>
      }
      footer={status && <StatusLine status={status} />}
    >
      <CodeEditor
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        lang={lang}
        placeholder={placeholder}
        wrap={wrap}
        ariaLabel={title}
        autoFocus={autoFocus}
        lineNumbers={lineNumbers}
      />
    </Panel>
  );
}

/* --------------------------------------------------------- KeyValue list */

export function KeyValueList({
  rows,
  mono = false,
  copy = false,
  labelWidth = "8rem",
}: {
  rows: { label: string; value: ReactNode; copyText?: string; mono?: boolean }[];
  mono?: boolean;
  copy?: boolean;
  labelWidth?: string;
}) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="group flex items-center gap-3 min-h-10 px-3 py-1.5">
          <dt className="shrink-0 text-sm text-fg-muted" style={{ width: labelWidth }}>
            {r.label}
          </dt>
          <dd className={cx("flex-1 min-w-0 break-all selectable text-fg", (r.mono ?? mono) && "font-mono text-[12.5px]")}>
            {r.value}
          </dd>
          {copy && (
            <span className="opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <CopyButton text={r.copyText ?? (typeof r.value === "string" ? r.value : "")} />
            </span>
          )}
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------- Empty + Notice */

export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("h-full grid place-items-center p-8 text-center", className)}>
      <div className="flex flex-col items-center gap-2 max-w-sm">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-surface-3/70 text-fg-faint mb-1">
          <Icon size={22} aria-hidden />
        </span>
        <p className="text-md font-semibold text-fg">{title}</p>
        {children && <div className="text-base text-fg-muted">{children}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = "danger", children }: { tone?: "danger" | "info"; children: ReactNode }) {
  const Icon = tone === "danger" ? AlertCircle : Info;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-base border shrink-0 dk-fade-in",
        tone === "danger"
          ? "bg-danger-soft text-danger border-danger/25"
          : "bg-info-soft text-info border-info/25",
      )}
    >
      <Icon size={16} className="shrink-0 mt-[1px]" aria-hidden />
      <div className="min-w-0 selectable">{children}</div>
    </div>
  );
}
