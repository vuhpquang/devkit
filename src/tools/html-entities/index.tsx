import { useMemo } from "react";
import { Ampersand } from "lucide-react";
import type { ToolDef } from "../types";
import { Segmented, TransformTool, type TransformMode } from "../../lib/ui";
import { decodeEntities, encodeEntities } from "./logic";
import { useSaved } from "../../lib/saved";

type Mode = "encode" | "decode";

function HtmlEntities() {
  const [nonAscii, setNonAscii] = useSaved<"keep" | "encode">("nonAscii", "keep", { valid: (v) => v === "keep" || v === "encode" });
  const modes = useMemo<TransformMode<Mode>[]>(
    () => [
      {
        value: "encode",
        label: "Encode",
        run: (s) => encodeEntities(s, nonAscii === "encode"),
        okText: "Encoded",
        placeholder: `<p class="note">Fish & Chips</p>`,
        inverse: "decode",
      },
      {
        value: "decode",
        label: "Decode",
        run: decodeEntities,
        okText: "Decoded",
        placeholder: "&lt;p&gt;Fish &amp; Chips&lt;/p&gt;",
        inverse: "encode",
      },
    ],
    [nonAscii],
  );
  return (
    <TransformTool
      modes={modes}
      wrapByDefault
      sample={{
        encode: `<a href="/search?q=đà+nẵng&sort=asc">"Đà Nẵng" © 2026 — it's here</a>`,
        decode: "&lt;p&gt;Caf&eacute; &amp; cr&egrave;me &mdash; &#169; 2026 &#x1F600;&lt;/p&gt;",
      }}
      options={
        <Segmented
          label="Non-ASCII characters"
          size="sm"
          value={nonAscii}
          onChange={setNonAscii}
          options={[
            { value: "keep", label: "Keep non-ASCII", hint: "Only escape & < > \" '" },
            { value: "encode", label: "Encode non-ASCII", hint: "Also write every non-ASCII character as &#…;" },
          ]}
        />
      }
    />
  );
}

export const tool: ToolDef = {
  id: "html-entities",
  name: "HTML Entities",
  category: "Encoders",
  description: "Escape text for HTML, or decode &amp;-style entities back",
  icon: Ampersand,
  keywords: ["html", "entities", "escape", "unescape", "encode", "decode", "amp", "xml"],
  component: HtmlEntities,
};
