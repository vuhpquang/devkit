import { useMemo, useState } from "react";
import { tools } from "../tools/registry";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function CommandPalette({ open, onClose, onSelect }: Props) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tools.filter(
      (t) =>
        !s ||
        t.name.toLowerCase().includes(s) ||
        t.keywords.some((k) => k.toLowerCase().includes(s))
    );
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-32 z-50"
      onClick={onClose}
    >
      <div
        className="w-[32rem] max-w-[90vw] rounded-lg bg-white dark:bg-zinc-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="w-full px-4 py-3 text-sm bg-transparent outline-none border-b border-zinc-200 dark:border-zinc-800"
          placeholder="Jump to a tool…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && matches[0]) {
              onSelect(matches[0].id);
              onClose();
            }
          }}
        />
        <ul className="max-h-72 overflow-auto">
          {matches.map((t) => (
            <li key={t.id}>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  onSelect(t.id);
                  onClose();
                }}
              >
                <span className="text-zinc-400 text-xs mr-2">{t.category}</span>
                {t.name}
                {t.online && (
                  <span className="text-[10px] px-1 py-0 rounded bg-sky-500/15 text-sky-400 font-medium ml-1 leading-tight">
                    online
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
