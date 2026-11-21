import { Link } from "lucide-react";
import type { ToolDef } from "../types";
import { TransformTool, type TransformMode } from "../../lib/ui";
import { encodeUrl, decodeUrl } from "./logic";

type Mode = "encode" | "decode";

const MODES: TransformMode<Mode>[] = [
  { value: "encode", label: "Encode", run: encodeUrl, okText: "Encoded", placeholder: "Text or URL component to encode", inverse: "decode" },
  { value: "decode", label: "Decode", run: decodeUrl, okText: "Decoded", placeholder: "Percent-encoded text to decode", inverse: "encode" },
];

function UrlCodec() {
  return (
    <TransformTool
      modes={MODES}
      sample={{ encode: "q=đà nẵng & sort=price desc", decode: "q%3D%C4%91%C3%A0%20n%E1%BA%B5ng%20%26%20sort%3Dprice%20desc" }}
      wrapByDefault
    />
  );
}

export const tool: ToolDef = {
  id: "url-codec",
  name: "URL Encode / Decode",
  category: "Encoders",
  description: "Percent-encode text for URLs, or decode it",
  icon: Link,
  keywords: ["url", "uri", "encode", "decode", "percent"],
  component: UrlCodec,
};
