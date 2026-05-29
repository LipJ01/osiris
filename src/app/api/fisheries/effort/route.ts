import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Fishing Effort by major commercial zone
 *
 * Calls Global Fishing Watch's `/v3/4wings/report` for each curated zone,
 * aggregating last-30-days vessel-hours by gear type. Cached server-side for
 * 6 hours — fishing effort doesn't shift hour-to-hour, and GFW's free tier is
 * 50k requests/day → ~18 zones × 4 refreshes/day = ~72 calls. Plenty of slack.
 *
 * Returns a flat list of zones with totals + dominant gear, ready for the map.
 */

interface Zone {
  id: string;
  name: string;
  region: string;       // human-readable parent region
  // Centroid for the map marker (not used for the GFW query; that uses bbox).
  lat: number;
  lng: number;
  // Bounding box: [west, south, east, north]
  bbox: [number, number, number, number];
}

const ZONES: Zone[] = [
  // ── North Atlantic ──
  { id: 'gulf-of-maine',   name: 'Gulf of Maine / Georges Bank', region: 'North Atlantic',     lat: 42.5,  lng: -68,    bbox: [-71, 40, -65, 45] },
  { id: 'grand-banks',     name: 'Grand Banks',                  region: 'North Atlantic',     lat: 46,    lng: -50,    bbox: [-55, 42, -45, 50] },
  { id: 'north-sea',       name: 'North Sea',                    region: 'NE Atlantic',        lat: 56,    lng: 3,      bbox: [-2, 51, 8, 60] },
  { id: 'barents-sea',     name: 'Barents Sea',                  region: 'Arctic',             lat: 74,    lng: 32,     bbox: [15, 70, 50, 78] },
  { id: 'bay-of-biscay',   name: 'Bay of Biscay',                region: 'NE Atlantic',        lat: 45.5,  lng: -5,     bbox: [-10, 43, -1, 48] },
  { id: 'iceland-shelf',   name: 'Icelandic Shelf',              region: 'NE Atlantic',        lat: 65,    lng: -20,    bbox: [-28, 62, -12, 68] },

  // ── Mediterranean ──
  { id: 'western-med',     name: 'Western Mediterranean',        region: 'Mediterranean',      lat: 40,    lng: 5,      bbox: [-2, 35, 12, 44] },
  { id: 'adriatic',        name: 'Adriatic Sea',                 region: 'Mediterranean',      lat: 43,    lng: 15,     bbox: [12, 40, 19, 46] },

  // ── Africa ──
  { id: 'nw-africa-shelf', name: 'NW African Shelf',             region: 'E Atlantic',         lat: 21,    lng: -17,    bbox: [-20, 14, -10, 28] },
  { id: 'gulf-of-guinea',  name: 'Gulf of Guinea',               region: 'E Atlantic',         lat: 2,     lng: 1,      bbox: [-8, -3, 8, 6] },

  // ── South America ──
  { id: 'patagonian-shelf', name: 'Patagonian Shelf',            region: 'SW Atlantic',        lat: -46,   lng: -62,    bbox: [-68, -55, -55, -38] },
  { id: 'peruvian-upwell', name: 'Peruvian Upwelling',           region: 'SE Pacific',         lat: -11,   lng: -80,    bbox: [-84, -20, -75, -3] },

  // ── North Pacific ──
  { id: 'california-curr', name: 'California Current',           region: 'NE Pacific',         lat: 38,    lng: -125,   bbox: [-130, 30, -118, 48] },
  { id: 'bering-sea',      name: 'Bering Sea',                   region: 'N Pacific',          lat: 58,    lng: -175,   bbox: [-180, 53, -160, 65] },
  { id: 'sea-of-okhotsk',  name: 'Sea of Okhotsk',               region: 'NW Pacific',         lat: 53,    lng: 150,    bbox: [140, 45, 160, 60] },
  { id: 'sea-of-japan',    name: 'Sea of Japan',                 region: 'NW Pacific',         lat: 40,    lng: 135,    bbox: [128, 33, 142, 48] },
  { id: 'yellow-sea',      name: 'Yellow Sea',                   region: 'NW Pacific',         lat: 36,    lng: 123,    bbox: [119, 32, 126, 41] },
  { id: 'east-china-sea',  name: 'East China Sea',               region: 'NW Pacific',         lat: 28,    lng: 124,    bbox: [120, 23, 130, 33] },

  // ── Indian Ocean / SE Asia ──
  { id: 'south-china-sea', name: 'South China Sea',              region: 'SW Pacific',         lat: 13,    lng: 114,    bbox: [108, 5, 120, 22] },
  { id: 'arabian-sea',     name: 'Arabian Sea',                  region: 'NW Indian Ocean',    lat: 15,    lng: 63,     bbox: [50, 5, 75, 25] },
  { id: 'bay-of-bengal',   name: 'Bay of Bengal',                region: 'NE Indian Ocean',    lat: 15,    lng: 88,     bbox: [80, 8, 95, 22] },
];

