import { describe, it, expect } from "vitest";
import {
  classify,
  DOWNLOAD_SIZES,
  formatBytes,
  formatMbps,
  jitter,
  LATENCY_SAMPLES,
  mbps,
  median,
  runSpeedTest,
  throughput,
  UPLOAD_SIZES,
  type Progress,
  type Transport,
} from "./logic";

/** A fake network: fixed latency plus bytes at a fixed rate, on a fake clock. */
function fakeNet({ latencyMs, downMbps, upMbps }: { latencyMs: number; downMbps: number; upMbps: number }) {
  let clock = 0;
  const calls: string[] = [];
  const t: Transport = {
    now: () => clock,
    async download(bytes) {
      calls.push(`down ${bytes}`);
      clock += latencyMs + (bytes * 8) / (downMbps * 1_000_000) * 1000;
    },
    async upload(bytes) {
      calls.push(`up ${bytes}`);
      clock += latencyMs + (bytes * 8) / (upMbps * 1_000_000) * 1000;
    },
  };
  return { t, calls };
}

describe("helpers", () => {
  it("median, jitter and Mbit/s", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(jitter([10, 14, 12])).toBe(3);
    expect(jitter([7])).toBe(0);
    expect(mbps(1_000_000, 1000)).toBe(8);
    expect(mbps(1, 0)).toBe(0);
  });

  it("classifies by download and latency", () => {
    expect(classify(3, 20)).toBe("slow");
    expect(classify(100, 200)).toBe("slow");
    expect(classify(12, 40)).toBe("medium");
    expect(classify(25, 40)).toBe("fast");
  });

  it("prefers runs of at least 1 MB", () => {
    expect(throughput([{ bytes: 100_000, ms: 10 }, { bytes: 1_000_000, ms: 1000 }])).toBe(8);
    expect(throughput([{ bytes: 100_000, ms: 100 }])).toBe(8);
    expect(throughput([])).toBe(0);
  });

  it("formats", () => {
    expect(formatBytes(450_000)).toBe("450 kB");
    expect(formatBytes(1_200_000)).toBe("1.2 MB");
    expect(formatBytes(41_000_000)).toBe("41 MB");
    expect(formatMbps(512.4)).toBe("512");
    expect(formatMbps(94.33)).toBe("94.3");
    expect(formatMbps(0.854)).toBe("0.85");
  });
});

describe("runSpeedTest", () => {
  it("measures a fast line through every size", async () => {
    const { t, calls } = fakeNet({ latencyMs: 10, downMbps: 200, upMbps: 50 });
    const seen: Progress[] = [];
    const r = await runSpeedTest(t, (p) => seen.push(p), new AbortController().signal);
    expect(r.latencyMs).toBe(10);
    expect(r.jitterMs).toBe(0);
    expect(r.downMbps).toBeGreaterThan(190);
    expect(r.downMbps).toBeLessThanOrEqual(200);
    expect(r.upMbps).toBeGreaterThan(45);
    expect(r.verdict).toBe("fast");
    expect(calls.filter((c) => c === "down 0")).toHaveLength(LATENCY_SAMPLES);
    expect(calls.filter((c) => c.startsWith("down") && c !== "down 0")).toHaveLength(DOWNLOAD_SIZES.length);
    expect(calls.filter((c) => c.startsWith("up"))).toHaveLength(UPLOAD_SIZES.length);
    expect(r.usedBytes).toBe(DOWNLOAD_SIZES.reduce((a, b) => a + b) + UPLOAD_SIZES.reduce((a, b) => a + b));
    expect(seen.map((p) => p.phase)).toEqual(expect.arrayContaining(["latency", "download", "upload", "done"]));
  });

  it("stops growing once a request takes over 2 s, and calls a slow line slow", async () => {
    const { t, calls } = fakeNet({ latencyMs: 80, downMbps: 2, upMbps: 0.5 });
    const r = await runSpeedTest(t, () => {}, new AbortController().signal);
    // 1 MB at 2 Mbit/s = 4 s → no 10 MB / 25 MB requests.
    expect(calls).not.toContain("down 10000000");
    expect(calls).toContain("down 1000000");
    expect(r.downMbps).toBeLessThan(2.1);
    expect(r.verdict).toBe("slow");
  });

  it("stops when cancelled", async () => {
    const { t } = fakeNet({ latencyMs: 10, downMbps: 100, upMbps: 100 });
    const ac = new AbortController();
    let n = 0;
    await expect(
      runSpeedTest(
        t,
        () => {
          if (++n === 3) ac.abort();
        },
        ac.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
