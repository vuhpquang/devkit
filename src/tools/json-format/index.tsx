import { useMemo, useState } from "react";
import { Braces } from "lucide-react";
import type { ToolDef } from "../types";
import { Segmented, TransformTool, type TransformMode } from "../../lib/ui";
import { formatJson, minifyJson } from "./logic";

const SAMPLE = `{"name":"devkit","version":"1.0.0","private":true,"tags":["json","format"],"author":{"name":"Ha Phung Quang Vu","url":"https://vuhpquang.com"},"stars":42,"license":null}`;

type Mode = "format" | "minify";

function JsonFormat() {
  const [indent, setIndent] = useState<"2" | "4">("2");
  const modes = useMemo<TransformMode<Mode>[]>(
    () => [
      { value: "format", label: "Format", run: (s) => formatJson(s, Number(indent)), inputLang: "json", outputLang: "json", okText: "Valid JSON", placeholder: '{"hello": "world"}' },
      { value: "minify", label: "Minify", run: minifyJson, inputLang: "json", outputLang: "json", okText: "Valid JSON · minified", placeholder: '{"hello": "world"}' },
    ],
    [indent],
  );
  return (
    <TransformTool
      modes={modes}
      sample={SAMPLE}
      options={
        <Segmented
          label="Indent"
          size="sm"
          value={indent}
          onChange={setIndent}
          options={[
            { value: "2", label: "2 spaces" },
            { value: "4", label: "4 spaces" },
          ]}
        />
      }
    />
  );
}

export const tool: ToolDef = {
  id: "json-format",
  name: "JSON Format",
  category: "Formatters",
  description: "Pretty-print, minify and validate JSON",
  icon: Braces,
  keywords: ["json", "pretty", "minify", "validate", "beautify"],
  component: JsonFormat,
};
