import { Binary } from "lucide-react";
import type { ToolDef } from "../types";
import { TransformTool, type TransformMode } from "../../lib/ui";
import { encodeBase64, decodeBase64 } from "./logic";

type Mode = "encode" | "decode";

const MODES: TransformMode<Mode>[] = [
  { value: "encode", label: "Encode", run: encodeBase64, okText: "Encoded", placeholder: "Text to encode", inverse: "decode" },
  { value: "decode", label: "Decode", run: decodeBase64, okText: "Decoded", placeholder: "Base64 to decode", inverse: "encode" },
];

function Base64Tool() {
  return <TransformTool modes={MODES} sample={{ encode: "Hello, DevKit! Xin chào 👋", decode: "SGVsbG8sIERldktpdCEgWGluIGNow6BvIPCfkYs=" }} wrapByDefault />;
}

export const tool: ToolDef = {
  id: "base64",
  name: "Base64",
  category: "Encoders",
  description: "Encode text to Base64 and decode it back (UTF-8)",
  icon: Binary,
  keywords: ["base64", "encode", "decode"],
  component: Base64Tool,
};
