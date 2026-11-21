import { ArrowRightLeft } from "lucide-react";
import type { ToolDef } from "../types";
import { TransformTool, type TransformMode } from "../../lib/ui";
import { jsonToYaml, yamlToJson } from "./logic";

type Mode = "to-yaml" | "to-json";

const MODES: TransformMode<Mode>[] = [
  { value: "to-yaml", label: "JSON → YAML", run: jsonToYaml, inputLang: "json", outputLang: "yaml", okText: "Converted to YAML", placeholder: '{"key": "value"}', inverse: "to-json" },
  { value: "to-json", label: "YAML → JSON", run: yamlToJson, inputLang: "yaml", outputLang: "json", okText: "Converted to JSON", placeholder: "key: value", inverse: "to-yaml" },
];

const SAMPLE: Record<Mode, string> = {
  "to-yaml": `{"service":"api","replicas":3,"ports":[80,443],"env":{"NODE_ENV":"production","DEBUG":false}}`,
  "to-json": `service: api\nreplicas: 3\nports:\n  - 80\n  - 443\nenv:\n  NODE_ENV: production\n  DEBUG: false\n`,
};

function JsonYaml() {
  return <TransformTool modes={MODES} sample={SAMPLE} />;
}

export const tool: ToolDef = {
  id: "json-yaml",
  name: "JSON ↔ YAML",
  category: "Converters",
  description: "Convert between JSON and YAML both ways",
  icon: ArrowRightLeft,
  keywords: ["json", "yaml", "convert"],
  component: JsonYaml,
};
