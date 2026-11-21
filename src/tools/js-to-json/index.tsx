import { FileJson } from "lucide-react";
import type { ToolDef } from "../types";
import { TransformTool, type TransformMode } from "../../lib/ui";
import { jsToJson } from "./logic";

const SAMPLE = `{
  name: 'devkit',
  // comments and trailing commas are fine
  tags: ['json5', 'js'],
  nested: { enabled: true, ratio: .5, },
}`;

const MODES: TransformMode<"convert">[] = [
  { value: "convert", label: "Convert", run: (s) => jsToJson(s), inputLang: "javascript", outputLang: "json", okText: "Converted to JSON", placeholder: "{ name: 'devkit', tags: ['a', 'b'] }" },
];

function JsToJson() {
  return <TransformTool modes={MODES} sample={SAMPLE} inputTitle="JS object" outputTitle="JSON" />;
}

export const tool: ToolDef = {
  id: "js-to-json",
  name: "JS Object → JSON",
  category: "Converters",
  description: "Turn a JavaScript / JSON5 object literal into strict JSON",
  icon: FileJson,
  keywords: ["javascript", "js", "object", "json", "convert", "json5"],
  component: JsToJson,
};
