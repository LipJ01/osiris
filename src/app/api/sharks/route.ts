import { NextResponse } from 'next/server';

/**
 * OSIRIS — Shark Tracking
 * Tagged marine wildlife from OCEARCH, served via Mapotic's public map API
 * (map 3413). Pings are satellite/SPOT tags: cadence is hours-to-days when
 * the animal surfaces, not realtime — long cache TTL is fine.
 */

const OCEARCH_MAPOTIC_ID = 3413;
const OCEARCH_URL = `https://www.mapotic.com/api/v1/maps/${OCEARCH_MAPOTIC_ID}/pois.geojson/`;

// Coarse species → genus bucket for the symbol layer's color match expression.
function speciesBucket(species: string): 'white' | 'tiger' | 'mako' | 'blue' | 'hammerhead' | 'whale' | 'bull' | 'other' {
  const s = species.toLowerCase();
  if (s.includes('white shark')) return 'white';
  if (s.includes('tiger shark')) return 'tiger';
  if (s.includes('mako')) return 'mako';
  if (s.includes('blue shark')) return 'blue';
  if (s.includes('hammerhead')) return 'hammerhead';
  if (s.includes('whale shark')) return 'whale';
  if (s.includes('bull shark')) return 'bull';
  return 'other';
}

let cached: any = null;
let cachedAt = 0;
const TTL_MS = 30 * 60 * 1000; // 30 min — OCEARCH pings move slowly

export async function GET() {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  }

  try {
    const res = await fetch(OCEARCH_URL, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OCEARCH upstream ${res.status}`);
    const fc = await res.json();

    const sharks = (fc.features || [])
      .filter((f: any) => f?.properties?.category_name?.en === 'Sharks')
      .map((f: any) => {
        const [lng, lat] = f.geometry.coordinates;
        const p = f.properties;
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          species: p.species,
          bucket: speciesBucket(p.species || ''),
          lat,
          lng,
          length: p.length || null,
          weight: p.weight || null,
          gender: p.gender || null,
          stage_of_life: p.stage_of_life || null,
          tag_location: p.tag_location || null,
          last_ping: p.last_move_datetime || p.zping_datetime || p.last_update || null,
          image: p.image || null,
        };
      });

    const out = {
      sharks,
      total: sharks.length,
      source: 'OCEARCH via Mapotic',
      timestamp: new Date().toISOString(),
    };

    cached = out;
    cachedAt = now;

    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' },
    });
  } catch (e) {
    if (cached) {
      // Serve stale on upstream error — better than dropping the layer.
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=60' },
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch shark data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
