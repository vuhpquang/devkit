import { tools, CATEGORY_ORDER } from "../tools/registry";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
}

export function Sidebar({ activeId, onSelect, query, onQuery }: Props) {
  const q = query.trim().toLowerCase();
  const match = (t: (typeof tools)[number]) =>
    !q ||
    t.name.toLowerCase().includes(q) ||
    t.keywords.some((k) => k.toLowerCase().includes(q));

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      <div className="p-3">
        <input
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
          placeholder="Search tools…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <nav className="flex-1 overflow-auto px-2 pb-3">
        {CATEGORY_ORDER.map((cat) => {
          const items = tools.filter((t) => t.category === cat && match(t));
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="px-2 py-1 text-xs font-semibold uppercase text-zinc-400">
                {cat}
              </div>
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={
                    "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center " +
                    (t.id === activeId
                      ? "bg-blue-100 dark:bg-blue-900/40"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800")
                  }
                >
                  {t.name}
                  {t.online && (
                    <span className="text-[10px] px-1 py-0 rounded bg-sky-500/15 text-sky-400 font-medium ml-1 leading-tight">
                      online
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
