import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button, Spinner, TextInput } from "./primitives";

/** Query field + primary button for the online tools. Enter runs the lookup. */
export function LookupBar({
  value,
  onChange,
  onSubmit,
  loading,
  placeholder,
  icon,
  action = "Look up",
  canSubmit = true,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  placeholder: string;
  icon: LucideIcon;
  action?: string;
  canSubmit?: boolean;
  ariaLabel: string;
  children?: ReactNode;
}) {
  return (
    <form
      className="flex items-center gap-2 flex-wrap shrink-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && canSubmit) onSubmit();
      }}
    >
      <TextInput
        autoFocus
        icon={icon}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="flex-1 min-w-[16rem]"
        mono
      />
      {children}
      <Button type="submit" variant="primary" disabled={loading || !canSubmit} kbd={loading ? undefined : "↵"}>
        {loading && <Spinner />}
        {loading ? "Looking up…" : action}
      </Button>
    </form>
  );
}
