import { fetch } from "@tauri-apps/plugin-http";

export interface IpInfo {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  org: string;
  as: string;
  isp: string;
  timezone: string;
  query: string;
}

interface IpApiResponse {
  status: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
  timezone?: string;
}

const FIELDS =
  "status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,query,timezone";

export async function ipLookup(ipOrEmpty: string): Promise<IpInfo> {
  const trimmed = ipOrEmpty.trim().toLowerCase();
  const isSelf = trimmed === "" || trimmed === "my" || trimmed === "me";

  const url = isSelf
    ? `http://ip-api.com/json?fields=${FIELDS}`
    : `http://ip-api.com/json/${encodeURIComponent(ipOrEmpty.trim())}?fields=${FIELDS}`;

  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new Error(
      `Network error while contacting ip-api.com: ${(e as Error).message}`
    );
  }

  if (!response.ok) {
    throw new Error(`ip-api.com returned HTTP ${response.status}`);
  }

  let json: IpApiResponse;
  try {
    json = (await response.json()) as IpApiResponse;
  } catch (e) {
    throw new Error(
      `Failed to parse response from ip-api.com: ${(e as Error).message}`
    );
  }

  if (json.status !== "success") {
    throw new Error(json.message || "Lookup failed");
  }

  return {
    ip: json.query ?? "",
    country: json.country ?? "",
    countryCode: json.countryCode ?? "",
    region: json.regionName ?? "",
    city: json.city ?? "",
    lat: json.lat ?? 0,
    lon: json.lon ?? 0,
    org: json.org ?? "",
    as: json.as ?? "",
    isp: json.isp ?? "",
    timezone: json.timezone ?? "",
    query: json.query ?? "",
  };
}
