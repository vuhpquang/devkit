import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, Network, RefreshCw, Wifi } from "lucide-react";
import type { ToolDef } from "../types";
import {
  Badge,
  Button,
  CopyButton,
  EmptyState,
  KeyValueList,
  Notice,
  Panel,
  Spinner,
  Toggle,
  ToolBar,
  ToolPage,
} from "../../lib/ui";
import { netInfo, NotInApp } from "../../lib/system";
import { useSettings } from "../../app/settings";
import { ipLookup, type IpInfo } from "../ip-info/logic";
import { useSaved } from "../../lib/saved";
import { summarize, visibleInterfaces, type Iface, type NetSummary, type Ssid } from "./logic";

function ssidText(s: Ssid): string {
  if (s.kind === "name") return s.value;
  if (s.kind === "hidden") return "Hidden by macOS (needs Location access)";
  return "Not on Wi-Fi";
}

function ifaceTitle(i: Iface) {
  return i.port ? `${i.port} · ${i.name}` : i.name;
}

function SummaryRow({ label, value, copy, mono = true }: { label: string; value: string; copy?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-h-10 px-4 py-1.5">
      <span className="w-28 shrink-0 text-sm text-fg-muted">{label}</span>
      <span className={(mono ? "font-mono text-[12.5px] " : "") + "flex-1 min-w-0 break-all text-fg selectable"}>{value}</span>
      {copy && value && <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} />}
    </div>
  );
}

