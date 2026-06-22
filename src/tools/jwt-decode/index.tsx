import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { TextPane } from "../../lib/TextPane";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { PasteButton, ClearButton } from "../../lib/Toolbar";
import { decodeJwt, type Result } from "./logic";

function JwtDecode() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result>({ ok: true, header: {}, payload: {} });
  const header = result.ok ? JSON.stringify(result.header, null, 2) : "";
  const payload = result.ok ? JSON.stringify(result.payload, null, 2) : "";
  const btn = "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700";
  return (
    <ToolLayout title="JWT Decoder">
      <div className="flex gap-2">
        <button className={btn} onClick={() => setResult(decodeJwt(token))}>Decode</button>
        <PasteButton onPaste={setToken} />
        <ClearButton onClick={() => { setToken(""); setResult({ ok: true, header: {}, payload: {} }); }} />
      </div>
      <TextPane label="Token" value={token} onChange={setToken} placeholder="eyJ..." />
      {!result.ok && <ErrorBanner message={result.error} />}
      <div className="flex gap-4 flex-1 min-h-0">
        <TextPane label="Header" value={header} readOnly />
        <TextPane label="Payload" value={payload} readOnly />
      </div>
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "jwt-decode",
  name: "JWT Decoder",
  category: "Encoders",
  keywords: ["jwt", "token", "decode", "json web token"],
  component: JwtDecode,
};
