import { useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import type { ToolDef } from "../types";
import { Badge, CopyButton, EmptyState, KeyValueList, LookupBar, Notice, Panel, ToolPage, cx } from "../../lib/ui";
import { openExternal } from "../../lib/openExternal";
import { useSaved } from "../../lib/saved";
import { fetchPackageInfo, type NpmPackageInfo } from "./logic";

function NpmVersion() {
  const [packageName, setPackageName] = useSaved("package", "");
  const [info, setInfo] = useState<NpmPackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      setInfo(await fetchPackageInfo(packageName));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const install = info ? `npm i ${info.name}@${info.latest}` : "";

  return (
    <ToolPage>
      <LookupBar
        icon={Package}
        ariaLabel="Package name"
        value={packageName}
        onChange={setPackageName}
        onSubmit={handleLookup}
        loading={loading}
        canSubmit={!!packageName.trim()}
        placeholder="react, @types/node…"
      />
      {error && <Notice>{error}</Notice>}
      {!info ? (
        !error && (
          <EmptyState icon={Package} title={loading ? "Asking the npm registry…" : "Check a package"} className="flex-1">
            {!loading && "Latest version, licence and every published version from registry.npmjs.org."}
          </EmptyState>
        )
      ) : (
        <div className="flex-1 min-h-0 grid gap-3 grid-cols-1 min-[900px]:grid-cols-[1.4fr_1fr] auto-rows-[minmax(0,1fr)]">
          <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
            <Panel className="shrink-0" bodyClassName="p-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-mono text-lg font-semibold text-fg selectable">{info.name}</h2>
                <Badge tone="success">v{info.latest}</Badge>
              </div>
              {info.description && <p className="text-base text-fg-muted mt-1.5 selectable">{info.description}</p>}
              <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-2 border border-line pl-3 pr-1 h-9">
                <code className="flex-1 font-mono text-[12.5px] text-fg truncate selectable">{install}</code>
                <CopyButton text={install} label="Copy install command" />
              </div>
            </Panel>
            <Panel title="Details" className="shrink-0">
              <KeyValueList
                labelWidth="6.5rem"
                rows={[
                  ...(info.license ? [{ label: "License", value: info.license }] : []),
                  ...(info.author ? [{ label: "Author", value: info.author }] : []),
                  ...(info.publishedAt
                    ? [{ label: "Published", value: new Date(info.publishedAt).toLocaleDateString(undefined, { dateStyle: "long" }) }]
                    : []),
                  ...(info.homepage
                    ? [
                        {
                          label: "Homepage",
                          value: (
                            <button
                              type="button"
                              onClick={() => openExternal(info.homepage!)}
                              className="inline-flex items-center gap-1 text-accent-text hover:underline underline-offset-2 text-left break-all"
                            >
                              {info.homepage}
                              <ExternalLink size={12} className="shrink-0" aria-hidden />
                            </button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Panel>
            {info.keywords && info.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {info.keywords.map((kw) => (
                  <span key={kw} className="px-2 h-6 inline-flex items-center rounded-full text-sm bg-surface-3/70 text-fg-muted border border-line">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Panel title="Versions" meta={info.versions.length.toLocaleString()} bodyClassName="overflow-y-auto">
            <ul className="divide-y divide-line">
              {info.versions.map((v) => (
                <li
                  key={v}
                  className={cx(
                    "flex items-center gap-2 px-3 h-8 font-mono text-[12.5px] selectable",
                    v === info.latest ? "bg-success-soft text-success font-semibold" : "text-fg-muted",
                  )}
                >
                  {v}
                  {v === info.latest && <Badge tone="success">latest</Badge>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </ToolPage>
  );
}

export const tool: ToolDef = {
  id: "npm-version",
  name: "npm Package",
  category: "Network",
  description: "Latest version, licence and release history of an npm package",
  icon: Package,
  keywords: ["npm", "package", "version", "yarn", "registry", "node", "javascript"],
  online: true,
  component: NpmVersion,
};
