import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, EmptyState, Spinner } from "../lib/ui";
import { openExternal } from "../lib/openExternal";
import { APP, Sheet } from "./About";
import { fetchRelease, noteBlocks, REPO, type NoteBlock } from "./updates";

/** Release notes rendered like app-shell's ReleaseNotesView: headings, bullets, paragraphs. */
export function ReleaseNotes({ blocks }: { blocks: NoteBlock[] }) {
  return (
    <div className="flex flex-col gap-2 text-base text-fg selectable">
      {blocks.map((b, i) =>
        b.kind === "heading" ? (
          <h3 key={i} className="text-md font-semibold mt-2 first:mt-0">
            {b.text}
          </h3>
        ) : b.kind === "bullet" ? (
          <p key={i} className="flex gap-2">
            <span className="text-fg-faint">•</span>
            <span>{b.text}</span>
          </p>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}

type Load = { kind: "loading" } | { kind: "ok"; blocks: NoteBlock[] } | { kind: "error"; message: string };

/** What's New in DevKit X: the GitHub release notes of the running version. */
export function WhatsNew({ open, onClose, version = APP.version }: { open: boolean; onClose: () => void; version?: string }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoad({ kind: "loading" });
    fetchRelease(version)
      .then((r) => live && setLoad({ kind: "ok", blocks: noteBlocks(r.notes) }))
      .catch((e: Error) => live && setLoad({ kind: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, [open, version]);

  if (!open) return null;
  return (
    <Sheet label={`What's New in ${APP.name}`} onClose={onClose} className="w-[520px] flex flex-col">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-line">
        <img src="/app-icon.png" alt="" width={40} height={40} />
        <div>
          <h2 className="text-lg font-semibold text-fg">What's New in {APP.name}</h2>
          <p className="text-sm text-fg-muted">Version {version}</p>
        </div>
      </div>
      <div className="px-6 py-5 max-h-[55vh] min-h-40 overflow-y-auto">
        {load.kind === "loading" && (
          <div className="h-32 grid place-items-center text-fg-muted">
            <Spinner size={18} />
          </div>
        )}
        {load.kind === "ok" &&
          (load.blocks.length ? (
            <ReleaseNotes blocks={load.blocks} />
          ) : (
            <EmptyState icon={Sparkles} title="No notes for this version" />
          ))}
        {load.kind === "error" && (
          <EmptyState icon={Sparkles} title="Couldn't load the notes">
            {load.message}
          </EmptyState>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-line">
        <Button size="sm" variant="ghost" onClick={() => openExternal(`https://github.com/${REPO}/releases`)}>
          All releases
        </Button>
        <Button variant="primary" onClick={onClose} autoFocus>
          Continue
        </Button>
      </div>
    </Sheet>
  );
}
