import { Channel, invoke } from "@tauri-apps/api/core";
import { inApp } from "../app/menuEvents";

/**
 * Typed wrappers for the macOS system commands in src-tauri/src/sys. Outside the app (npm run dev) they
 * reject with a clear message instead of failing obscurely.
 */
export class NotInApp extends Error {
  constructor() {
    super("This tool needs the DevKit app (it talks to macOS).");
  }
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inApp()) throw new NotInApp();
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new Error(typeof e === "string" ? e : (e as Error).message ?? String(e));
  }
}

/** A cancelled administrator prompt rejects with this message. */
export const isCancelled = (e: unknown) => (e as Error)?.message === "cancelled";

/* ---- Network info ---- */
export interface NetInfoRaw {
  ifconfig: string;
  route: string;
  scutil_dns: string;
  hardware_ports: string;
  wifi_summary: string;
  hostname: string;
}
export const netInfo = () => call<NetInfoRaw>("net_info");

/* ---- Ports ---- */
/** `lsof -F pcuLPnT` output for TCP listeners + UDP sockets of this user's processes. */
export const listPorts = () => call<string>("list_ports");
export const killProcess = (pid: number, force: boolean) => call<void>("kill_process", { pid, force });

/* ---- Ping / traceroute ---- */
export type ProbeEvent = { kind: "line"; text: string } | { kind: "done"; code: number | null };
/** Starts ping (count 0 = until stopped) or traceroute; events stream to `onEvent`. Resolves to the probe id. */
export function startProbe(kind: "ping" | "traceroute", host: string, count: number, onEvent: (e: ProbeEvent) => void) {
  const channel = new Channel<ProbeEvent>();
  channel.onmessage = onEvent;
  return call<number>("start_probe", { kind, host, count, onEvent: channel });
}
export const stopProbe = (id: number) => call<void>("stop_probe", { id });

/* ---- DNS ---- */
export interface DnsService {
  name: string;
  enabled: boolean;
  /** Empty = Automatic (DHCP). */
  servers: string[];
}
export interface DnsStatus {
  services: DnsService[];
  resolvers: string;
}
export const dnsStatus = () => call<DnsStatus>("dns_status");
/** `service` null = every enabled service; `servers` empty = Automatic. Asks for the admin password. */
export const dnsSet = (service: string | null, servers: string[]) => call<void>("dns_set", { service, servers });
export const dnsFlush = () => call<void>("dns_flush");
/** Best-of-3 query time in ms for one server (UDP port 53). */
export const dnsBenchmark = (server: string) => call<number>("dns_benchmark", { server });

/* ---- Throttle ---- */
export interface ThrottleProfile {
  preset: string;
  downKbps: number;
  upKbps: number;
  delayMs: number;
  lossPct: number;
}
export interface ThrottleStatus {
  active: boolean;
  /** JSON written when it was turned on: ThrottleProfile + `until` (unix seconds). */
  profile: string | null;
}
export const throttleStatus = () => call<ThrottleStatus>("throttle_status");
export const throttleStart = (p: ThrottleProfile, minutes: number) =>
  call<void>("throttle_start", { ...p, minutes });
export const throttleStop = () => call<void>("throttle_stop");

/* ---- Hosts ---- */
export const hostsRead = () => call<string>("hosts_read");
export const hostsWrite = (content: string) => call<void>("hosts_write", { content });
export const hostsBackup = () => call<string | null>("hosts_backup");
