import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Gauge, Plus, RefreshCw, ServerCog, Trash2, Zap } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, CopyButton, EmptyState, Field, Notice, Panel, Select, Spinner, TextInput, ToolBar, ToolPage, cx } from "../../lib/ui";
import { dnsBenchmark, dnsFlush, dnsSet, dnsStatus, isCancelled, type DnsStatus } from "../../lib/system";
import { useSettings } from "../../app/settings";
import { activeResolvers, BUILT_IN, loadCustom, matchPreset, newCustom, saveCustom, type DnsPreset } from "./logic";

const ALL = "__all__";

function DnsSwitcher() {
  const { settings } = useSettings();
  const [status, setStatus] = useState<DnsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState(ALL);
  const [custom, setCustom] = useState<DnsPreset[]>(loadCustom);
  const [timing, setTiming] = useState<Record<string, number | "fail" | "…">>({});
  const [name, setName] = useState("");
  const [servers, setServers] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const presets = useMemo(() => [...BUILT_IN, ...custom], [custom]);

  const refresh = useCallback(async () => {
    try {
      setStatus(await dnsStatus());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  if (error && !status) {
    return (
      <ToolPage>
        <EmptyState icon={ServerCog} title={error.includes("DevKit app") ? "Open DevKit to change DNS" : "Couldn't read the DNS settings"}>
          {error}
        </EmptyState>
      </ToolPage>
    );
  }
  if (!status) {
    return (
      <ToolPage>
        <div className="flex-1 grid place-items-center text-fg-muted">
          <Spinner size={18} />
        </div>
      </ToolPage>
    );
  }

  const enabled = status.services.filter((s) => s.enabled);
  const inUse = activeResolvers(status.resolvers);
  const targetServices = target === ALL ? enabled : status.services.filter((s) => s.name === target);
  const current = targetServices[0]?.servers ?? [];
  const uniform = targetServices.every((s) => s.servers.join() === current.join());
  // "Every active connection": judge by the servers the Mac actually asks (an unplugged Ethernet port left on
  // Automatic shouldn't hide that Wi-Fi uses Google). A single connection: by its own setting.
  const active =
    target === ALL
      ? (matchPreset(inUse, presets.filter((p) => p.servers.length)) ?? (uniform ? matchPreset(current, presets) : undefined))
      : matchPreset(current, presets);

  const apply = async (p: DnsPreset) => {
    setBusy(p.id);
    setNotice(null);
    setError(null);
    try {
      await dnsSet(target === ALL ? null : target, p.servers);
      await refresh();
      setNotice(`DNS set to ${p.name} on ${target === ALL ? "every active connection" : target}.`);
    } catch (e) {
      if (!isCancelled(e)) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const flush = async () => {
    setBusy("flush");
    setNotice(null);
    try {
      await dnsFlush();
      setNotice("DNS cache cleared.");
    } catch (e) {
      if (!isCancelled(e)) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const benchmark = async () => {
    const list = presets.filter((p) => p.servers.length);
    setTiming(Object.fromEntries(list.map((p) => [p.id, "…" as const])));
    for (const p of list) {
      try {
        const ms = await dnsBenchmark(p.servers[0]);
        setTiming((t) => ({ ...t, [p.id]: ms }));
      } catch {
        setTiming((t) => ({ ...t, [p.id]: "fail" }));
      }
    }
  };

  const fastest = Object.entries(timing)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0];

  const addCustom = () => {
    const r = newCustom(name, servers, custom);
    if (!r.ok) return setFormError(r.error);
    const next = [...custom, r.preset];
    setCustom(next);
    saveCustom(next);
    setName("");
    setServers("");
    setFormError(null);
  };
  const removeCustom = (id: string) => {
    const next = custom.filter((p) => p.id !== id);
    setCustom(next);
    saveCustom(next);
  };

  return (
    <ToolPage scroll>
      <ToolBar
        end={
          <>
            <Button size="sm" variant="ghost" icon={Gauge} disabled={!settings.showOnlineTools} onClick={benchmark} label={settings.showOnlineTools ? undefined : "Online tools are off in Settings"}>
              Test speed
            </Button>
            <Button size="sm" variant="ghost" icon={Zap} onClick={flush} disabled={busy !== null}>
              {busy === "flush" ? "Clearing…" : "Clear DNS cache"}
            </Button>
            <Button size="sm" variant="ghost" icon={RefreshCw} label="Refresh" onClick={() => void refresh()} />
          </>
        }
      >
        <span className="text-base text-fg-muted">Apply to</span>
        <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Apply to" className="w-56">
          <option value={ALL}>Every active connection</option>
          {status.services.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.enabled ? "" : " (off)"}
            </option>
          ))}
        </Select>
      </ToolBar>

      {notice && <Notice tone="info">{notice}</Notice>}
      {error && <Notice>{error}</Notice>}

      <Panel title="In use now" icon={ServerCog} className="shrink-0" meta={active ? active.name : "Custom servers"}>
        <div className="px-3 py-2.5 flex flex-wrap items-center gap-2">
          {inUse.length ? (
            inUse.map((ip) => (
              <span key={ip} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md bg-surface-2 border border-line font-mono text-[12.5px] text-fg selectable">
                {ip}
                <CopyButton text={ip} />
              </span>
            ))
          ) : (
            <span className="text-base text-fg-faint">No DNS server answers right now (offline?)</span>
          )}
        </div>
        <ul className="border-t border-line divide-y divide-line">
          {enabled.map((s) => (
            <li key={s.name} className="flex items-center gap-3 px-3 h-9 text-base">
              <span className="w-56 truncate text-fg-muted">{s.name}</span>
              <span className="font-mono text-[12.5px] text-fg truncate">{s.servers.length ? s.servers.join(", ") : "Automatic"}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] shrink-0">
        {presets.map((p) => {
          const on = active?.id === p.id;
          const t = timing[p.id];
          return (
            <div
              key={p.id}
              className={cx(
                "flex flex-col gap-2 p-3.5 rounded-xl border bg-surface",
                on ? "border-accent/60 shadow-[0_0_0_3px_var(--accent-soft)]" : "border-line",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-md font-semibold text-fg">{p.name}</span>
                {on && (
                  <Badge tone="accent">
                    <Check size={10} /> In use
                  </Badge>
                )}
                {p.custom && <Badge>Custom</Badge>}
                <div className="flex-1" />
                {t === "…" && <Spinner size={12} />}
                {typeof t === "number" && <Badge tone={p.id === fastest ? "success" : "neutral"}>{Math.round(t)} ms</Badge>}
                {t === "fail" && <Badge tone="danger">No answer</Badge>}
              </div>
              <p className="font-mono text-[12.5px] text-fg-muted min-h-[18px] selectable">{p.servers.length ? p.servers.join("  ") : p.note}</p>
              {p.servers.length > 0 && p.note && <p className="text-sm text-fg-faint -mt-1">{p.note}</p>}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <Button size="sm" variant={on ? "secondary" : "primary"} disabled={on || busy !== null} onClick={() => void apply(p)}>
                  {busy === p.id ? "Applying…" : on ? "In use" : "Use"}
                </Button>
                {p.custom && <Button size="sm" variant="ghost" icon={Trash2} label={`Delete ${p.name}`} onClick={() => removeCustom(p.id)} />}
              </div>
            </div>
          );
        })}
      </div>

      <Panel title="Save your own" icon={Plus} className="shrink-0 max-w-3xl">
        <form
          className="p-3.5 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            addCustom();
          }}
        >
          <Field label="Name" className="w-44">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Quad9" />
          </Field>
          <Field label="Servers" className="flex-1 min-w-[16rem]" hint={formError ? <span className="text-danger">{formError}</span> : "IPv4 or IPv6, separated by spaces or commas"}>
            <TextInput mono value={servers} onChange={(e) => setServers(e.target.value)} placeholder="9.9.9.9 149.112.112.112" />
          </Field>
          <Button type="submit" icon={Plus} className="mb-[22px]">
            Save preset
          </Button>
        </form>
      </Panel>
      <p className="text-sm text-fg-faint shrink-0">
        Changing DNS asks for your administrator password. Apps pick up the new servers right away; the DNS cache is cleared for you.
      </p>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "dns-switcher",
  name: "DNS Switcher",
  category: "System",
  description: "Switch the Mac's DNS: Google, Cloudflare, DNSPod or your own",
  icon: ServerCog,
  keywords: ["dns", "nameserver", "8.8.8.8", "1.1.1.1", "119.29.29.29", "cloudflare", "google", "dnspod", "network", "resolver"],
  component: DnsSwitcher,
};

