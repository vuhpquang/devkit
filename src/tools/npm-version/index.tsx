import { useState } from "react";
import type { ToolDef } from "../types";
import { ToolLayout } from "../../lib/ToolLayout";
import { ErrorBanner } from "../../lib/ErrorBanner";
import { fetchPackageInfo, type NpmPackageInfo } from "./logic";

function NpmVersion() {
  const [packageName, setPackageName] = useState("");
  const [info, setInfo] = useState<NpmPackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btn =
    "px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed";

  async function handleLookup() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await fetchPackageInfo(packageName);
      setInfo(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleLookup();
    }
  }

  return (
    <ToolLayout title="npm Package">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. react, @types/node"
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          className={btn}
          onClick={handleLookup}
          disabled={loading || !packageName.trim()}
        >
          {loading ? "Looking up…" : "Lookup"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {!error && !info && !loading && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Enter a package name and click Lookup to retrieve version information.
        </p>
      )}

      {info && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Header */}
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-1">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {info.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                v{info.latest}
              </span>
            </div>
            {info.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {info.description}
              </p>
            )}
          </div>

          {/* Meta */}
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4">
            <dl className="space-y-2 text-sm">
              {info.license && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">License</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{info.license}</dd>
                </div>
              )}
              {info.author && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Author</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{info.author}</dd>
                </div>
              )}
              {info.publishedAt && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Published</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">
                    {new Date(info.publishedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              )}
              {info.homepage && (
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 font-medium text-zinc-500 dark:text-zinc-400">Homepage</dt>
                  <dd>
                    <a
                      href={info.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {info.homepage}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Keywords */}
          {info.keywords && info.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {info.keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Version history */}
          {info.versions.length > 0 && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Version History ({info.versions.length})
                </h3>
              </div>
              <ul className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {info.versions.map((v) => (
                  <li
                    key={v}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-mono ${
                      v === info.latest
                        ? "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 font-semibold"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {v}
                    {v === info.latest && (
                      <span className="text-xs font-sans font-normal px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                        latest
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
}

export const tool: ToolDef = {
  id: "npm-version",
  name: "npm Package",
  category: "Network",
  keywords: ["npm", "package", "version", "yarn", "registry", "node", "javascript"],
  online: true,
  component: NpmVersion,
};