interface ZoneEffort {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  total_hours: number;
  total_vessels: number;
  top_gears: { gear: string; hours: number; vessels: number }[];
  error?: string;
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_KEY = 'fisheries-effort';
interface CachedPayload { zones: ZoneEffort[]; date_range: string; }

function lastFullMonthRange(): string {
  // Pick the most-recently-completed month so the dataset is reliably populated.
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endStr = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
  const startStr = start.toISOString().slice(0, 10);
  return `${startStr},${endStr}`;
}

function bboxToFeatureCollection(bbox: [number, number, number, number]) {
  const [w, s, e, n] = bbox;
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    }],
  };
}

async function fetchZone(zone: Zone, dateRange: string, token: string): Promise<ZoneEffort> {
  const params = new URLSearchParams();
  params.set('spatial-resolution', 'LOW');
  params.set('temporal-resolution', 'ENTIRE');
  params.set('datasets[0]', 'public-global-fishing-effort:latest');
  params.set('date-range', dateRange);
  params.set('format', 'JSON');
  params.set('group-by', 'GEARTYPE');
  params.set('spatial-aggregation', 'true');
  const url = `https://gateway.api.globalfishingwatch.org/v3/4wings/report?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ geojson: bboxToFeatureCollection(zone.bbox) }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        id: zone.id, name: zone.name, region: zone.region, lat: zone.lat, lng: zone.lng,
        total_hours: 0, total_vessels: 0, top_gears: [],
        error: `GFW ${res.status}: ${text.slice(0, 120)}`,
      };
    }
    const json = await res.json();
    // Shape: { entries: [{ "public-global-fishing-effort:vN.0": [{geartype, hours, vesselIDs, ...}, ...] }] }
    const dsKey = Object.keys(json.entries?.[0] || {})[0];
    const rows: any[] = dsKey ? json.entries[0][dsKey] : [];
    const total_hours = rows.reduce((a, r) => a + (r.hours || 0), 0);
    const total_vessels = rows.reduce((a, r) => a + (r.vesselIDs || 0), 0);
    const top_gears = rows
      .map((r: any) => ({ gear: String(r.geartype || 'unknown'), hours: r.hours || 0, vessels: r.vesselIDs || 0 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
    return {
      id: zone.id, name: zone.name, region: zone.region, lat: zone.lat, lng: zone.lng,
      total_hours, total_vessels, top_gears,
    };
  } catch (e) {
    return {
      id: zone.id, name: zone.name, region: zone.region, lat: zone.lat, lng: zone.lng,
      total_hours: 0, total_vessels: 0, top_gears: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const token = process.env.GFW_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GFW_API_TOKEN missing. Set it in ~/lab/osiris/.env.local then restart the server.' },
      { status: 500 },
    );
  }

  // Fresh disk cache hit — return immediately.
  const fresh = await cacheRead<CachedPayload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
    );
  }

  const dateRange = lastFullMonthRange();
  // Batches of 3 — GFW returns 429 on larger concurrent bursts, but pure
  // serial is too slow (~30s+). 3-wide gets us to ~7s cold.
  const zones: ZoneEffort[] = [];
  const BATCH = 3;
  for (let i = 0; i < ZONES.length; i += BATCH) {
    const batch = ZONES.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(z => fetchZone(z, dateRange, token)));
    zones.push(...results);
    if (i + BATCH < ZONES.length) await new Promise(r => setTimeout(r, 200));
  }

  // If most zones errored (e.g. rate-limit hit mid-fetch), serve stale rather
  // than poison the cache with mostly-empty data.
  const errored = zones.filter(z => z.error).length;
  if (errored > zones.length / 2) {
    const stale = await cacheReadStale<CachedPayload>(CACHE_KEY);
    if (stale) {
      return NextResponse.json(
        { ...stale.data, cached: true, stale: true, age_seconds: Math.floor(stale.age_ms / 1000), error_count: errored },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      );
    }
  }

  const payload: CachedPayload = { zones, date_range: dateRange };
  await cacheWrite(CACHE_KEY, payload);

  return NextResponse.json(
    { ...payload, cached: false, error_count: errored },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
  );
}
