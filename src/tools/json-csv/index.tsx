import { useMemo, useState } from "react";
import { Sheet } from "lucide-react";
import type { ToolDef } from "../types";
import { Segmented, Toggle, TransformTool, type TransformMode } from "../../lib/ui";
import { csvToJson, jsonToCsv, type Delimiter } from "./logic";

type Mode = "to-csv" | "to-json";
type DelimiterKey = "comma" | "semicolon" | "tab";

const DELIMITERS: Record<DelimiterKey, Delimiter> = { comma: ",", semicolon: ";", tab: "\t" };

const SAMPLE: Record<Mode, string> = {
  "to-csv": JSON.stringify(
    [
      { id: 1, name: "Ada Lovelace", email: "ada@example.com", active: true, tags: ["math", "engines"] },
      { id: 2, name: "Grace Hopper", email: "grace@example.com", active: false, note: 'Said "it\'s easier to ask forgiveness"' },
      { id: 3, name: "Lin, Alan", email: "alan@example.com", active: true },
    ],
    null,
    2,
  ),
  "to-json": 'id,name,email,active\n1,Ada Lovelace,ada@example.com,true\n2,"Lin, Alan",alan@example.com,false\n3,"Quote ""Q"" Smith",q@example.com,true\n',
};

function JsonCsv() {
  const [delimiterKey, setDelimiterKey] = useState<DelimiterKey>("comma");
  const [detect, setDetect] = useState(true);
  const delimiter = DELIMITERS[delimiterKey];

  const modes = useMemo<TransformMode<Mode>[]>(
    () => [
      {
        value: "to-csv",
        label: "JSON → CSV",
        run: (s) => jsonToCsv(s, delimiter),
        inputLang: "json",
        okText: "Converted to CSV",
        placeholder: '[{"id": 1, "name": "Ada"}]',
        inverse: "to-json",
      },
      {
        value: "to-json",
        label: "CSV → JSON",
        run: (s) => csvToJson(s, delimiter, detect),
        outputLang: "json",
        okText: "Converted to JSON",
        placeholder: "id,name\n1,Ada",
        inverse: "to-csv",
      },
    ],
    [delimiter, detect],
  );

  return (
    <TransformTool
      modes={modes}
      sample={SAMPLE}
      options={
        <>
          <Segmented
            label="Delimiter"
            size="sm"
            value={delimiterKey}
            onChange={setDelimiterKey}
            options={[
              { value: "comma", label: "Comma" },
              { value: "semicolon", label: "Semicolon" },
              { value: "tab", label: "Tab" },
            ]}
          />
          <Toggle size="sm" on={detect} onToggle={() => setDetect(!detect)} title="CSV → JSON: turn 42, true, false and null into JSON values" className="font-medium">
            Detect numbers &amp; booleans
          </Toggle>
        </>
      }
    />
  );
}

export const tool: ToolDef = {
  id: "json-csv",
  name: "JSON ↔ CSV",
  category: "Converters",
  description: "Turn JSON arrays into CSV tables and back",
  icon: Sheet,
  keywords: ["json", "csv", "tsv", "table", "spreadsheet", "excel", "convert"],
  component: JsonCsv,
};
