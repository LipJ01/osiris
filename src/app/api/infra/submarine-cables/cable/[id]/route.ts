import { NextRequest, NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Submarine Cable detail (per id)
 *
 * Lazy-loaded on click. Telegeography exposes per-cable JSON at
 *   /api/v3/cable/<id>.json
 * Cached per-cable for 7 days because details update rarely.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Detail {
  id: string; name: string;
  length: string | null;
  owners: string | null;
  suppliers: string | null;
  rfs: string | null;
  rfs_year: number | null;
  is_planned: boolean;
  url: string | null;
  notes: string | null;
  landing_points: { id: string; name: string; country: string }[];
}

// Next 16 — params is now async.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^[a-z0-9_-]+$/i.test(id)) {
    return NextResponse.json({ error: 'invalid cable id' }, { status: 400 });
  }
  const key = `subcable-${id}`;
  const fresh = await cacheRead<Detail>(key, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  }
  try {
    const res = await fetch(`https://www.submarinecablemap.com/api/v3/cable/${encodeURIComponent(id)}.json`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const stale = await cacheReadStale<Detail>(key);
      if (stale) return NextResponse.json({ ...stale.data, cached: true, stale: true });
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: res.status });
    }
    const json: Detail = await res.json();
    await cacheWrite(key, json);
    return NextResponse.json(
      { ...json, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (e) {
    const stale = await cacheReadStale<Detail>(key);
    if (stale) return NextResponse.json({ ...stale.data, cached: true, stale: true });
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
