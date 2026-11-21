import { useState, type ReactNode } from "react";
import { FileLock, ShieldCheck } from "lucide-react";
import type { ToolDef } from "../types";
import { Field, KeyValueList, Panel, TextInput, Toggle, ToolPage } from "../../lib/ui";
import { WHO, chmodCommand, parseMode, toOctal, toSymbolic, type Perms, type Triplet, type Who } from "./logic";

const LABEL: Record<Who, string> = { owner: "Owner", group: "Group", others: "Others" };
const BITS: { key: keyof Triplet; label: string; value: number }[] = [
  { key: "r", label: "Read", value: 4 },
  { key: "w", label: "Write", value: 2 },
  { key: "x", label: "Execute", value: 1 },
];
const SPECIAL: { key: "setuid" | "setgid" | "sticky"; label: string; hint: string }[] = [
  { key: "setuid", label: "Set user ID", hint: "Runs as the file's owner" },
  { key: "setgid", label: "Set group ID", hint: "Runs as the group; new files in a directory inherit it" },
  { key: "sticky", label: "Sticky", hint: "In a directory, only owners can delete their files" },
];

/** Pressed-state toggle used for every permission bit. */
function Bit({ on, onToggle, label, children }: { on: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return (
    <Toggle on={on} onToggle={onToggle} label={label} className="h-9 w-full text-base font-medium">
      {children}
    </Toggle>
  );
}

/** 755: rwxr-xr-x. */
const DEFAULT: Perms = {
  owner: { r: true, w: true, x: true },
  group: { r: true, w: false, x: true },
  others: { r: true, w: false, x: true },
  setuid: false,
  setgid: false,
  sticky: false,
};

function ChmodCalculator() {
  const [perms, setPerms] = useState<Perms>(DEFAULT);
  const [text, setText] = useState("755");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState("file");

  const update = (p: Perms) => {
    setPerms(p);
    setText(toOctal(p));
    setError(null);
  };

  const onText = (v: string) => {
    setText(v);
    if (!v.trim()) return setError(null);
    const r = parseMode(v);
    if (r.ok) {
      setPerms(r.perms);
      setError(null);
    } else setError(r.error);
  };

  const octal = toOctal(perms);
  const symbolic = toSymbolic(perms);

  return (
    <ToolPage scroll>
      <div className="grid gap-4 max-w-3xl shrink-0 min-[700px]:grid-cols-2">
        <Field label="Mode" hint={error ? <span className="text-danger">{error}</span> : "Octal (755, 4755) or symbolic (rwxr-xr-x)"}>
          <TextInput autoFocus mono aria-label="Mode" value={text} onChange={(e) => onText(e.target.value)} className="text-md" />
        </Field>
        <Field label="File name" hint="Used in the command below">
          <TextInput mono aria-label="File name" value={file} onChange={(e) => setFile(e.target.value)} />
        </Field>
      </div>

      <Panel title="Permissions" icon={ShieldCheck} className="shrink-0 max-w-3xl">
        <div className="p-3 grid gap-2 grid-cols-[6rem_repeat(3,minmax(0,1fr))_3rem] items-center">
          <span />
          {BITS.map((b) => (
            <span key={b.key} className="text-sm text-fg-faint text-center">
              {b.label} <span className="tabular-nums">({b.value})</span>
            </span>
          ))}
          <span className="text-sm text-fg-faint text-center">Octal</span>
          {WHO.map((w) => (
            <Row key={w} who={w} perms={perms} onChange={update} />
          ))}
        </div>
        <div className="border-t border-line p-3 grid gap-2 grid-cols-1 min-[640px]:grid-cols-3">
          {SPECIAL.map((s) => (
            <div key={s.key} title={s.hint}>
              <Bit label={s.label} on={perms[s.key]} onToggle={() => update({ ...perms, [s.key]: !perms[s.key] })}>
                {s.label}
              </Bit>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Result" icon={FileLock} className="shrink-0 max-w-3xl">
        <KeyValueList
          copy
          mono
          labelWidth="6rem"
          rows={[
            { label: "Octal", value: octal },
            { label: "Symbolic", value: symbolic },
            { label: "ls -l", value: `-${symbolic}` },
            { label: "Command", value: chmodCommand(perms, file) },
          ]}
        />
      </Panel>
    </ToolPage>
  );
}

function Row({ who, perms, onChange }: { who: Who; perms: Perms; onChange: (p: Perms) => void }) {
  const t = perms[who];
  const digit = (t.r ? 4 : 0) + (t.w ? 2 : 0) + (t.x ? 1 : 0);
  return (
    <>
      <span className="text-base font-medium text-fg-muted">{LABEL[who]}</span>
      {BITS.map((b) => (
        <Bit
          key={b.key}
          label={`${LABEL[who]} ${b.label.toLowerCase()}`}
          on={t[b.key]}
          onToggle={() => onChange({ ...perms, [who]: { ...t, [b.key]: !t[b.key] } })}
        >
          {b.key}
        </Bit>
      ))}
      <span className="text-center font-mono text-md text-fg tabular-nums">{digit}</span>
    </>
  );
}

export const tool: ToolDef = {
  id: "chmod-calculator",
  name: "Chmod Calculator",
  category: "Converters",
  description: "Unix file permissions between octal, symbolic and checkboxes",
  icon: FileLock,
  keywords: ["chmod", "permissions", "unix", "octal", "rwx", "file mode", "setuid", "sticky"],
  component: ChmodCalculator,
};
