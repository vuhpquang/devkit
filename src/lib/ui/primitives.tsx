import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Check, ChevronDown, Copy, type LucideIcon } from "lucide-react";

/** Joins class names, skipping falsy ones. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent font-semibold hover:bg-accent-hover active:brightness-95 " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.12)]",
  secondary:
    "bg-surface text-fg border border-line-strong hover:bg-surface-2 active:bg-surface-3 " +
    "shadow-[0_1px_1px_rgb(0_0_0/0.04)]",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-3/70 active:bg-surface-3",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 gap-1.5 text-sm rounded-sm",
  md: "h-8 px-3 gap-2 text-base rounded-md",
};

const ICON_ONLY: Record<Size, string> = {
  sm: "h-7 w-7 justify-center rounded-sm",
  md: "h-8 w-8 justify-center rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  /** Icon-only button: pass `label` (used for aria-label + tooltip) and no children. */
  label?: string;
  kbd?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, label, kbd, className, children, type = "button", ...rest },
  ref,
) {
  const iconOnly = !children && !!Icon;
  return (
    <button
      ref={ref}
      type={type}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={cx(
        "inline-flex items-center shrink-0 whitespace-nowrap select-none transition-colors duration-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
        "disabled:opacity-45 disabled:pointer-events-none",
        VARIANT[variant],
        iconOnly ? ICON_ONLY[size] : SIZE[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 15} strokeWidth={2} aria-hidden />}
      {children}
      {kbd && <Kbd className="ml-1 -mr-0.5">{kbd}</Kbd>}
    </button>
  );
});

/* -------------------------------------------------------------------- Copy */

/** Copies `text`; the icon turns into a check for a moment. Disabled when there's nothing to copy. */
export function CopyButton({
  text,
  size = "sm",
  variant = "ghost",
  withLabel = false,
  label = "Copy",
}: {
  text: string;
  size?: Size;
  variant?: Variant;
  withLabel?: boolean;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <Button
      variant={variant}
      size={size}
      icon={copied ? Check : Copy}
      label={copied ? "Copied" : label}
      disabled={!text}
      onClick={copy}
      className={copied ? "!text-success" : undefined}
    >
      {withLabel ? (copied ? "Copied" : label) : undefined}
    </Button>
  );
}

/* ----------------------------------------------------------- Segmented ctl */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Tooltip / accessible name; needed for icon-only segments. */
  hint?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: Size;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "inline-flex items-center p-0.5 gap-0.5 bg-surface-3/80 border border-line rounded-md shrink-0",
        size === "sm" ? "h-7" : "h-8",
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={!o.label ? (o.hint ?? o.value) : undefined}
            title={o.hint ?? (o.label || undefined)}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-full inline-flex items-center gap-1.5 rounded-[6px] whitespace-nowrap transition-colors duration-100",
              "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
              size === "sm" ? "px-2 text-sm" : "px-3 text-base",
              on
                ? "bg-surface text-fg font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.06)]"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- Form controls */

const FIELD =
  "h-8 rounded-md border border-line-strong bg-surface text-fg px-2.5 text-base " +
  "placeholder:text-fg-faint outline-none transition-shadow duration-100 " +
  "focus:border-accent focus:ring-3 focus:ring-accent-ring/60 disabled:opacity-50";

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { mono?: boolean; icon?: LucideIcon }
>(function TextInput({ mono, icon: Icon, className, ...rest }, ref) {
  if (!Icon) {
    return (
      <input
        ref={ref}
        spellCheck={false}
        autoComplete="off"
        className={cx(FIELD, mono && "font-mono", className)}
        {...rest}
      />
    );
  }
  return (
    <div className={cx("relative", className)}>
      <Icon size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" aria-hidden />
      <input
        ref={ref}
        spellCheck={false}
        autoComplete="off"
        className={cx(FIELD, "w-full pl-8", mono && "font-mono")}
        {...rest}
      />
    </div>
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("relative inline-flex", className)}>
      <select className={cx(FIELD, "appearance-none pr-8 w-full")} {...rest}>
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" aria-hidden />
    </div>
  );
}

/** Label above a control. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-sm font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <span className="text-sm text-fg-faint">{hint}</span>}
    </label>
  );
}

/* ----------------------------------------------------------------- Display */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-xs",
        "border border-line-strong bg-surface-2 text-fg-faint font-sans text-2xs font-medium",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type Tone = "neutral" | "accent" | "info" | "success" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-muted",
  accent: "bg-accent-soft text-accent-text",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 h-[18px] px-1.5 rounded-xs text-2xs font-semibold uppercase tracking-wide shrink-0",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function OnlineBadge() {
  return <Badge tone="info">Online</Badge>;
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full border-2 border-current border-r-transparent dk-spin"
      style={{ width: size, height: size }}
    />
  );
}

/** Coloured tile holding a tool's icon. */
export function IconTile({ icon: Icon, size = 28 }: { icon: LucideIcon; size?: number }) {
  return (
    <span
      className="inline-grid place-items-center shrink-0 rounded-md bg-accent-soft text-accent-text border border-accent/20"
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2} aria-hidden />
    </span>
  );
}

/* ------------------------------------------------------------------ Switch */

/** macOS-style switch. Amber when on. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Accessible name (the visible row label usually). */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 h-[22px] w-[38px] rounded-full transition-colors duration-150",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:opacity-45",
        checked ? "bg-accent" : "bg-surface-3 border border-line-strong",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full bg-knob shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-[left] duration-150",
          checked ? "left-[18px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ Toggle */

/** A button that stays pressed (flags, record types, permission bits, character sets). Amber when on. */
export function Toggle({
  on,
  onToggle,
  children,
  label,
  title,
  size = "md",
  mono = false,
  className,
}: {
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Accessible name when the visible text isn't enough (e.g. a single letter). */
  label?: string;
  title?: string;
  size?: Size;
  mono?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={title}
      onClick={onToggle}
      className={cx(
        "inline-flex items-center justify-center rounded-md border font-semibold transition-colors duration-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
        size === "sm" ? "h-7 px-2.5 text-sm" : "h-8 px-2.5 text-sm",
        mono && "font-mono",
        on ? "bg-accent-soft border-accent/50 text-accent-text" : "bg-surface border-line-strong text-fg-faint hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}
