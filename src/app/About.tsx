import { useEffect, type ReactNode } from "react";
import { AlertTriangle, ArrowDownCircle, CheckCircle2, X } from "lucide-react";
import pkg from "../../package.json";
import { Button, Spinner, cx } from "../lib/ui";
import { openExternal } from "../lib/openExternal";
import { REPO } from "./updates";
import { useUpdater, type UpdateState } from "./updater";

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

/** DevKit's AppIdentity (app-shell's `AppIdentity`, by hand). */
export const APP = {
  name: "DevKit",
  tagline: "Offline-first developer utilities.",
  version: pkg.version,
  build: __APP_BUILD__,
  repoURL: `https://github.com/${REPO}`,
  newIssueURL: `https://github.com/${REPO}/issues/new`,
  firstYear: 2026,
} as const;

/** "© 2026 Ha Phung Quang Vu", or "© 2025–2026 …" when the first year is older. */
export function copyright(firstYear: number, year = new Date().getFullYear()): string {
  return `© ${firstYear < year ? `${firstYear}–${year}` : year} ${AUTHOR.name}`;
}

function Link({ href, children, strong }: { href: string; children: string; strong?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        "text-accent-text hover:underline underline-offset-2 rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
        strong && "font-semibold",
      )}
      onClick={() => openExternal(href)}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------- Update status */

/** One line of update status, worded like app-shell's UpdateStatusLabel. */
export function UpdateStatusLabel({ state }: { state: UpdateState }) {
  const line = (icon: ReactNode, text: string, tone = "text-fg") => (
    <span className={cx("inline-flex items-center gap-1.5 min-w-0", tone)}>
      {icon}
      <span className="truncate">{text}</span>
    </span>
  );
  switch (state.kind) {
    case "idle":
      return line(null, "Not checked yet", "text-fg-muted");
    case "checking":
      return line(null, "Checking for updates…", "text-fg-muted");
    case "upToDate":
      return line(<CheckCircle2 size={15} className="text-success shrink-0" aria-hidden />, `${APP.name} is up to date`);
    case "available":
      return line(<ArrowDownCircle size={15} className="text-accent-text shrink-0" aria-hidden />, `Version ${state.release.version} is available`);
    case "failed":
      return line(<AlertTriangle size={15} className="text-accent-text shrink-0" aria-hidden />, state.message);
  }
}

/**
 * Check for Updates, or — when there is one — the release page. App Depot installs DevKit updates,
 * so DevKit itself never downloads anything.
 */
export function UpdateActionButton({ state, onCheck }: { state: UpdateState; onCheck: () => void }) {
  if (state.kind === "checking") return <Spinner />;
  if (state.kind === "available") {
    return (
      <Button size="sm" variant="primary" onClick={() => openExternal(state.release.url)}>
        View Update
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={onCheck}>
      Check for Updates
    </Button>
  );
}

/* ---------------------------------------------------------------- About */

/**
 * The About content every one of the owner's apps shows (app-shell `AboutView`):
 * icon, name, tagline, Version X (build), update status + button, What's New / Report Issue,
 * divider, author footer.
 */
export function AboutContent({ onWhatsNew }: { onWhatsNew: () => void }) {
  const { state, check } = useUpdater();
  return (
    <div className="w-[420px] max-w-full mx-auto flex flex-col items-center text-center">
      <img src="/app-icon.png" alt="DevKit icon" width={112} height={112} className="drop-shadow-md" />
      <div className="mt-4 flex flex-col items-center gap-1">
        <h2 className="text-2xl font-bold text-fg">{APP.name}</h2>
        <p className="text-base text-fg-muted">{APP.tagline}</p>
        <p className="text-base text-fg-muted tabular-nums mt-1 selectable">
          Version {APP.version} ({APP.build})
        </p>
      </div>
      <div className="mt-5 flex items-center gap-3 text-base max-w-full">
        <UpdateStatusLabel state={state} />
        <UpdateActionButton state={state} onCheck={() => void check(true)} />
      </div>
      <div className="mt-5 flex items-center gap-2">
        <Button size="sm" onClick={onWhatsNew}>
          What's New
        </Button>
        <Button size="sm" onClick={() => openExternal(APP.newIssueURL)}>
          Report Issue
        </Button>
      </div>
      <hr className="w-full my-5 border-line" />
      <AuthorFooter />
    </div>
  );
}

/** "Made by …", the author's links and the copyright — app-shell's AuthorFooter. */
export function AuthorFooter() {
  return (
    <div className="flex flex-col items-center gap-1 text-base">
      <button
        type="button"
        aria-label={AUTHOR.name}
        onClick={() => openExternal(AUTHOR.website)}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <img src="/author-logo.png" alt="" width={32} height={32} className="rounded-full" />
      </button>
      <p className="whitespace-nowrap">
        <span className="text-fg-muted">Made by </span>
        <Link href={AUTHOR.website} strong>
          {AUTHOR.name}
        </Link>
      </p>
      <p className="flex items-center gap-2 whitespace-nowrap">
        <Link href={AUTHOR.website}>vuhpquang.com</Link>
        <span className="text-fg-faint">·</span>
        <Link href={AUTHOR.github}>GitHub</Link>
        <span className="text-fg-faint">·</span>
        <Link href={AUTHOR.linkedIn}>LinkedIn</Link>
        <span className="text-fg-faint">·</span>
        <Link href={APP.repoURL}>Source code</Link>
      </p>
      <p className="text-fg-muted mt-1">{copyright(APP.firstYear)}</p>
    </div>
  );
}

/* --------------------------------------------------------------- Dialog */

/** A centred sheet over the window; Esc or a click outside closes it. */
export function Sheet({
  label,
  onClose,
  children,
  className,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-scrim dk-fade-in flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={label}
        className={cx("relative max-w-full max-h-full rounded-xl bg-surface border border-line shadow-pop dk-pop-in", className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="sm" icon={X} label="Close" className="absolute top-2.5 right-2.5 z-10" onClick={onClose} />
        {children}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onWhatsNew?: () => void;
}

export function About({ open, onClose, onWhatsNew = () => {} }: Props) {
  if (!open) return null;
  return (
    <Sheet label="About DevKit" onClose={onClose} className="px-8 pt-9 pb-7">
      <AboutContent onWhatsNew={onWhatsNew} />
    </Sheet>
  );
}
