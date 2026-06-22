import { fetch } from "@tauri-apps/plugin-http";

export type DnsRecordType = "A" | "AAAA" | "MX" | "TXT" | "CNAME";

export interface DnsRecord {
  type: DnsRecordType;
  name: string;
  ttl: number;
  data: string;
}

export interface DnsResult {
  domain: string;
  records: DnsRecord[];
}

// DNS type number → string mapping
const DNS_TYPE_MAP: Record<number, DnsRecordType> = {
  1: "A",
  28: "AAAA",
  15: "MX",
  16: "TXT",
  5: "CNAME",
};

interface CloudflareAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface CloudflareResponse {
  Answer?: CloudflareAnswer[];
}

export async function dnsLookup(
  domain: string,
  types: DnsRecordType[]
): Promise<DnsResult> {
  const trimmed = domain.trim();
  if (!trimmed) {
    throw new Error("Domain is required");
  }

  const records: DnsRecord[] = [];

  for (const type of types) {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(trimmed)}&type=${type}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
      });
    } catch (e) {
      throw new Error(
        `Failed to fetch ${type} records for "${trimmed}": ${(e as Error).message}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `DNS query for ${type} records returned HTTP ${response.status}`
      );
    }

    let json: CloudflareResponse;
    try {
      json = (await response.json()) as CloudflareResponse;
    } catch (e) {
      throw new Error(
        `Failed to parse DNS response for ${type} records: ${(e as Error).message}`
      );
    }

    if (json.Answer) {
      for (const answer of json.Answer) {
        const mappedType = DNS_TYPE_MAP[answer.type];
        if (mappedType) {
          records.push({
            type: mappedType,
            name: answer.name,
            ttl: answer.TTL,
            data: answer.data,
          });
        }
      }
    }
  }

  return { domain: trimmed, records };
}

export function defaultTypes(): DnsRecordType[] {
  return ["A", "AAAA", "MX", "TXT", "CNAME"];
}
