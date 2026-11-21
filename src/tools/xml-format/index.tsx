import { CodeXml } from "lucide-react";
import type { ToolDef } from "../types";
import { TransformTool, type TransformMode } from "../../lib/ui";
import { formatXml } from "./logic";

const SAMPLE = `<?xml version="1.0"?><catalog><book id="bk101"><author>Gambardella, Matthew</author><title>XML Developer's Guide</title><price>44.95</price></book><book id="bk102"><author>Ralls, Kim</author><title>Midnight Rain</title><price>5.95</price></book></catalog>`;

const MODES: TransformMode<"format">[] = [
  { value: "format", label: "Format", run: formatXml, inputLang: "xml", outputLang: "xml", okText: "Valid XML", placeholder: "<root><child>value</child></root>" },
];

function XmlFormat() {
  return <TransformTool modes={MODES} sample={SAMPLE} />;
}

export const tool: ToolDef = {
  id: "xml-format",
  name: "XML Format",
  category: "Formatters",
  description: "Indent and validate XML documents",
  icon: CodeXml,
  keywords: ["xml", "format", "validate", "beautify"],
  component: XmlFormat,
};
