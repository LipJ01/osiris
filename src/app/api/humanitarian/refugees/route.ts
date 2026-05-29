import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Refugee / Displacement Flows (UNHCR)
 *
 * Pulls UNHCR's population endpoint for the latest annual snapshot, filters
 * to cross-border refugee corridors above a meaningful threshold, and
 * resolves origin + asylum country codes to centroids for arc rendering.
 *
 * Cached 7 days — UNHCR statistics update annually with mid-year revisions.
 */

const URL_BASE = 'https://api.unhcr.org/population/v1/population/';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'unhcr-refugees';
const YEAR = 2024;            // last fully-reported UNHCR statistical year
const MIN_REFUGEES = 100000;  // threshold for a corridor to surface on the map

// UNHCR uses adapted M49 codes that aren't always standard ISO3 — keep a
// dedicated centroid lookup keyed on the codes UNHCR actually returns.
const C: Record<string, { lat: number; lng: number; name: string }> = {
  AFG: { lat: 33.94, lng:  67.71, name: 'Afghanistan' },
  ALB: { lat: 41.15, lng:  20.17, name: 'Albania' },
  ARE: { lat: 23.42, lng:  53.85, name: 'UAE' },
  ARG: { lat: -38.42, lng: -63.62, name: 'Argentina' },
  AUS: { lat: -25.27, lng: 133.78, name: 'Australia' },
  AUT: { lat: 47.52, lng:  14.55, name: 'Austria' },
  AZE: { lat: 40.14, lng:  47.58, name: 'Azerbaijan' },
  BDI: { lat: -3.37, lng:  29.92, name: 'Burundi' },
  BEL: { lat: 50.50, lng:   4.47, name: 'Belgium' },
  BFA: { lat: 12.24, lng:  -1.56, name: 'Burkina Faso' },
  BGD: { lat: 23.81, lng:  90.41, name: 'Bangladesh' },
  BGR: { lat: 42.73, lng:  25.49, name: 'Bulgaria' },
  BLR: { lat: 53.71, lng:  27.95, name: 'Belarus' },
  BOL: { lat: -16.29, lng: -63.59, name: 'Bolivia' },
  BRA: { lat: -14.24, lng: -51.93, name: 'Brazil' },
  CAF: { lat: 6.61, lng:  20.94, name: 'Central African Republic' },
  CAN: { lat: 56.13, lng: -106.35, name: 'Canada' },
  CHD: { lat: 15.45, lng:  18.73, name: 'Chad' },
  TCD: { lat: 15.45, lng:  18.73, name: 'Chad' },
  CHE: { lat: 46.82, lng:   8.23, name: 'Switzerland' },
  CHL: { lat: -35.68, lng: -71.54, name: 'Chile' },
  CHN: { lat: 35.86, lng: 104.20, name: 'China' },
  CIV: { lat: 7.54, lng:  -5.55, name: "Côte d'Ivoire" },
  CMR: { lat: 7.37, lng:  12.35, name: 'Cameroon' },
  COB: { lat: -0.23, lng:  15.83, name: 'Congo (Brazzaville)' },
  COD: { lat: -4.04, lng:  21.76, name: 'DR Congo' },
  COL: { lat: 4.57, lng: -74.30, name: 'Colombia' },
  CRI: { lat: 9.75, lng: -83.75, name: 'Costa Rica' },
  CUB: { lat: 21.52, lng: -77.78, name: 'Cuba' },
  CYP: { lat: 35.13, lng:  33.43, name: 'Cyprus' },
  CZE: { lat: 49.82, lng:  15.47, name: 'Czechia' },
  DEU: { lat: 51.17, lng:  10.45, name: 'Germany' },
  GFR: { lat: 51.17, lng:  10.45, name: 'Germany' },  // UNHCR uses GFR for FR Germany
  DJI: { lat: 11.83, lng:  42.59, name: 'Djibouti' },
  DNK: { lat: 56.26, lng:   9.50, name: 'Denmark' },
  DOM: { lat: 18.74, lng: -70.16, name: 'Dominican Republic' },
  ECU: { lat: -1.83, lng: -78.18, name: 'Ecuador' },
  EGY: { lat: 26.82, lng:  30.80, name: 'Egypt' },
  ERI: { lat: 15.18, lng:  39.78, name: 'Eritrea' },
  ESP: { lat: 40.46, lng:  -3.75, name: 'Spain' },
  EST: { lat: 58.60, lng:  25.01, name: 'Estonia' },
  ETH: { lat: 9.15, lng:  40.49, name: 'Ethiopia' },
  FIN: { lat: 61.92, lng:  25.75, name: 'Finland' },
  FRA: { lat: 46.23, lng:   2.21, name: 'France' },
  GBR: { lat: 55.38, lng:  -3.44, name: 'United Kingdom' },
  GEO: { lat: 42.32, lng:  43.36, name: 'Georgia' },
  GHA: { lat: 7.95, lng:  -1.02, name: 'Ghana' },
  GIN: { lat: 9.95, lng: -10.94, name: 'Guinea' },
  GRC: { lat: 39.07, lng:  21.82, name: 'Greece' },
  GTM: { lat: 15.78, lng: -90.23, name: 'Guatemala' },
  HND: { lat: 15.20, lng: -86.24, name: 'Honduras' },
  HRV: { lat: 45.10, lng:  15.20, name: 'Croatia' },
  HTI: { lat: 18.97, lng: -72.29, name: 'Haiti' },
  HUN: { lat: 47.16, lng:  19.50, name: 'Hungary' },
  IDN: { lat: -0.79, lng: 113.92, name: 'Indonesia' },
  IND: { lat: 20.59, lng:  78.96, name: 'India' },
  IRL: { lat: 53.41, lng:  -8.24, name: 'Ireland' },
  IRN: { lat: 32.43, lng:  53.69, name: 'Iran' },
  IRQ: { lat: 33.22, lng:  43.68, name: 'Iraq' },
  ISR: { lat: 31.05, lng:  34.85, name: 'Israel' },
  ITA: { lat: 41.87, lng:  12.57, name: 'Italy' },
  JOR: { lat: 30.59, lng:  36.24, name: 'Jordan' },
  JPN: { lat: 36.20, lng: 138.25, name: 'Japan' },
  KAZ: { lat: 48.02, lng:  66.92, name: 'Kazakhstan' },
  KEN: { lat: -0.02, lng:  37.91, name: 'Kenya' },
  KGZ: { lat: 41.20, lng:  74.77, name: 'Kyrgyzstan' },
  KHM: { lat: 12.57, lng: 104.99, name: 'Cambodia' },
  KOR: { lat: 35.91, lng: 127.77, name: 'South Korea' },
  LAO: { lat: 19.86, lng: 102.50, name: 'Laos' },
  LBN: { lat: 33.85, lng:  35.86, name: 'Lebanon' },
  LBR: { lat: 6.43, lng:  -9.43, name: 'Liberia' },
  LBY: { lat: 26.34, lng:  17.23, name: 'Libya' },
  LKA: { lat: 7.87, lng:  80.77, name: 'Sri Lanka' },
  LTU: { lat: 55.17, lng:  23.88, name: 'Lithuania' },
  LVA: { lat: 56.88, lng:  24.60, name: 'Latvia' },
  MAR: { lat: 31.79, lng:  -7.09, name: 'Morocco' },
  MDA: { lat: 47.00, lng:  28.50, name: 'Moldova' },
  MEX: { lat: 23.63, lng: -102.55, name: 'Mexico' },
  MLI: { lat: 17.57, lng:  -3.99, name: 'Mali' },
  MMR: { lat: 21.91, lng:  95.96, name: 'Myanmar' },
  MYA: { lat: 21.91, lng:  95.96, name: 'Myanmar' },  // UNHCR alt
  MNG: { lat: 46.86, lng: 103.85, name: 'Mongolia' },
  MOZ: { lat: -18.67, lng: 35.53, name: 'Mozambique' },
  MRT: { lat: 21.01, lng: -10.94, name: 'Mauritania' },
  MWI: { lat: -13.25, lng: 34.30, name: 'Malawi' },
  MYS: { lat: 4.21, lng: 101.98, name: 'Malaysia' },
  NER: { lat: 17.61, lng:   8.08, name: 'Niger' },
  NGA: { lat: 9.08, lng:   8.68, name: 'Nigeria' },
  NIC: { lat: 12.87, lng: -85.21, name: 'Nicaragua' },
  NLD: { lat: 52.13, lng:   5.29, name: 'Netherlands' },
  NOR: { lat: 60.47, lng:   8.47, name: 'Norway' },
  NPL: { lat: 28.39, lng:  84.12, name: 'Nepal' },
  PAK: { lat: 30.38, lng:  69.35, name: 'Pakistan' },
  PAN: { lat: 8.54, lng: -80.78, name: 'Panama' },
  PER: { lat: -9.19, lng: -75.02, name: 'Peru' },
  PHL: { lat: 12.88, lng: 121.77, name: 'Philippines' },
  POL: { lat: 51.92, lng:  19.15, name: 'Poland' },
  PRT: { lat: 39.40, lng:  -8.22, name: 'Portugal' },
  PSE: { lat: 31.95, lng:  35.23, name: 'Palestine' },
  ROU: { lat: 45.94, lng:  24.97, name: 'Romania' },
  RUS: { lat: 61.52, lng: 105.32, name: 'Russia' },
  RWA: { lat: -1.94, lng:  29.87, name: 'Rwanda' },
  SAU: { lat: 23.89, lng:  45.08, name: 'Saudi Arabia' },
  SDN: { lat: 12.86, lng:  30.22, name: 'Sudan' },
  SUD: { lat: 12.86, lng:  30.22, name: 'Sudan' },
  SEN: { lat: 14.50, lng: -14.45, name: 'Senegal' },
  SLE: { lat: 8.46, lng: -11.78, name: 'Sierra Leone' },
  SOM: { lat: 5.15, lng:  46.20, name: 'Somalia' },
  SRB: { lat: 44.02, lng:  21.01, name: 'Serbia' },
  SSD: { lat: 6.88, lng:  31.31, name: 'South Sudan' },
  SVK: { lat: 48.67, lng:  19.70, name: 'Slovakia' },
  SVN: { lat: 46.15, lng:  14.99, name: 'Slovenia' },
  SWE: { lat: 60.13, lng:  18.64, name: 'Sweden' },
  SYR: { lat: 34.80, lng:  38.99, name: 'Syria' },
  TGO: { lat: 8.62, lng:   0.82, name: 'Togo' },
  THA: { lat: 15.87, lng: 100.99, name: 'Thailand' },
  TJK: { lat: 38.86, lng:  71.28, name: 'Tajikistan' },
  TKM: { lat: 38.97, lng:  59.56, name: 'Turkmenistan' },
  TUN: { lat: 33.89, lng:   9.54, name: 'Tunisia' },
  TUR: { lat: 38.96, lng:  35.24, name: 'Türkiye' },
  TZA: { lat: -6.37, lng:  34.89, name: 'Tanzania' },
  UGA: { lat: 1.37, lng:  32.29, name: 'Uganda' },
  UKR: { lat: 48.38, lng:  31.17, name: 'Ukraine' },
  USA: { lat: 39.83, lng: -98.58, name: 'United States' },
  UZB: { lat: 41.38, lng:  64.59, name: 'Uzbekistan' },
  VEN: { lat: 6.42, lng: -66.59, name: 'Venezuela' },
  VNM: { lat: 14.06, lng: 108.28, name: 'Vietnam' },
  YEM: { lat: 15.55, lng:  48.52, name: 'Yemen' },
  ZAF: { lat: -30.56, lng: 22.94, name: 'South Africa' },
  ZMB: { lat: -13.13, lng: 27.85, name: 'Zambia' },
  ZWE: { lat: -19.02, lng: 29.15, name: 'Zimbabwe' },
};

