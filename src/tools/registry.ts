import type { Category, ToolDef } from "./types";

export const CATEGORY_ORDER: Category[] = [
  "Formatters",
  "Diff",
  "Converters",
  "Encoders",
  "Generators",
  "Network",
];

// Tools are appended here as they are implemented.
export const tools: ToolDef[] = [];

export function getToolById(id: string): ToolDef | undefined {
  return tools.find((t) => t.id === id);
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
