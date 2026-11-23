import { Fragment } from "react";
import { Kbd } from "../lib/ui";
import { Sheet } from "./About";
import { SHORTCUT_GROUPS } from "./shortcuts";

/** ⌘/ — every shortcut, grouped. */
export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Sheet label="Keyboard shortcuts" onClose={onClose} className="w-[640px]">
      <h2 className="px-6 pt-5 pb-4 text-lg font-semibold text-fg border-b border-line">Keyboard shortcuts</h2>
      <div className="px-6 py-5 grid grid-cols-1 min-[640px]:grid-cols-2 gap-x-8 gap-y-6 max-h-[65vh] overflow-y-auto">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className="text-xs font-semibold text-fg-faint mb-2">{g.title}</h3>
            <dl className="flex flex-col gap-2">
              {g.items.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <dt className="flex-1 min-w-0 text-base text-fg">{item.label}</dt>
                  <dd className="flex items-center gap-1 shrink-0">
                    {item.keys.map((combo, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span className="text-sm text-fg-faint px-0.5">{item.range ? "–" : "/"}</span>}
                        <span className="flex gap-0.5">
                          {combo.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
