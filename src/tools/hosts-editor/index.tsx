import { useCallback, useEffect, useMemo, useState } from "react";
import { FileClock, ListTree, Plus, RotateCcw, Save, ScrollText, Trash2 } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EditorPane, EmptyState, Notice, Panel, Spinner, Switch, TextInput, ToolBar, ToolPage } from "../../lib/ui";
import { hostsBackup, hostsRead, hostsWrite, isCancelled } from "../../lib/system";
import { useSaved } from "../../lib/saved";
import { addEntry, invalidLines, parseHosts, removeLine, toggleEntry } from "./logic";

function HostsEditor() {
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [backup, setBackup] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Only the Add entry form is saved, never a draft of the file (it could overwrite a newer /etc/hosts).
  const [ip, setIp] = useSaved("ip", "127.0.0.1");
  const [names, setNames] = useSaved("names", "");
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await hostsRead();
      setSaved(t);
      setText(t);
      setBackup(await hostsBackup());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const entries = useMemo(() => parseHosts(text).filter((l) => l.kind === "entry"), [text]);
  const broken = useMemo(() => invalidLines(text), [text]);
  const dirty = saved !== null && text !== saved;

  if (loadError) {
    return (
      <ToolPage>
        <EmptyState icon={ScrollText} title={loadError.includes("DevKit app") ? "Open DevKit to edit /etc/hosts" : "Couldn't read /etc/hosts"}>
          {loadError}
        </EmptyState>
      </ToolPage>
    );
  }
  if (saved === null) {
    return (
      <ToolPage>
        <div className="flex-1 grid place-items-center text-fg-muted">
          <Spinner size={18} />
        </div>
      </ToolPage>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await hostsWrite(text);
      await load();
      setNotice("Saved /etc/hosts and cleared the DNS cache. The previous version is in /etc/hosts.devkit-backup.");
    } catch (e) {
      if (!isCancelled(e)) setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const r = addEntry(text, ip, names);
    if (!r.ok) return setAddError(r.error);
    setText(r.text);
    setNames("");
    setAddError(null);
  };

  return (
    <ToolPage>
      <ToolBar
        end={
          <>
            {backup !== null && (
              <Button size="sm" variant="ghost" icon={FileClock} onClick={() => setText(backup)} label="Load the copy saved before DevKit's last change (not saved until you press Save)">
                Load backup
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => setText(saved)}>
              Revert
            </Button>
            <Button variant="primary" icon={Save} disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <span className="text-base text-fg-muted">/etc/hosts</span>
        {dirty ? <Badge tone="accent">Unsaved changes</Badge> : <Badge>Saved</Badge>}
        {broken.length > 0 && <Badge tone="danger">{broken.length} unreadable {broken.length === 1 ? "line" : "lines"}</Badge>}
      </ToolBar>
      {notice && <Notice tone="info">{notice}</Notice>}
      {error && <Notice>{error}</Notice>}
      <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 min-[900px]:grid-cols-[1.3fr_1fr] auto-rows-[minmax(0,1fr)]">
        <EditorPane
          title="File"
          value={text}
          onChange={setText}
          status={
            broken.length
              ? { kind: "error", text: `Line ${broken.map((l) => l.index + 1).join(", ")}: not “IP name …” and not a # comment` }
              : { kind: "ok", text: `${entries.filter((e) => e.enabled).length} active entries` }
          }
        />
        <div className="flex flex-col gap-3 min-h-0">
          <Panel title="Entries" icon={ListTree} meta={`${entries.length}`} className="flex-1" bodyClassName="overflow-y-auto">
            {entries.length === 0 ? (
              <EmptyState icon={ListTree} title="No entries" />
            ) : (
              <ul className="divide-y divide-line">
                {entries.map((l) => (
                  <li key={l.index} className="group flex items-center gap-3 px-3 py-2">
                    <Switch label={`${l.enabled ? "Disable" : "Enable"} ${l.names[0]}`} checked={l.enabled} disabled={l.system} onChange={() => setText(toggleEntry(text, l.index))} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={l.enabled ? "font-mono text-[12.5px] text-fg truncate" : "font-mono text-[12.5px] text-fg-faint line-through truncate"}>
                          {l.names.join(" ")}
                        </span>
                        {l.system && <Badge>System</Badge>}
                      </div>
                      <span className="font-mono text-sm text-fg-faint">
                        {l.ip}
                        {l.note && ` · ${l.note}`}
                      </span>
                    </div>
                    {!l.system && (
                      <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <Button size="sm" variant="ghost" icon={Trash2} label={`Remove ${l.names[0]}`} onClick={() => setText(removeLine(text, l.index))} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Add an entry" icon={Plus} className="shrink-0">
            <form
              className="p-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <div className="flex gap-2">
                <TextInput mono aria-label="IP address" value={ip} onChange={(e) => setIp(e.target.value)} className="w-36" />
                <TextInput mono aria-label="Host names" value={names} onChange={(e) => setNames(e.target.value)} placeholder="myapp.test api.myapp.test" className="flex-1" />
                <Button type="submit" icon={Plus}>
                  Add
                </Button>
              </div>
              {addError && <p className="text-sm text-danger">{addError}</p>}
            </form>
          </Panel>
        </div>
      </div>
      <p className="text-sm text-fg-faint shrink-0">
        Saving asks for your administrator password, keeps the previous file as /etc/hosts.devkit-backup and clears the DNS cache so the change
        applies at once.
      </p>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "hosts-editor",
  name: "Hosts File",
  category: "System",
  description: "Edit /etc/hosts: switch entries on and off, add local domains",
  icon: ScrollText,
  keywords: ["hosts", "/etc/hosts", "domain", "local", "dns", "redirect", "block"],
  component: HostsEditor,
};
