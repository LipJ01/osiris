import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Commercial Landings (NOAA FOSS)
 *
 * Aggregates a year of NOAA Fisheries One Stop Shop commercial landings into
 * one marker per landing state, with top-species breakdown for the popup.
 *
 * No API key. Latest complete year (2024) is ~3,000 records → one ~1 MB fetch
 * → aggregated → cached in SQLite for 24h. Annual data; no need to refresh
 * often, but a daily TTL means a fresh deploy picks up corrections quickly.
 */

const FOSS_URL = (year: number, limit: number, offset: number) =>
  `https://apps-st.fisheries.noaa.gov/ods/foss/landings/?q=${encodeURIComponent(JSON.stringify({ year, collection: 'Commercial' }))}&offset=${offset}&limit=${limit}`;

const LANDING_YEAR = 2024;
const TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = `landings-${LANDING_YEAR}`;

// State landing centroids — placed on the coast / port area rather than the
// geographic centroid so the marker reads correctly against the map.
// FOSS uses "FLORIDA-EAST" / "FLORIDA-WEST" for the two Florida coasts.
const STATE_COORDS: Record<string, { lat: number; lng: number; region: string }> = {
  ALASKA:          { lat: 57.79,  lng: -152.40, region: 'Pacific' },     // Kodiak
  MAINE:           { lat: 43.66,  lng:  -70.26, region: 'NE Atlantic' }, // Portland
  MASSACHUSETTS:   { lat: 41.64,  lng:  -70.93, region: 'NE Atlantic' }, // New Bedford
  LOUISIANA:       { lat: 29.46,  lng:  -91.41, region: 'Gulf' },        // Morgan City
  WASHINGTON:      { lat: 47.95,  lng: -124.62, region: 'Pacific' },     // Westport / Neah Bay area
  'FLORIDA-WEST':  { lat: 26.65,  lng:  -82.04, region: 'Gulf' },        // Fort Myers area
  'FLORIDA-EAST':  { lat: 27.93,  lng:  -80.32, region: 'S Atlantic' },  // Cape Canaveral area
  VIRGINIA:        { lat: 36.96,  lng:  -76.43, region: 'M Atlantic' },  // Newport News (menhaden)
  OREGON:          { lat: 45.21,  lng: -123.96, region: 'Pacific' },     // Tillamook / coast
  CALIFORNIA:      { lat: 37.81,  lng: -122.42, region: 'Pacific' },     // SF / Bodega Bay
  TEXAS:           { lat: 27.81,  lng:  -97.39, region: 'Gulf' },        // Corpus Christi
  HAWAII:          { lat: 21.31,  lng: -157.86, region: 'Pacific' },     // Honolulu
  'NEW JERSEY':    { lat: 39.36,  lng:  -74.43, region: 'M Atlantic' },  // Cape May
  'RHODE ISLAND':  { lat: 41.49,  lng:  -71.31, region: 'NE Atlantic' }, // Pt Judith
  MARYLAND:        { lat: 38.34,  lng:  -76.45, region: 'M Atlantic' },  // Chesapeake
  'NORTH CAROLINA':{ lat: 35.22,  lng:  -75.62, region: 'S Atlantic' },  // OBX
  MISSISSIPPI:     { lat: 30.39,  lng:  -88.89, region: 'Gulf' },        // Biloxi
  ALABAMA:         { lat: 30.41,  lng:  -88.04, region: 'Gulf' },        // Mobile Bay
  GEORGIA:         { lat: 31.13,  lng:  -81.49, region: 'S Atlantic' },  // Brunswick
  'SOUTH CAROLINA':{ lat: 32.78,  lng:  -79.93, region: 'S Atlantic' },  // Charleston
  'NEW YORK':      { lat: 40.93,  lng:  -72.65, region: 'M Atlantic' },  // Montauk
  CONNECTICUT:     { lat: 41.31,  lng:  -72.09, region: 'NE Atlantic' }, // Stonington
  'NEW HAMPSHIRE': { lat: 43.07,  lng:  -70.71, region: 'NE Atlantic' }, // Portsmouth
  DELAWARE:        { lat: 38.78,  lng:  -75.12, region: 'M Atlantic' },  // Lewes
  'PUERTO RICO':   { lat: 17.96,  lng:  -67.20, region: 'Caribbean' },   // SW coast
};

interface SpeciesEntry { name: string; dollars: number; pounds: number; }
interface StateLanding {
  state: string;
  region: string;
  lat: number;
  lng: number;
  total_dollars: number;
  total_pounds: number;
  species_count: number;
  top_species: SpeciesEntry[];
}
interface Payload { year: number; states: StateLanding[]; total_dollars: number; total_pounds: number; }

async function fetchAllRecords(year: number): Promise<any[]> {
  // FOSS returns the year in one ~1 MB blob if we ask for enough rows.
  const url = FOSS_URL(year, 20000, 0);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`NOAA FOSS ${res.status}`);
  const json = await res.json();
  if (json.hasMore) {
    // Defensive: page through the rest. Shouldn't trigger for current data.
    let offset = (json.items || []).length;
    const out = [...(json.items || [])];
    while (true) {
      const r = await fetch(FOSS_URL(year, 20000, offset), { signal: AbortSignal.timeout(30000) });
      if (!r.ok) break;
      const j = await r.json();
      out.push(...(j.items || []));
      if (!j.hasMore) break;
      offset += (j.items || []).length;
    }
    return out;
  }
  return json.items || [];
}

function aggregate(items: any[]): Payload {
  const buckets = new Map<string, { dollars: number; pounds: number; species: Map<string, { dollars: number; pounds: number }> }>();
  for (const row of items) {
    const state = row.state_name as string;
    const name = row.ts_afs_name as string;
    if (!state || !name) continue;
    if (name === 'WITHHELD FOR CONFIDENTIALITY') continue; // skip CBI rows
    const $ = row.dollars || 0;
    const lb = row.pounds || 0;
    if (!buckets.has(state)) buckets.set(state, { dollars: 0, pounds: 0, species: new Map() });
    const b = buckets.get(state)!;
    b.dollars += $; b.pounds += lb;
    const sp = b.species.get(name) || { dollars: 0, pounds: 0 };
    sp.dollars += $; sp.pounds += lb;
    b.species.set(name, sp);
  }

  const states: StateLanding[] = [];
  let total_dollars = 0, total_pounds = 0;
  for (const [state, b] of buckets) {
    const coords = STATE_COORDS[state];
    if (!coords) continue;  // skip rows for states we don't have coords for
    const top_species = [...b.species.entries()]
      .map(([name, v]) => ({ name: titleCase(name), dollars: Math.round(v.dollars), pounds: Math.round(v.pounds) }))
      .sort((a, b) => b.dollars - a.dollars)
      .slice(0, 8);
    states.push({
      state: titleCase(state),
      region: coords.region,
      lat: coords.lat,
      lng: coords.lng,
      total_dollars: Math.round(b.dollars),
      total_pounds: Math.round(b.pounds),
      species_count: b.species.size,
      top_species,
    });
    total_dollars += b.dollars; total_pounds += b.pounds;
  }
  states.sort((a, b) => b.total_dollars - a.total_dollars);
  return { year: LANDING_YEAR, states, total_dollars: Math.round(total_dollars), total_pounds: Math.round(total_pounds) };
}

function titleCase(s: string): string {
  return s.toLowerCase()
    .split(/(\s|-|\/)/)
    .map(t => /^[a-z]/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : t)
    .join('');
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
    const items = await fetchAllRecords(LANDING_YEAR);
    const payload = aggregate(items);
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
      { error: 'Failed to fetch NOAA FOSS', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
