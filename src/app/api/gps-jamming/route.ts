import { NextResponse } from 'next/server';
import { cellToBoundary, cellToLatLng } from 'h3-js';

/**
 * OSIRIS — GPS Jamming (daily aggregate from gpsjam.org)
 *
 * Complements the live NACp detector in /api/flights with John Wiseman's daily
 * aggregate. Source: https://gpsjam.org/data/<YYYY-MM-DD>-h3_4.csv
 *   Columns: hex (H3 res-4 cell), count_good_aircraft, count_bad_aircraft
 *
 * Returns a GeoJSON FeatureCollection of hex polygons + a centroid point per
 * hex, with `bad_pct = bad / (good + bad)` and `total = good + bad`.
 *
 * We only emit cells with meaningful sample size (total >= MIN_TOTAL) AND a
 * non-trivial bad ratio (bad_pct >= MIN_BAD_PCT) so the map isn't noisy.
 */

const MIN_TOTAL = 10;
const MIN_BAD_PCT = 0.5;

type Cached = { date: string; payload: unknown } | null;
let cached: Cached = null;

function utcDateMinus(days: number): string {
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

async function fetchDay(date: string): Promise<string | null> {
  const url = `https://gpsjam.org/data/${date}-h3_4.csv`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'OSIRIS-Intelligence-Platform/3.5',
      'Accept-Encoding': 'gzip',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text.includes('hex,count_good_aircraft') ? text : null;
}

function parse(csv: string) {
  const features: GeoJSON.Feature[] = [];
  const lines = csv.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [hex, goodStr, badStr] = line.split(',');
    if (!hex) continue;
    const good = +goodStr || 0;
    const bad = +badStr || 0;
    const total = good + bad;
    if (total < MIN_TOTAL) continue;
    const badPct = bad / total;
    if (badPct < MIN_BAD_PCT) continue;

    let boundary: [number, number][];
    let center: [number, number];
    try {
      // h3-js returns [lat, lng]; GeoJSON wants [lng, lat]
      boundary = cellToBoundary(hex).map(([lat, lng]) => [lng, lat] as [number, number]);
      const [lat, lng] = cellToLatLng(hex);
      center = [lng, lat];
    } catch {
      continue;
    }
    // Close the ring
    if (boundary.length > 0) boundary.push(boundary[0]);

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [boundary] },
      properties: {
        hex,
        good,
        bad,
        total,
        bad_pct: Math.round(badPct * 100),
        center_lng: center[0],
        center_lat: center[1],
      },
    });
  }
  return features;
}

export async function GET() {
  // Try yesterday first (most recent complete day in UTC), then 2 days back as fallback.
  const candidates = [utcDateMinus(1), utcDateMinus(2), utcDateMinus(3)];

  if (cached && candidates.includes(cached.date)) {
    return NextResponse.json(cached.payload, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' },
    });
  }

  for (const date of candidates) {
    try {
      const csv = await fetchDay(date);
      if (!csv) continue;
      const features = parse(csv);
      const payload = {
        type: 'FeatureCollection' as const,
        features,
        meta: {
          source: 'gpsjam.org',
          date,
          min_total: MIN_TOTAL,
          min_bad_pct: MIN_BAD_PCT,
          cell_count: features.length,
        },
      };
      cached = { date, payload };
      return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' },
      });
    } catch (e) {
      console.warn(`[OSIRIS] gpsjam fetch failed for ${date}:`, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json(
    { type: 'FeatureCollection', features: [], meta: { error: 'no gpsjam data available' } },
    { status: 503 },
  );
}
