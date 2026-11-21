import type { Category, ToolDef } from "./types";

export const CATEGORY_ORDER: Category[] = [
  "Formatters",
  "Diff",
  "Converters",
  "Encoders",
  "Generators",
  "Text",
  "Design",
  "System",
  "Network",
];

// Tools are appended here as they are implemented.
export const tools: ToolDef[] = [];

/** Ids of tools that were merged into another one; favourites, recents and the last tool still resolve. */
export const TOOL_ALIASES: Record<string, string> = {
  // 0.5.0: JSON Editor became JSON Format (edit) + JSON Diff (compare).
  "json-editor": "json-format",
};

export function getToolById(id: string): ToolDef | undefined {
  const real = TOOL_ALIASES[id] ?? id;
  return tools.find((t) => t.id === real);
}

// --- Tool registrations ---
import { tool as jsonFormatTool } from "./json-format";
tools.push(jsonFormatTool);
import { tool as sqlFormatTool } from "./sql-format";
tools.push(sqlFormatTool);
import { tool as xmlFormatTool } from "./xml-format";
tools.push(xmlFormatTool);
import { tool as jsonDiffTool } from "./json-diff";
tools.push(jsonDiffTool);
import { tool as textDiffTool } from "./text-diff";
tools.push(textDiffTool);
import { tool as jsonYamlTool } from "./json-yaml";
tools.push(jsonYamlTool);
import { tool as jsToJsonTool } from "./js-to-json";
tools.push(jsToJsonTool);
import { tool as timestampTool } from "./timestamp";
tools.push(timestampTool);
import { tool as numberBaseTool } from "./number-base";
tools.push(numberBaseTool);
import { tool as base64Tool } from "./base64";
tools.push(base64Tool);
import { tool as urlCodecTool } from "./url-codec";
tools.push(urlCodecTool);
import { tool as jwtDecodeTool } from "./jwt-decode";
tools.push(jwtDecodeTool);
import { tool as hashTool } from "./hash";
tools.push(hashTool);
import { tool as uuidTool } from "./uuid";
tools.push(uuidTool);
import { tool as loremTool } from "./lorem";
tools.push(loremTool);
import { tool as whoisTool } from "./whois";
tools.push(whoisTool);
import { tool as dnsLookupTool } from "./dns-lookup";
tools.push(dnsLookupTool);
import { tool as ipInfoTool } from "./ip-info";
tools.push(ipInfoTool);
import { tool as npmVersionTool } from "./npm-version";
tools.push(npmVersionTool);
import { tool as currencyTool } from "./currency";
tools.push(currencyTool);
import { tool as regexTesterTool } from "./regex-tester";
tools.push(regexTesterTool);
import { tool as caseConverterTool } from "./case-converter";
tools.push(caseConverterTool);
import { tool as markdownPreviewTool } from "./markdown-preview";
tools.push(markdownPreviewTool);
import { tool as htmlEntitiesTool } from "./html-entities";
tools.push(htmlEntitiesTool);
import { tool as urlParserTool } from "./url-parser";
tools.push(urlParserTool);
import { tool as colorConverterTool } from "./color-converter";
tools.push(colorConverterTool);
import { tool as cronParserTool } from "./cron-parser";
tools.push(cronParserTool);
import { tool as jsonCsvTool } from "./json-csv";
tools.push(jsonCsvTool);
import { tool as chmodCalculatorTool } from "./chmod-calculator";
tools.push(chmodCalculatorTool);
import { tool as passwordGeneratorTool } from "./password-generator";
tools.push(passwordGeneratorTool);
import { tool as pngTintTool } from "./png-tint";
tools.push(pngTintTool);
import { tool as gitlabTool } from "./gitlab";
tools.push(gitlabTool);
import { tool as dnsSwitcherTool } from "./dns-switcher";
tools.push(dnsSwitcherTool);
import { tool as networkThrottleTool } from "./network-throttle";
tools.push(networkThrottleTool);
import { tool as hostsEditorTool } from "./hosts-editor";
tools.push(hostsEditorTool);
import { tool as networkInfoTool } from "./network-info";
tools.push(networkInfoTool);
import { tool as portInspectorTool } from "./port-inspector";
tools.push(portInspectorTool);
import { tool as pingTracerouteTool } from "./ping-traceroute";
tools.push(pingTracerouteTool);
import { tool as speedTestTool } from "./speed-test";
tools.push(speedTestTool);
import { tool as svgReactTool } from "./svg-react";
tools.push(svgReactTool);
import { tool as imageConverterTool } from "./image-converter";
tools.push(imageConverterTool);
import { tool as imageResizeTool } from "./image-resize";
tools.push(imageResizeTool);
