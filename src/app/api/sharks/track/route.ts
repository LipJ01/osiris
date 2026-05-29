import { NextRequest, NextResponse } from 'next/server';

/**
 * OSIRIS — Per-shark ping history (OCEARCH via Mapotic motion endpoint).
 * Returns the full satellite-tag track as a compact list of pings.
 */

const OCEARCH_MAPOTIC_ID = 3413;
const trackUrl = (id: string) =>
  `https://www.mapotic.com/api/v1/maps/${OCEARCH_MAPOTIC_ID}/pois/${id}/motion/with-meta/`;

type CacheEntry = { at: number; data: any };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour per shark

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'id query parameter required' }, { status: 400 });
  }

  const now = Date.now();
  const hit = cache.get(id);
  if (hit && now - hit.at < TTL_MS) {
    return NextResponse.json(hit.data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  }

  try {
    const res = await fetch(trackUrl(id), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OCEARCH upstream ${res.status}`);
    const json = await res.json();

    const pings = (json.motion || [])
      .filter((m: any) => m?.point?.coordinates?.length === 2)
      .map((m: any) => ({
        t: m.dt_move,
        lng: m.point.coordinates[0],
        lat: m.point.coordinates[1],
      }))
      .sort((a: any, b: any) => (a.t || '').localeCompare(b.t || ''));

    const out = {
      id,
      pings,
      total: pings.length,
      first: pings[0]?.t || null,
      last: pings[pings.length - 1]?.t || null,
    };

    cache.set(id, { at: now, data: out });
    if (cache.size > 200) {
      // Trim oldest ~50 entries — keeps memory bounded.
      const sorted = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
      sorted.slice(0, 50).forEach(([k]) => cache.delete(k));
    }

    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch track', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
