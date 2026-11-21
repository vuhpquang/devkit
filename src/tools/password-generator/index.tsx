import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EditorPane, Notice, TextInput, Toggle, ToolBar, ToolBarDivider, ToolPage } from "../../lib/ui";
import {
  DEFAULT_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  entropyBits,
  generatePassword,
  strength,
  type PasswordOptions,
} from "./logic";

const MAX_COUNT = 50;

function Chip({ on, onToggle, children, title }: { on: boolean; onToggle: () => void; children: ReactNode; title?: string }) {
  return (
    <Toggle size="sm" on={on} onToggle={onToggle} title={title} className="font-medium">
      {children}
    </Toggle>
  );
}

function PasswordGenerator() {
  const [opts, setOpts] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [countText, setCountText] = useState("5");
  const [passwords, setPasswords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const count = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(countText)) || 1));

  const generate = useCallback(() => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const r = generatePassword(opts);
      if (!r.ok) {
        setError(r.error);
        setPasswords([]);
        return;
      }
      out.push(r.value);
    }
    setError(null);
    setPasswords(out);
  }, [opts, count]);

  // Regenerate whenever an option changes.
  useEffect(generate, [generate]);

  const bits = useMemo(() => entropyBits(opts), [opts]);
  const s = strength(bits);
  const set = <K extends keyof PasswordOptions>(k: K, v: PasswordOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <ToolPage>
      <ToolBar
        end={
          <Button variant="primary" icon={RefreshCw} onClick={generate}>
            Generate
          </Button>
        }
      >
        <span className="text-base text-fg-muted">Length</span>
        <input
          type="range"
          aria-label="Length slider"
          min={MIN_LENGTH}
          max={64}
          value={Math.min(opts.length, 64)}
          onChange={(e) => set("length", Number(e.target.value))}
          className="w-36 accent-accent"
        />
        <TextInput
          aria-label="Length"
          type="number"
          min={MIN_LENGTH}
          max={MAX_LENGTH}
          value={opts.length}
          onChange={(e) => set("length", Math.min(MAX_LENGTH, Number(e.target.value) || 0))}
          className="w-16 text-right tabular-nums"
        />
        <ToolBarDivider />
        <span className="text-base text-fg-muted">Count</span>
        <TextInput
          aria-label="How many passwords"
          type="number"
          min={1}
          max={MAX_COUNT}
          value={countText}
          onChange={(e) => setCountText(e.target.value)}
          className="w-16 text-right tabular-nums"
        />
      </ToolBar>

      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
        <Chip on={opts.lower} onToggle={() => set("lower", !opts.lower)} title="Lowercase letters">a–z</Chip>
        <Chip on={opts.upper} onToggle={() => set("upper", !opts.upper)} title="Uppercase letters">A–Z</Chip>
        <Chip on={opts.digits} onToggle={() => set("digits", !opts.digits)} title="Digits">0–9</Chip>
        <Chip on={opts.symbols} onToggle={() => set("symbols", !opts.symbols)} title="Symbols">!@#$</Chip>
        <ToolBarDivider />
        <Chip on={opts.avoidLookAlikes} onToggle={() => set("avoidLookAlikes", !opts.avoidLookAlikes)} title="Leave out I l 1 O 0">
          Avoid look-alikes
        </Chip>
        <div className="flex-1" />
        <Badge tone={s.tone}>{s.label}</Badge>
        <span className="text-sm text-fg-faint tabular-nums" title="length × log2(character pool)">
          ≈ {Math.round(bits)} bits of entropy
        </span>
      </div>

      {error && <Notice>{error}</Notice>}
      <EditorPane
        title={`Passwords · ${passwords.length}`}
        value={passwords.join("\n")}
        readOnly
        className="flex-1"
      />
      <p className="text-sm text-fg-faint shrink-0">Generated on this device with the system's secure random source. Nothing is stored or sent.</p>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "password-generator",
  name: "Password Generator",
  category: "Generators",
  description: "Strong random passwords with the characters you choose",
  icon: KeyRound,
  keywords: ["password", "passphrase", "random", "secret", "generate", "secure", "entropy"],
  component: PasswordGenerator,
};
