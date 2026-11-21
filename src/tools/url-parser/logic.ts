export interface ParsedUrl {
  href: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  /** Explicit port, or "" when the URL uses the scheme's default. */
  port: string;
  /** The scheme's default port (80, 443…) when known. */
  defaultPort: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  /** Decoded query parameters in order; repeated keys appear once per value. */
  params: [string, string][];
  /** True when "https://" was added because the input had no scheme. */
  assumedScheme: boolean;
}

export type Result = { ok: true; url: ParsedUrl } | { ok: false; error: string };

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443", "ws:": "80", "wss:": "443", "ftp:": "21" };

/** Parses a URL with the WHATWG parser. Input without a scheme is tried as https://… */
export function parseUrl(input: string): Result {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Empty input" };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^:/]+:\d+(\/|$)/.test(raw);
  const candidate = hasScheme ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, error: `Not a valid URL: ${raw}` };
  }
  if (!hasScheme && !u.hostname.includes(".") && u.hostname !== "localhost") {
    return { ok: false, error: `Not a valid URL: ${raw} — add a scheme like https:// or a domain` };
  }
  return {
    ok: true,
    url: {
      href: u.href,
      protocol: u.protocol,
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      defaultPort: DEFAULT_PORTS[u.protocol] ?? "",
      pathname: safeDecode(u.pathname),
      search: u.search,
      hash: safeDecode(u.hash),
      origin: u.origin === "null" ? "" : u.origin,
      params: [...u.searchParams.entries()],
      assumedScheme: !hasScheme,
    },
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
