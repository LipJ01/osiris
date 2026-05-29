import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Sanctions Geography
 *
 * Pulls OpenSanctions' free static statistics aggregate — a consolidated
 * view of OFAC SDN + EU Consolidated + UK HMT + UN + national lists
 * combined into one dataset (~65K sanctioned targets across 200+ countries).
 *
 * Server-cached 24h. OpenSanctions runs its aggregation ~daily.
 *
 * Per-country breakdown of entity types (Person vs Vessel vs CryptoWallet)
 * requires per-country queries; we surface global schema totals instead.
 */

const URL = 'https://data.opensanctions.org/datasets/latest/sanctions/statistics.json';
const TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'sanctions-geo';

// ISO2 → centroid for the ~80 countries we expect to surface
const C: Record<string, { lat: number; lng: number; name: string }> = {
  AE: { lat: 23.42, lng:  53.85, name: 'UAE' },
  AF: { lat: 33.94, lng:  67.71, name: 'Afghanistan' },
  AL: { lat: 41.15, lng:  20.17, name: 'Albania' },
  AM: { lat: 40.07, lng:  45.04, name: 'Armenia' },
  AO: { lat: -11.20, lng: 17.87, name: 'Angola' },
  AR: { lat: -38.42, lng: -63.62, name: 'Argentina' },
  AT: { lat: 47.52, lng:  14.55, name: 'Austria' },
  AU: { lat: -25.27, lng: 133.78, name: 'Australia' },
  AZ: { lat: 40.14, lng:  47.58, name: 'Azerbaijan' },
  BA: { lat: 43.92, lng:  17.68, name: 'Bosnia and Herzegovina' },
  BD: { lat: 23.81, lng:  90.41, name: 'Bangladesh' },
  BE: { lat: 50.50, lng:   4.47, name: 'Belgium' },
  BG: { lat: 42.73, lng:  25.49, name: 'Bulgaria' },
  BH: { lat: 26.07, lng:  50.55, name: 'Bahrain' },
  BO: { lat: -16.29, lng: -63.59, name: 'Bolivia' },
  BR: { lat: -14.24, lng: -51.93, name: 'Brazil' },
  BY: { lat: 53.71, lng:  27.95, name: 'Belarus' },
  CA: { lat: 56.13, lng: -106.35, name: 'Canada' },
  CD: { lat: -4.04, lng:  21.76, name: 'DR Congo' },
  CF: { lat:  6.61, lng:  20.94, name: 'Central African Republic' },
  CH: { lat: 46.82, lng:   8.23, name: 'Switzerland' },
  CI: { lat:  7.54, lng:  -5.55, name: "Côte d'Ivoire" },
  CL: { lat: -35.68, lng: -71.54, name: 'Chile' },
  CM: { lat:  7.37, lng:  12.35, name: 'Cameroon' },
  CN: { lat: 35.86, lng: 104.20, name: 'China' },
  CO: { lat:  4.57, lng: -74.30, name: 'Colombia' },
  CR: { lat:  9.93, lng: -84.08, name: 'Costa Rica' },
  CU: { lat: 21.52, lng: -77.78, name: 'Cuba' },
  CY: { lat: 35.13, lng:  33.43, name: 'Cyprus' },
  CZ: { lat: 49.82, lng:  15.47, name: 'Czechia' },
  DE: { lat: 51.17, lng:  10.45, name: 'Germany' },
  DK: { lat: 56.26, lng:   9.50, name: 'Denmark' },
  DO: { lat: 18.74, lng: -70.16, name: 'Dominican Republic' },
  DZ: { lat: 28.03, lng:   1.66, name: 'Algeria' },
  EC: { lat: -1.83, lng: -78.18, name: 'Ecuador' },
  EE: { lat: 58.60, lng:  25.01, name: 'Estonia' },
  EG: { lat: 26.82, lng:  30.80, name: 'Egypt' },
  ER: { lat: 15.18, lng:  39.78, name: 'Eritrea' },
  ES: { lat: 40.46, lng:  -3.75, name: 'Spain' },
  ET: { lat:  9.15, lng:  40.49, name: 'Ethiopia' },
  FI: { lat: 61.92, lng:  25.75, name: 'Finland' },
  FR: { lat: 46.23, lng:   2.21, name: 'France' },
  GB: { lat: 55.38, lng:  -3.44, name: 'United Kingdom' },
  GE: { lat: 42.32, lng:  43.36, name: 'Georgia' },
  GH: { lat:  7.95, lng:  -1.02, name: 'Ghana' },
  GR: { lat: 39.07, lng:  21.82, name: 'Greece' },
  GT: { lat: 15.78, lng: -90.23, name: 'Guatemala' },
  HK: { lat: 22.30, lng: 114.17, name: 'Hong Kong' },
  HN: { lat: 15.20, lng: -86.24, name: 'Honduras' },
  HR: { lat: 45.10, lng:  15.20, name: 'Croatia' },
  HT: { lat: 18.97, lng: -72.29, name: 'Haiti' },
  HU: { lat: 47.16, lng:  19.50, name: 'Hungary' },
  ID: { lat: -0.79, lng: 113.92, name: 'Indonesia' },
  IE: { lat: 53.41, lng:  -8.24, name: 'Ireland' },
  IL: { lat: 31.05, lng:  34.85, name: 'Israel' },
  IN: { lat: 20.59, lng:  78.96, name: 'India' },
  IQ: { lat: 33.22, lng:  43.68, name: 'Iraq' },
  IR: { lat: 32.43, lng:  53.69, name: 'Iran' },
  IT: { lat: 41.87, lng:  12.57, name: 'Italy' },
  JO: { lat: 30.59, lng:  36.24, name: 'Jordan' },
  JP: { lat: 36.20, lng: 138.25, name: 'Japan' },
  KE: { lat: -0.02, lng:  37.91, name: 'Kenya' },
  KG: { lat: 41.20, lng:  74.77, name: 'Kyrgyzstan' },
  KH: { lat: 12.57, lng: 104.99, name: 'Cambodia' },
  KP: { lat: 40.34, lng: 127.51, name: 'North Korea' },
  KR: { lat: 35.91, lng: 127.77, name: 'South Korea' },
  KW: { lat: 29.31, lng:  47.48, name: 'Kuwait' },
  KZ: { lat: 48.02, lng:  66.92, name: 'Kazakhstan' },
  LA: { lat: 19.86, lng: 102.50, name: 'Laos' },
  LB: { lat: 33.85, lng:  35.86, name: 'Lebanon' },
  LR: { lat:  6.43, lng:  -9.43, name: 'Liberia' },
  LT: { lat: 55.17, lng:  23.88, name: 'Lithuania' },
  LU: { lat: 49.82, lng:   6.13, name: 'Luxembourg' },
  LV: { lat: 56.88, lng:  24.60, name: 'Latvia' },
  LY: { lat: 26.34, lng:  17.23, name: 'Libya' },
  MA: { lat: 31.79, lng:  -7.09, name: 'Morocco' },
  MD: { lat: 47.00, lng:  28.50, name: 'Moldova' },
  ME: { lat: 42.71, lng:  19.37, name: 'Montenegro' },
  MK: { lat: 41.61, lng:  21.75, name: 'North Macedonia' },
  ML: { lat: 17.57, lng:  -3.99, name: 'Mali' },
  MM: { lat: 21.91, lng:  95.96, name: 'Myanmar' },
  MN: { lat: 46.86, lng: 103.85, name: 'Mongolia' },
  MT: { lat: 35.94, lng:  14.38, name: 'Malta' },
  MX: { lat: 23.63, lng: -102.55, name: 'Mexico' },
  MY: { lat: 4.21,  lng: 101.98, name: 'Malaysia' },
  MZ: { lat: -18.67, lng: 35.53, name: 'Mozambique' },
  NE: { lat: 17.61, lng:   8.08, name: 'Niger' },
  NG: { lat:  9.08, lng:   8.68, name: 'Nigeria' },
  NI: { lat: 12.87, lng: -85.21, name: 'Nicaragua' },
  NL: { lat: 52.13, lng:   5.29, name: 'Netherlands' },
  NO: { lat: 60.47, lng:   8.47, name: 'Norway' },
  NP: { lat: 28.39, lng:  84.12, name: 'Nepal' },
  NZ: { lat: -40.90, lng: 174.89, name: 'New Zealand' },
  OM: { lat: 21.51, lng:  55.92, name: 'Oman' },
  PA: { lat:  8.54, lng: -80.78, name: 'Panama' },
  PE: { lat:  -9.19, lng: -75.02, name: 'Peru' },
  PH: { lat: 12.88, lng: 121.77, name: 'Philippines' },
  PK: { lat: 30.38, lng:  69.35, name: 'Pakistan' },
  PL: { lat: 51.92, lng:  19.15, name: 'Poland' },
  PT: { lat: 39.40, lng:  -8.22, name: 'Portugal' },
  PY: { lat: -23.44, lng: -58.44, name: 'Paraguay' },
  QA: { lat: 25.35, lng:  51.18, name: 'Qatar' },
  RO: { lat: 45.94, lng:  24.97, name: 'Romania' },
  RS: { lat: 44.02, lng:  21.01, name: 'Serbia' },
  RU: { lat: 61.52, lng: 105.32, name: 'Russia' },
  RW: { lat:  -1.94, lng: 29.87, name: 'Rwanda' },
  SA: { lat: 23.89, lng:  45.08, name: 'Saudi Arabia' },
  SD: { lat: 12.86, lng:  30.22, name: 'Sudan' },
  SE: { lat: 60.13, lng:  18.64, name: 'Sweden' },
  SG: { lat:  1.35, lng: 103.82, name: 'Singapore' },
  SI: { lat: 46.15, lng:  14.99, name: 'Slovenia' },
  SK: { lat: 48.67, lng:  19.70, name: 'Slovakia' },
  SL: { lat:  8.46, lng: -11.78, name: 'Sierra Leone' },
  SN: { lat: 14.50, lng: -14.45, name: 'Senegal' },
  SO: { lat:  5.15, lng:  46.20, name: 'Somalia' },
  SS: { lat:  6.88, lng:  31.31, name: 'South Sudan' },
  SY: { lat: 34.80, lng:  38.99, name: 'Syria' },
  TG: { lat:  8.62, lng:   0.82, name: 'Togo' },
  TH: { lat: 15.87, lng: 100.99, name: 'Thailand' },
  TJ: { lat: 38.86, lng:  71.28, name: 'Tajikistan' },
  TM: { lat: 38.97, lng:  59.56, name: 'Turkmenistan' },
  TN: { lat: 33.89, lng:   9.54, name: 'Tunisia' },
  TR: { lat: 38.96, lng:  35.24, name: 'Türkiye' },
  TW: { lat: 23.70, lng: 121.00, name: 'Taiwan' },
  TZ: { lat: -6.37, lng:  34.89, name: 'Tanzania' },
  UA: { lat: 48.38, lng:  31.17, name: 'Ukraine' },
  UG: { lat:  1.37, lng:  32.29, name: 'Uganda' },
  US: { lat: 39.83, lng: -98.58, name: 'United States' },
  UY: { lat: -32.52, lng: -55.77, name: 'Uruguay' },
  UZ: { lat: 41.38, lng:  64.59, name: 'Uzbekistan' },
  VE: { lat:  6.42, lng: -66.59, name: 'Venezuela' },
  VN: { lat: 14.06, lng: 108.28, name: 'Vietnam' },
  YE: { lat: 15.55, lng:  48.52, name: 'Yemen' },
  ZA: { lat: -30.56, lng: 22.94, name: 'South Africa' },
  ZM: { lat: -13.13, lng: 27.85, name: 'Zambia' },
  ZW: { lat: -19.02, lng: 29.15, name: 'Zimbabwe' },
  HN_DUMMY: { lat: 0, lng: 0, name: '' }, // placeholder
};