interface Corridor {
  origin: string; origin_name: string; origin_lat: number; origin_lng: number;
  asylum: string; asylum_name: string; asylum_lat: number; asylum_lng: number;
  refugees: number;
}

interface AsylumMarker {
  iso: string; name: string; lat: number; lng: number;
  total_refugees: number;
  origin_count: number;
  origins: { iso: string; name: string; refugees: number }[];
}

interface Payload { year: number; corridors: Corridor[]; asylum_markers: AsylumMarker[]; total_refugees: number; threshold: number; built_at: string; }

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=604800' } },
    );
  }
  try {
    const u = new URL(URL_BASE);
    u.searchParams.set('yearFrom', String(YEAR));
    u.searchParams.set('yearTo', String(YEAR));
    u.searchParams.set('coo_all', 'true');
    u.searchParams.set('coa_all', 'true');
    u.searchParams.set('limit', '10000');
    const res = await fetch(u.toString(), {
      signal: AbortSignal.timeout(30000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`UNHCR ${res.status}`);
    const json = await res.json();
    const items: any[] = Array.isArray(json.items) ? json.items : [];

    // Filter to cross-border corridors above threshold
    const corridors: Corridor[] = [];
    for (const it of items) {
      const refugees = parseInt(it.refugees) || 0;
      if (refugees < MIN_REFUGEES) continue;
      if (it.coo_iso === it.coa_iso) continue;
      const origin = C[it.coo];
      const asylum = C[it.coa];
      if (!origin || !asylum) continue;
      corridors.push({
        origin: it.coo, origin_name: origin.name, origin_lat: origin.lat, origin_lng: origin.lng,
        asylum: it.coa, asylum_name: asylum.name, asylum_lat: asylum.lat, asylum_lng: asylum.lng,
        refugees,
      });
    }
    corridors.sort((a, b) => b.refugees - a.refugees);
    // Keep top 60 corridors so the map doesn't become spaghetti
    const top = corridors.slice(0, 60);

    // Asylum-side aggregation — one marker per receiving country
    const byAsylum = new Map<string, AsylumMarker>();
    for (const c of top) {
      if (!byAsylum.has(c.asylum)) {
        byAsylum.set(c.asylum, {
          iso: c.asylum, name: c.asylum_name, lat: c.asylum_lat, lng: c.asylum_lng,
          total_refugees: 0, origin_count: 0, origins: [],
        });
      }
      const m = byAsylum.get(c.asylum)!;
      m.total_refugees += c.refugees;
      m.origin_count++;
      m.origins.push({ iso: c.origin, name: c.origin_name, refugees: c.refugees });
    }
    for (const m of byAsylum.values()) m.origins.sort((a, b) => b.refugees - a.refugees);
    const asylum_markers = [...byAsylum.values()].sort((a, b) => b.total_refugees - a.total_refugees);

    const total = top.reduce((a, c) => a + c.refugees, 0);
    const payload: Payload = { year: YEAR, corridors: top, asylum_markers, total_refugees: total, threshold: MIN_REFUGEES, built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=604800' } },
    );
  } catch (e) {
    const stale = await cacheReadStale<Payload>(CACHE_KEY);
    if (stale) {
      return NextResponse.json(
        { ...stale.data, cached: true, stale: true, age_seconds: Math.floor(stale.age_ms / 1000) },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch UNHCR data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
