interface Props {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function TextPane({ label, value, onChange, readOnly, placeholder }: Props) {
  return (
    <label className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <textarea
        className="flex-1 min-h-48 resize-none rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 font-mono text-sm"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={false}
      />
    </label>
  );
}
