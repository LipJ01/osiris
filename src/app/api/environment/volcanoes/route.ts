import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Active Volcanoes
 *
 * Pulls NASA EONET's open severe-events feed filtered to the volcanoes
 * category. EONET aggregates Smithsonian Global Volcanism Program reports +
 * NASA Earth Observatory imagery; data is updated daily.
 *
 * Server-side cached 2h — eruption status changes weekly at most, but the
 * "last update" timestamp moves more frequently as VAACs report new ash
 * plumes.
 */

const URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open&limit=100';
const TTL_MS = 2 * 60 * 60 * 1000;
const CACHE_KEY = 'volcanoes-active';

interface Source { id: string; url: string; }
interface Volcano {
  id: string;
  name: string;                  // e.g. "Kilauea"
  country: string;               // best-effort extracted from title
  lat: number;
  lng: number;
  last_update: string | null;
  days_ago: number | null;
  smithsonian_url: string | null;
  eonet_url: string;
  sources: Source[];
  raw_title: string;
}

function parseTitle(title: string): { name: string; country: string } {
  // EONET titles follow "<Name> Volcano, <Country>" pattern
  const m = title.match(/^(.*?)\s+Volcano,\s+(.+)$/);
  if (m) return { name: m[1].trim(), country: m[2].trim() };
  // Sometimes lacks "Volcano" word
  const m2 = title.match(/^(.*?),\s+(.+)$/);
  if (m2) return { name: m2[1].trim(), country: m2[2].trim() };
  return { name: title, country: '' };
}

function smithsonianUrlFromSources(sources: Source[]): string | null {
  // EONET source IDs include SIVolcano:<volcano_number> where number is the GVP ID
  const si = sources.find(s => s.id && s.id.startsWith('SIVolcano'));
  if (!si) return null;
  // Source URL is usually already the Smithsonian page; sometimes the id contains the number
  if (si.url) return si.url;
  return null;
}

interface Payload { volcanoes: Volcano[]; total: number; built_at: string; }

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
    );
  }
  try {
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`EONET ${res.status}`);
    const json = await res.json();
    const events: any[] = Array.isArray(json.events) ? json.events : [];

    const now = Date.now();
    const dayMs = 86400000;

    const volcanoes: Volcano[] = events.map((ev: any) => {
      const geoms: any[] = Array.isArray(ev.geometry) ? ev.geometry : [];
      // For volcanoes EONET usually emits a single point; if multiple, use latest
      const last = geoms[geoms.length - 1];
      if (!last?.coordinates) return null;
      const [lng, lat] = last.coordinates;
      const { name, country } = parseTitle(ev.title || '');
      const sources: Source[] = (ev.sources || []).map((s: any) => ({ id: s.id, url: s.url }));
      const days_ago = last.date ? Math.floor((now - new Date(last.date).getTime()) / dayMs) : null;
      return {
        id: ev.id,
        name, country,
        lat, lng,
        last_update: last.date || null,
        days_ago,
        smithsonian_url: smithsonianUrlFromSources(sources),
        eonet_url: `https://eonet.gsfc.nasa.gov/api/v3/events/${ev.id}`,
        sources,
        raw_title: ev.title || '',
      } as Volcano;
    }).filter((v): v is Volcano => !!v);

    const payload: Payload = { volcanoes, total: volcanoes.length, built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
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
      { error: 'Failed to fetch volcano data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
