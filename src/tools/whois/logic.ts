import { invoke } from "@tauri-apps/api/core";

export async function whoisLookup(domain: string): Promise<string> {
  const trimmed = domain.trim();
  if (!trimmed) {
    throw new Error("Domain is required");
  }
  try {
    return await invoke<string>("whois_lookup", { domain: trimmed });
  } catch (e) {
    throw new Error(e as string);
  }
}
