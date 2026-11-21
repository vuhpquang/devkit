/** Internet speed test against Cloudflare's speed endpoints. The measuring loop is pure over a Transport. */

export const BASE = "https://speed.cloudflare.com";
export const LATENCY_SAMPLES = 10;
export const DOWNLOAD_SIZES = [100_000, 1_000_000, 10_000_000, 25_000_000];
export const UPLOAD_SIZES = [100_000, 1_000_000, 5_000_000];
/** A request slower than this ends the size ramp: bigger ones would only take longer. */
export const SLOW_REQUEST_MS = 2000;

export interface Transport {
  /** Milliseconds, monotonic. */
  now(): number;
  /** GET /__down?bytes=n and read the whole body. */
  download(bytes: number, signal: AbortSignal): Promise<void>;
  /** POST /__up with an n-byte body. */
  upload(bytes: number, signal: AbortSignal): Promise<void>;
}

export type Phase = "latency" | "download" | "upload" | "done";
export type Verdict = "slow" | "medium" | "fast";

export interface Progress {
  phase: Phase;
  latencyMs: number | null;
  jitterMs: number | null;
  downMbps: number | null;
  upMbps: number | null;
  /** Bytes moved so far (both directions). */
  usedBytes: number;
}

export interface Result extends Progress {
  phase: "done";
  latencyMs: number;
  jitterMs: number;
  downMbps: number;
  upMbps: number;
  verdict: Verdict;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Mean absolute difference between consecutive samples. */
export function jitter(xs: number[]): number {
  if (xs.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < xs.length; i++) sum += Math.abs(xs[i] - xs[i - 1]);
  return sum / (xs.length - 1);
}

export const mbps = (bytes: number, ms: number) => (ms <= 0 ? 0 : (bytes * 8) / (ms / 1000) / 1_000_000);

/** Slow: under 5 Mbit/s down or latency over 150 ms. Medium: under 25 Mbit/s. Fast: the rest. */
export function classify(downMbps: number, latencyMs: number): Verdict {
  if (downMbps < 5 || latencyMs > 150) return "slow";
  if (downMbps < 25) return "medium";
  return "fast";
}

/**
 * Throughput from a size ramp: the best of the runs that moved at least 1 MB (small runs are dominated by
 * latency and under-report), or the best overall when the connection was too slow to get there.
 */
export function throughput(runs: { bytes: number; ms: number }[]): number {
  const big = runs.filter((r) => r.bytes >= 1_000_000);
  const use = big.length ? big : runs;
  return use.length ? Math.max(...use.map((r) => mbps(r.bytes, r.ms))) : 0;
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
}

async function ramp(
  sizes: number[],
  send: (n: number) => Promise<void>,
  t: Transport,
  signal: AbortSignal,
  onRun: (runs: { bytes: number; ms: number }[]) => void,
) {
  const runs: { bytes: number; ms: number }[] = [];
  for (const n of sizes) {
    checkAbort(signal);
    const start = t.now();
    await send(n);
    const ms = t.now() - start;
    runs.push({ bytes: n, ms });
    onRun(runs);
    if (ms > SLOW_REQUEST_MS) break;
  }
  return runs;
}

/** Runs latency → download → upload, reporting progress after every request. */
export async function runSpeedTest(t: Transport, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<Result> {
  const p: Progress = { phase: "latency", latencyMs: null, jitterMs: null, downMbps: null, upMbps: null, usedBytes: 0 };
  const report = () => onProgress({ ...p });
  report();

  const pings: number[] = [];
  for (let i = 0; i < LATENCY_SAMPLES; i++) {
    checkAbort(signal);
    const start = t.now();
    await t.download(0, signal);
    pings.push(t.now() - start);
    p.latencyMs = median(pings);
    p.jitterMs = jitter(pings);
    report();
  }

  p.phase = "download";
  report();
  const down = await ramp(DOWNLOAD_SIZES, (n) => t.download(n, signal), t, signal, (runs) => {
    p.usedBytes = runs.reduce((a, r) => a + r.bytes, 0);
    p.downMbps = throughput(runs);
    report();
  });
  const downBytes = p.usedBytes;

  p.phase = "upload";
  report();
  await ramp(UPLOAD_SIZES, (n) => t.upload(n, signal), t, signal, (runs) => {
    p.usedBytes = downBytes + runs.reduce((a, r) => a + r.bytes, 0);
    p.upMbps = throughput(runs);
    report();
  });

  const result: Result = {
    phase: "done",
    latencyMs: p.latencyMs ?? 0,
    jitterMs: p.jitterMs ?? 0,
    downMbps: throughput(down),
    upMbps: p.upMbps ?? 0,
    usedBytes: p.usedBytes,
    verdict: classify(throughput(down), p.latencyMs ?? 0),
  };
  onProgress(result);
  return result;
}

/** "1.2 MB", "38 MB". */
export function formatBytes(n: number): string {
  if (n < 1_000_000) return `${Math.max(0, Math.round(n / 1000))} kB`;
  const mb = n / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** "94.3", "512", "0.85" — three significant-ish digits. */
export function formatMbps(n: number): string {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