/** "IPv6", "IPv6" → "IPv6 1", "IPv6 2" (labels are row keys and must be unique). */
function numberRepeats<T extends { label: string }>(rows: T[]): T[] {
  const total = new Map<string, number>();
  for (const r of rows) total.set(r.label, (total.get(r.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return rows.map((r) => {
    if ((total.get(r.label) ?? 0) < 2) return r;
    const n = (seen.get(r.label) ?? 0) + 1;
    seen.set(r.label, n);
    return { ...r, label: `${r.label} ${n}` };
  });
}

function IfacePanel({ iface, primary }: { iface: Iface; primary: boolean }) {
  const [showLinkLocal, setShowLinkLocal] = useSaved(`linkLocal.${iface.name}`, false);
  const v6 = iface.ipv6.filter((a) => showLinkLocal || !a.linkLocal);
  const hiddenLinkLocal = iface.ipv6.filter((a) => a.linkLocal).length;
  const rows = [
    ...iface.ipv4.map((a) => ({ label: "IPv4", value: `${a.address}/${a.cidr}`, copyText: a.address, mono: true })),
    ...v6.map((a) => ({
      label: a.linkLocal ? "IPv6 (link-local)" : a.temporary ? "IPv6 (temporary)" : "IPv6",
      value: `${a.address}/${a.prefix}`,
      copyText: a.address,
      mono: true,
    })),
    ...(iface.mac ? [{ label: "MAC", value: iface.mac, mono: true }] : []),
    ...(iface.mtu ? [{ label: "MTU", value: String(iface.mtu), mono: true }] : []),
  ];
  return (
    <Panel
      title={ifaceTitle(iface)}
      meta={primary ? "Default route" : iface.virtual ? "Virtual" : undefined}
      className="shrink-0"
      actions={
        hiddenLinkLocal > 0 ? (
          <Toggle size="sm" on={showLinkLocal} onToggle={() => setShowLinkLocal((v) => !v)} className="font-medium">
            Link-local
          </Toggle>
        ) : undefined
      }
    >
      <KeyValueList copy labelWidth="9.5rem" rows={numberRepeats(rows)} />
    </Panel>
  );
}

type Load = { kind: "loading" } | { kind: "ok"; data: NetSummary } | { kind: "error"; message: string; notInApp: boolean };
type Pub = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; info: IpInfo } | { kind: "error"; message: string };

function NetworkInfo() {
  const { settings } = useSettings();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [showVirtual, setShowVirtual] = useSaved("showVirtual", false);
  const [pub, setPub] = useState<Pub>({ kind: "idle" });

  const refresh = useCallback(async () => {
    setLoad((l) => (l.kind === "ok" ? l : { kind: "loading" }));
    try {
      setLoad({ kind: "ok", data: summarize(await netInfo()) });
    } catch (e) {
      setLoad({ kind: "error", message: (e as Error).message, notInApp: e instanceof NotInApp });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lookupPublic = async () => {
    setPub({ kind: "loading" });
    try {
      setPub({ kind: "ok", info: await ipLookup("") });
    } catch (e) {
      setPub({ kind: "error", message: (e as Error).message });
    }
  };

  const data = load.kind === "ok" ? load.data : null;
  const ifaces = useMemo(() => (data ? visibleInterfaces(data.interfaces, showVirtual) : []), [data, showVirtual]);

  if (load.kind === "error" && load.notInApp) {
    return (
      <ToolPage>
        <EmptyState icon={Network} title="Open DevKit to see this Mac's network">
          {load.message}
        </EmptyState>
      </ToolPage>
    );
  }

  const primaryIp = data?.primary?.ipv4[0]?.address ?? "";

  return (
    <ToolPage scroll>
      <ToolBar
        end={
          <Button size="sm" icon={RefreshCw} onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      >
        <Toggle size="sm" on={showVirtual} onToggle={() => setShowVirtual((v) => !v)} className="font-medium">
          Show virtual interfaces
        </Toggle>
      </ToolBar>

      {load.kind === "error" && <Notice>{load.message}</Notice>}
      {load.kind === "loading" && (
        <div className="py-10 grid place-items-center text-fg-muted">
          <Spinner size={18} />
        </div>
      )}

      {data && (
        <>
          <Panel title="This Mac" icon={Network} className="shrink-0">
            <div className="divide-y divide-line">
              <SummaryRow label="Hostname" value={data.hostname} copy />
              <SummaryRow
                label="Interface"
                value={data.primary ? ifaceTitle(data.primary) : "No active connection"}
                mono={false}
              />
              <SummaryRow label="Local IP" value={primaryIp || "—"} copy={!!primaryIp} />
              <SummaryRow label="Gateway" value={data.gateway ?? "—"} copy={!!data.gateway} />
              <SummaryRow label="DNS" value={data.dns.join(", ") || "—"} copy={data.dns.length > 0} />
              <div className="flex items-center gap-3 min-h-10 px-4 py-1.5">
                <span className="w-28 shrink-0 text-sm text-fg-muted">Wi-Fi</span>
                <span className="flex-1 min-w-0 flex items-center gap-2 text-fg">
                  <Wifi size={14} className="text-fg-faint shrink-0" aria-hidden />
                  <span className={data.ssid.kind === "name" ? "selectable" : "text-fg-muted"}>{ssidText(data.ssid)}</span>
                </span>
                {data.ssid.kind === "name" && <CopyButton text={data.ssid.value} label="Copy network name" />}
              </div>
              <div className="flex items-center gap-3 min-h-11 px-4 py-1.5">
                <span className="w-28 shrink-0 text-sm text-fg-muted">Public IP</span>
                <span className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  {pub.kind === "ok" ? (
                    <>
                      <span className="font-mono text-[12.5px] text-fg selectable">{pub.info.ip}</span>
                      <span className="text-sm text-fg-muted">
                        {[pub.info.city, pub.info.country].filter(Boolean).join(", ")} · {pub.info.isp}
                      </span>
                    </>
                  ) : pub.kind === "error" ? (
                    <span className="text-sm text-danger">{pub.message}</span>
                  ) : !settings.showOnlineTools ? (
                    <span className="text-sm text-fg-faint">Online tools are off in Settings</span>
                  ) : (
                    <Button size="sm" icon={Globe} onClick={() => void lookupPublic()} disabled={pub.kind === "loading"}>
                      {pub.kind === "loading" ? "Looking up…" : "Show public IP"}
                    </Button>
                  )}
                </span>
                {pub.kind === "ok" && <CopyButton text={pub.info.ip} label="Copy public IP" />}
                {pub.kind === "ok" && <Badge tone="info">Online</Badge>}
              </div>
            </div>
          </Panel>

          {ifaces.length === 0 ? (
            <EmptyState icon={Network} title="No active interfaces" className="py-8" />
          ) : (
            ifaces.map((i) => <IfacePanel key={i.name} iface={i} primary={i.name === data.primary?.name} />)
          )}
        </>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "network-info",
  name: "Network Info",
  category: "System",
  description: "Local and public IP, gateway, DNS and every interface of this Mac",
  icon: Network,
  keywords: ["network", "ip", "ifconfig", "interface", "gateway", "dns", "mac address", "wifi", "ssid", "local ip"],
  component: NetworkInfo,
};
