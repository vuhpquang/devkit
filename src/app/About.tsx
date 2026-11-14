import { useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import pkg from "../../package.json";

/**
 * Author identity shared by all of the owner's apps. Copied verbatim from app-shell's `Author`
 * (github.com/vuhpquang/app-shell, Sources/AppShellCore/Author.swift) — hub rule
 * `.claude/rules/app-shell.md`. Keep them in sync by hand.
 */
export const AUTHOR = {
  name: "Ha Phung Quang Vu",
  website: "https://vuhpquang.com",
  github: "https://github.com/vuhpquang",
  linkedIn: "https://www.linkedin.com/in/vuhpquang/",
} as const;

const REPO = "https://github.com/vuhpquang/devkit";
const LINKS: [string, string][] = [
  ["vuhpquang.com", AUTHOR.website],
  ["GitHub", AUTHOR.github],
  ["LinkedIn", AUTHOR.linkedIn],
  ["Source code", REPO],
];
const FIRST_YEAR = 2026;

/** "© 2026 Ha Phung Quang Vu", or "© 2025–2026 …" when the first year is older. */
export function copyright(firstYear: number, year = new Date().getFullYear()): string {
  return `© ${firstYear < year ? `${firstYear}–${year}` : year} ${AUTHOR.name}`;
}

/** Opens in the default browser (Tauri); a plain new tab when running in a browser. */
async function open(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function LinkButton({ href, children }: { href: string; children: string }) {
  return (
    <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => open(href)}>
      {children}
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function About({ open: isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-32 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-label="About DevKit"
        className="w-[28rem] max-w-[90vw] rounded-lg bg-white dark:bg-zinc-900 shadow-xl p-6 text-center text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold">DevKit</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Offline-first developer utilities.</p>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-mono text-xs select-text">Version {pkg.version}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            className="px-3 py-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => open(`${REPO}/issues/new`)}
          >
            Report an issue
          </button>
        </div>
        <hr className="my-4 border-zinc-200 dark:border-zinc-800" />
        <p>
          <span className="text-zinc-500 dark:text-zinc-400">Made by </span>
          <span className="font-semibold">{AUTHOR.name}</span>
        </p>
        <p className="mt-1 flex justify-center gap-x-2 flex-wrap">
          {LINKS.map(([label, href], i) => (
            // The dot travels with the link after it, so a wrapped row never ends on a dot.
            <span key={label} className="whitespace-nowrap">
              {i > 0 && <span className="text-zinc-400 mr-2">·</span>}
              <LinkButton href={href}>{label}</LinkButton>
            </span>
          ))}
        </p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{copyright(FIRST_YEAR)}</p>
        <button
          autoFocus
          className="mt-4 px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
