import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { CopyButton, PasteButton, ClearButton } from "../../lib/Toolbar";
import { hashAll } from "./logic";

function Hash() {
  const [input, setInput] = useState("");
  const r = hashAll(input);
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center gap-2">
      <span className="w-20 text-zinc-500 text-sm">{label}</span>
      <code className="flex-1 break-all text-sm">{value}</code>
      <CopyButton text={value} />
    </div>
  );
  return (
    <ToolLayout title="Hash Generator">
      <div className="flex gap-2">
        <PasteButton onPaste={setInput} />
        <ClearButton onClick={() => setInput("")} />
      </div>
      <TextPane label="Input" value={input} onChange={setInput} />
      <div className="flex flex-col gap-2">
        <Row label="MD5" value={r.md5} />
        <Row label="SHA-1" value={r.sha1} />
        <Row label="SHA-256" value={r.sha256} />
      </div>
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "hash",
  name: "Hash Generator",
  category: "Generators",
  keywords: ["hash", "md5", "sha", "sha256", "checksum", "digest"],
  component: Hash,
};
