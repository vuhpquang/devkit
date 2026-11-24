import { useDeferredValue, useMemo } from "react";
import { Fingerprint } from "lucide-react";
import type { ToolDef } from "../types";
import { EditorPane, KeyValueList, Panel, Segmented, ToolBar, ToolPage } from "../../lib/ui";
import { useSaved } from "../../lib/saved";
import { hashAll } from "./logic";

function Hash() {
  const [input, setInput] = useSaved("input", "");
  const [upper, setUpper] = useSaved<"lower" | "upper">("case", "lower", { valid: (v) => v === "lower" || v === "upper" });
  const deferred = useDeferredValue(input);
  const r = useMemo(() => hashAll(deferred), [deferred]);
  const fmt = (s: string) => (upper === "upper" ? s.toUpperCase() : s);

  return (
    <ToolPage>
      <ToolBar>
        <Segmented
          label="Letter case"
          size="sm"
          value={upper}
          onChange={setUpper}
          options={[
            { value: "lower", label: "abc" },
            { value: "upper", label: "ABC" },
          ]}
        />
        <span className="text-sm text-fg-faint">Hashes of the UTF-8 text, updated as you type</span>
      </ToolBar>
      <EditorPane title="Input" value={input} onChange={setInput} placeholder="Text to hash" wrap autoFocus className="flex-1" />
      <Panel title="Digests" icon={Fingerprint} className="shrink-0" meta={input ? undefined : "of an empty string"}>
        <KeyValueList
          copy
          mono
          labelWidth="5rem"
          rows={[
            { label: "MD5", value: fmt(r.md5) },
            { label: "SHA-1", value: fmt(r.sha1) },
            { label: "SHA-256", value: fmt(r.sha256) },
          ]}
        />
      </Panel>
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "hash",
  name: "Hash Generator",
  category: "Generators",
  description: "MD5, SHA-1 and SHA-256 digests of text",
  icon: Fingerprint,
  keywords: ["hash", "md5", "sha", "sha256", "checksum", "digest"],
  component: Hash,
};