interface SanctionedCountry {
  iso: string;
  name: string;
  lat: number;
  lng: number;
  target_count: number;        // sanctioned targets per OpenSanctions
  thing_count: number;         // total entities mentioned in OpenSanctions
  severity: 'critical' | 'major' | 'moderate' | 'minor';
}

interface SchemaTotal { name: string; label: string; count: number; }

interface Payload {
  countries: SanctionedCountry[];
  total_targets: number;
  total_things: number;
  total_countries: number;
  schema_totals: SchemaTotal[];
  last_change: string | null;
  built_at: string;
}

function severityOf(n: number): SanctionedCountry['severity'] {
  if (n >= 1000) return 'critical';
  if (n >= 200) return 'major';
  if (n >= 50) return 'moderate';
  return 'minor';
}

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  }
  try {
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(30000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`OpenSanctions ${res.status}`);
    const json = await res.json();

    const targetCountries: any[] = json?.targets?.countries || [];
    const thingCountries: any[] = json?.things?.countries || [];
    const thingMap = new Map(thingCountries.map((t: any) => [t.code, t.count]));

    const countries: SanctionedCountry[] = [];
    for (const tc of targetCountries) {
      const iso = (tc.code || '').toUpperCase();
      const centroid = C[iso];
      if (!centroid) continue;            // skip codes we have no centroid for
      if (tc.count < 10) continue;         // hide noise tail
      countries.push({
        iso, name: centroid.name, lat: centroid.lat, lng: centroid.lng,
        target_count: tc.count,
        thing_count: thingMap.get(tc.code) || tc.count,
        severity: severityOf(tc.count),
      });
    }
    countries.sort((a, b) => b.target_count - a.target_count);

    const schemaTotals: SchemaTotal[] = (json?.targets?.schemata || []).map((s: any) => ({
      name: s.name, label: s.plural || s.label || s.name, count: s.count,
    }));

    const payload: Payload = {
      countries,
      total_targets: json?.targets?.total || 0,
      total_things: json?.things?.total || 0,
      total_countries: countries.length,
      schema_totals: schemaTotals,
      last_change: json?.last_change || null,
      built_at: new Date().toISOString(),
    };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
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
      { error: 'Failed to fetch OpenSanctions data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
