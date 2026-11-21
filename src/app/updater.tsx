import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import pkg from "../../package.json";
import { compareVersions, fetchLatestRelease, type Release } from "./updates";
import { useSettings } from "./settings";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "upToDate" }
  | { kind: "available"; release: Release }
  | { kind: "failed"; message: string };

interface Ctx {
  state: UpdateState;
  lastChecked: Date | null;
  check: (userInitiated: boolean) => Promise<void>;
}

const UpdaterCtx = createContext<Ctx>({ state: { kind: "idle" }, lastChecked: null, check: async () => {} });

const FIRST_CHECK_MS = 10_000;
const EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Checks GitHub for a newer DevKit, like app-shell's Updater: 10 s after launch, then every 6 h, only while
 * "Check for updates automatically" is on. A background check never replaces an "available" or "failed"
 * state the user hasn't seen through, and never surfaces an error. Installing is App Depot's job.
 */
export function UpdaterProvider({ children, version = pkg.version }: { children: ReactNode; version?: string }) {
  const { settings } = useSettings();
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const check = useCallback(
    async (userInitiated: boolean) => {
      const prev = stateRef.current;
      if (prev.kind === "checking") return;
      if (!userInitiated && (prev.kind === "available" || prev.kind === "failed")) return;
      if (userInitiated) setState({ kind: "checking" });
      try {
        const latest = await fetchLatestRelease();
        setLastChecked(new Date());
        setState(compareVersions(latest.version, version) > 0 ? { kind: "available", release: latest } : { kind: "upToDate" });
      } catch (e) {
        if (userInitiated) setState({ kind: "failed", message: (e as Error).message });
      }
    },
    [version],
  );

  useEffect(() => {
    if (!settings.autoCheckUpdates) return;
    const first = setTimeout(() => void check(false), FIRST_CHECK_MS);
    const every = setInterval(() => void check(false), EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [settings.autoCheckUpdates, check]);

  return <UpdaterCtx.Provider value={{ state, lastChecked, check }}>{children}</UpdaterCtx.Provider>;
}

export const useUpdater = () => useContext(UpdaterCtx);
