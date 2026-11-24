import { useDeferredValue, useMemo } from "react";
import { FileText, KeyRound, ShieldCheck } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, Button, EditorPane, EmptyState, KeyValueList, Notice, Panel, Split, ToolBar, ToolPage } from "../../lib/ui";
import { relativeTime } from "../timestamp/logic";
import { decodeJwt, timeClaims } from "./logic";
import { useHandoffText } from "../../lib/toolActive";
import { useSaved } from "../../lib/saved";

const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldktpdCBVc2VyIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjQxMDI0NDQ4MDB9.dGhpcy1pcy1ub3QtYS1yZWFsLXNpZ25hdHVyZQ";

const STATE = {
  valid: { tone: "success", text: "Not expired" },
  expired: { tone: "danger", text: "Expired" },
  "not-yet": { tone: "accent", text: "Not valid yet" },
  "no-expiry": { tone: "neutral", text: "No expiry" },
} as const;

function JwtDecode() {
  const handoff = useHandoffText();
  const [token, setToken] = useSaved("token", "", { prefer: handoff?.text.trim() });
  const deferred = useDeferredValue(token);
  const result = useMemo(() => (deferred.trim() ? decodeJwt(deferred) : null), [deferred]);
  const header = result?.ok ? JSON.stringify(result.header, null, 2) : "";
  const payload = result?.ok ? JSON.stringify(result.payload, null, 2) : "";
  const times = result?.ok ? timeClaims(result.payload) : null;

  return (
    <ToolPage>
      <ToolBar
        end={
          <Button size="sm" variant="ghost" icon={FileText} onClick={() => setToken(SAMPLE)}>
            Sample
          </Button>
        }
      >
        {times && <Badge tone={STATE[times.state].tone}>{STATE[times.state].text}</Badge>}
        {result?.ok && "alg" in result.header && (
          <Badge>alg {String((result.header as Record<string, unknown>).alg)}</Badge>
        )}
        <span className="text-sm text-fg-faint flex items-center gap-1.5">
          <ShieldCheck size={13} aria-hidden /> Decoded locally · signature not verified
        </span>
      </ToolBar>
      <EditorPane
        title="Token"
        value={token}
        onChange={setToken}
        placeholder="eyJhbGciOi…"
        wrap
        lineNumbers={false}
        autoFocus
        className="h-32 shrink-0"
      />
      {result && !result.ok && <Notice>{result.error}</Notice>}
      {result?.ok ? (
        <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 min-[980px]:grid-cols-[1fr_1.4fr_1fr] auto-rows-[minmax(0,1fr)]">
          <EditorPane title="Header" value={header} readOnly lang="json" />
          <EditorPane title="Payload" value={payload} readOnly lang="json" />
          <Panel title="Times" bodyClassName="overflow-auto">
            {times && times.claims.length > 0 ? (
              <KeyValueList
                labelWidth="5.5rem"
                rows={times.claims.map((c) => ({
                  label: c.label,
                  value: (
                    <span className="flex flex-col">
                      <span className="text-fg">{c.date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span className="text-sm text-fg-faint">{relativeTime(c.date)}</span>
                    </span>
                  ),
                }))}
              />
            ) : (
              <EmptyState icon={KeyRound} title="No time claims">The payload has no iat, nbf or exp.</EmptyState>
            )}
          </Panel>
        </div>
      ) : (
        !result && (
          <Split>
            <Panel title="Header">
              <EmptyState icon={KeyRound} title="Paste a JWT">Header and payload are decoded as you type.</EmptyState>
            </Panel>
            <Panel title="Payload">
              <EmptyState icon={KeyRound} title="Nothing decoded yet" />
            </Panel>
          </Split>
        )
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "jwt-decode",
  name: "JWT Decoder",
  category: "Encoders",
  description: "Read a JSON Web Token's header, payload and expiry",
  icon: KeyRound,
  keywords: ["jwt", "token", "decode", "json web token"],
  component: JwtDecode,
};
