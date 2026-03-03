const CDN_URL =
  "https://cdn.jsdelivr.net/npm/@ip-location-db/geolite2-country/geolite2-country-ipv4-num.csv";

// Parsed DB: sorted array of [startNum, endNum, countryCode]
let db: [number, number, string][] | null = null;

/** Fetch + parse the GeoIP database (one-time, ~1.5MB gzip) */
export async function loadGeoIpDb(): Promise<void> {
  if (db) return;
  const res = await fetch(CDN_URL);
  if (!res.ok) throw new Error(`GeoIP fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.split("\n");
  const entries: [number, number, string][] = [];
  for (const line of lines) {
    if (!line) continue;
    const comma1 = line.indexOf(",");
    const comma2 = line.indexOf(",", comma1 + 1);
    if (comma1 === -1 || comma2 === -1) continue;
    const start = Number(line.slice(0, comma1));
    const end = Number(line.slice(comma1 + 1, comma2));
    const cc = line.slice(comma2 + 1).trim();
    if (cc.length === 2) entries.push([start, end, cc]);
  }
  db = entries;
}

/** Convert dotted IPv4 "83.12.34.56" -> uint32 */
export function ipToNum(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const raw = parts[i];
    if (raw === "" || !/^\d{1,3}$/.test(raw)) return null;
    const octet = Number(raw);
    if (octet > 255) return null;
    num = (num * 256 + octet) >>> 0;
  }
  return num;
}

/** Binary search: find country for a numeric IP */
export function resolveIp(ip: string): string | null {
  if (!db) return null;
  const num = ipToNum(ip);
  if (num === null) return null;

  let lo = 0;
  let hi = db.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const [start, end, cc] = db[mid];
    if (num < start) {
      hi = mid - 1;
    } else if (num > end) {
      lo = mid + 1;
    } else {
      return cc;
    }
  }
  return null;
}

/** Resolve batch of unique IPs -> Map<ip, countryCode> */
export async function resolveIps(ips: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ips.length === 0) return result;

  try {
    await loadGeoIpDb();
  } catch {
    return result;
  }

  const unique = [...new Set(ips)];
  for (const ip of unique) {
    const cc = resolveIp(ip);
    if (cc) result.set(ip, cc);
  }
  return result;
}
