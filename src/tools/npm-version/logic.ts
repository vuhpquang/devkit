import { fetch } from "@tauri-apps/plugin-http";

export interface NpmPackageInfo {
  name: string;
  description: string;
  latest: string;
  versions: string[];
  homepage?: string;
  license?: string;
  author?: string;
  keywords?: string[];
  publishedAt?: string;
}

export async function fetchPackageInfo(packageName: string): Promise<NpmPackageInfo> {
  const trimmed = packageName.trim();
  if (!trimmed) {
    throw new Error("Package name is required");
  }

  const url = `https://registry.npmjs.org/${encodeURIComponent(trimmed)}`;

  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new Error(`Network error: ${(e as Error).message}`);
  }

  if (response.status === 404) {
    throw new Error(`Package "${trimmed}" not found`);
  }

  if (!response.ok) {
    throw new Error(`Registry returned status ${response.status}`);
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse registry response");
  }

  const distTags = data["dist-tags"] as Record<string, string> | undefined;
  const latest = distTags?.latest ?? "";

  const rawVersions = data["versions"] as Record<string, unknown> | undefined;
  const versions = rawVersions
    ? Object.keys(rawVersions).reverse()
    : [];

  const rawAuthor = data["author"] as { name?: string } | string | undefined;
  let author: string | undefined;
  if (typeof rawAuthor === "string") {
    author = rawAuthor;
  } else if (rawAuthor && typeof rawAuthor === "object" && rawAuthor.name) {
    author = rawAuthor.name;
  }

  const time = data["time"] as Record<string, string> | undefined;
  const publishedAt = latest && time ? time[latest] : undefined;

  return {
    name: (data["name"] as string) ?? trimmed,
    description: (data["description"] as string) ?? "",
    latest,
    versions,
    homepage: data["homepage"] as string | undefined,
    license: data["license"] as string | undefined,
    author,
    keywords: data["keywords"] as string[] | undefined,
    publishedAt,
  };
}
