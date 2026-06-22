import { useState } from "react";

const btn =
  "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 " +
  "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={btn}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function PasteButton({ onPaste }: { onPaste: (t: string) => void }) {
  return (
    <button
      type="button"
      className={btn}
      onClick={async () => onPaste(await navigator.clipboard.readText())}
    >
      Paste
    </button>
  );
}

export function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={btn} onClick={onClick}>
      Clear
    </button>
  );
}
