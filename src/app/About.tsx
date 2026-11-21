import { useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Bug } from "lucide-react";
import pkg from "../../package.json";
import { Button } from "../lib/ui";

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
    <button
      className="text-accent-text font-medium hover:underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent-ring rounded-xs"
      onClick={() => open(href)}
    >
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
    <div className="fixed inset-0 z-50 bg-scrim dk-fade-in flex items-center justify-center px-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="About DevKit"
        className="w-[27rem] max-w-full rounded-xl bg-surface border border-line shadow-pop px-8 pt-8 pb-6 text-center dk-pop-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <img src="/app-icon.png" alt="" width={72} height={72} className="mx-auto mb-3 drop-shadow-md" />
        <h2 className="text-xl font-bold text-fg">DevKit</h2>
        <p className="text-base text-fg-muted mt-1">Offline-first developer utilities.</p>
        <p className="text-sm text-fg-faint mt-2 tabular-nums select-text">Version {pkg.version}</p>
        <p className="text-sm text-fg-faint mt-0.5">Updates through App Depot</p>
        <div className="mt-4 flex justify-center">
          <Button size="sm" icon={Bug} onClick={() => open(`${REPO}/issues/new`)}>
            Report an issue
          </Button>
        </div>
        <hr className="my-5 border-line" />
        <img src="/author-logo.png" alt="" width={32} height={32} className="mx-auto mb-2 rounded-full" />
        <p className="text-base">
          <span className="text-fg-muted">Made by </span>
          <span className="font-semibold text-fg">{AUTHOR.name}</span>
        </p>
        <p className="mt-1.5 flex justify-center gap-x-2 flex-wrap text-base">
          {LINKS.map(([label, href], i) => (
            // The dot travels with the link after it, so a wrapped row never ends on a dot.
            <span key={label} className="whitespace-nowrap">
              {i > 0 && <span className="text-fg-faint mr-2">·</span>}
              <LinkButton href={href}>{label}</LinkButton>
            </span>
          ))}
        </p>
        <p className="mt-3 text-sm text-fg-faint">{copyright(FIRST_YEAR)}</p>
        <Button autoFocus variant="primary" className="mt-5 w-full justify-center" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
