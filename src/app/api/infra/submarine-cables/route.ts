import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Submarine Cables (Telegeography)
 *
 * Pulls the public geo feeds powering submarinecablemap.com — ~694 cables
 * and ~1,917 landing stations. Cached server-side for 24h since the topology
 * only changes when cables are added/retired (weeks-to-months cadence).
 *
 * Per-cable detail (operators, length, RFS) loads on click via the
 * `[id]/route.ts` sibling route.
 */

const CABLES_URL  = 'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json';
const LP_URL      = 'https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json';
const TTL_MS      = 24 * 60 * 60 * 1000;
const CACHE_KEY   = 'subcables-geo';

interface CablePayload { id: string; name: string; color: string; segments: number[][][]; anchor?: [number, number]; }
interface LandingPoint { id: string; name: string; lat: number; lng: number; }
interface Bundle { cables: CablePayload[]; landings: LandingPoint[]; source: string; }

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export async function GET() {
  const fresh = await cacheRead<Bundle>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  }

  try {
    const [cablesFc, lpFc] = await Promise.all([fetchJson(CABLES_URL), fetchJson(LP_URL)]);

    // Telegeography emits one feature per cable segment with a shared `id`.
    // Merge segments belonging to the same cable so we render one feature per
    // cable — keeps the source slimmer and lets a single click target the cable.
    const cableMap = new Map<string, CablePayload>();
    for (const f of cablesFc.features || []) {
      const p = f.properties || {};
      const id = p.id;
      if (!id) continue;
      if (!cableMap.has(id)) {
        cableMap.set(id, {
          id, name: p.name || id, color: p.color || '#88CCEE',
          segments: [],
          anchor: Array.isArray(p.coordinates) && p.coordinates.length >= 2
            ? [p.coordinates[0], p.coordinates[1]] : undefined,
        });
      }
      const entry = cableMap.get(id)!;
      const g = f.geometry;
      if (g?.type === 'MultiLineString') entry.segments.push(...g.coordinates);
      else if (g?.type === 'LineString') entry.segments.push(g.coordinates);
    }

    const landings: LandingPoint[] = (lpFc.features || [])
      .filter((f: any) => f.geometry?.coordinates?.length === 2)
      .map((f: any) => ({
        id: f.properties?.id || '',
        name: f.properties?.name || '',
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));

    const bundle: Bundle = {
      cables: [...cableMap.values()],
      landings,
      source: 'Telegeography submarinecablemap.com',
    };
    await cacheWrite(CACHE_KEY, bundle);
    return NextResponse.json(
      { ...bundle, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (e) {
    const stale = await cacheReadStale<Bundle>(CACHE_KEY);
    if (stale) {
      return NextResponse.json(
        { ...stale.data, cached: true, stale: true, age_seconds: Math.floor(stale.age_ms / 1000) },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch submarine cable data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
