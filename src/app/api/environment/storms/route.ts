import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Active Tropical Cyclones
 *
 * Pulls active storm positions from:
 *   • NOAA NHC (Atlantic + EP Pacific) — CurrentStorms.json
 *   • NASA EONET (severe storms category) — global fallback / supplement
 *
 * Atlantic hurricane season runs Jun-Nov, NW Pacific May-Oct, S. Indian Nov-Apr.
 * Outside those windows the layer renders empty by design.
 *
 * Server-side cached 30 min — track positions update ~6 hourly.
 */

const NHC_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&status=open&limit=50';
const TTL_MS = 30 * 60 * 1000;
const CACHE_KEY = 'tropical-storms';

interface StormPosition { lat: number; lng: number; date: string | null; }
interface Storm {
  id: string;
  name: string;
  basin: string;          // 'Atlantic' | 'EPAC' | 'WPAC' | 'NIO' | 'SIO' | 'SPAC' | 'Other'
  classification: string; // TD / TS / HU / TY etc.
  category: string;       // human-readable
  max_wind_mph: number | null;
  pressure_mbar: number | null;
  lat: number;
  lng: number;
  movement: string | null;
  track: StormPosition[]; // history if available
  source: 'NHC' | 'EONET';
  title: string;          // full agency-formatted name (e.g. "Tropical Storm Beryl")
  source_url: string | null;
}

function basinFromLngLat(lng: number, lat: number): string {
  if (lat > 0 && lng > -100 && lng < 0) return 'Atlantic';
  if (lat > 0 && lng >= -180 && lng <= -100) return 'EPAC';
  if (lat > 0 && lng > 100 && lng < 180) return 'WPAC';
  if (lat > 0 && lng > 40 && lng <= 100) return 'NIO';
  if (lat < 0 && lng > 20 && lng < 135) return 'SIO';
  if (lat < 0 && lng >= 135) return 'SPAC';
  return 'Other';
}

async function fetchNhc(): Promise<Storm[]> {
  try {
    const res = await fetch(NHC_URL, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items: any[] = Array.isArray(json.activeStorms) ? json.activeStorms : [];
    return items.map((s: any) => {
      const lat = typeof s.latitudeNumeric === 'number' ? s.latitudeNumeric : parseFloat(s.latitude);
      const lng = typeof s.longitudeNumeric === 'number' ? s.longitudeNumeric : parseFloat(s.longitude);
      return {
        id: s.id || s.binNumber || s.atcfID || `nhc-${s.name}`,
        name: s.name || 'Unnamed',
        basin: s.binNumber?.includes?.('al') ? 'Atlantic' : (s.binNumber?.includes?.('ep') ? 'EPAC' : basinFromLngLat(lng, lat)),
        classification: s.classification || '',
        category: s.intensityFlag || s.intensity || '',
        max_wind_mph: typeof s.intensity === 'number' ? s.intensity : (parseFloat(s.intensity) || null),
        pressure_mbar: typeof s.pressure === 'number' ? s.pressure : (parseFloat(s.pressure) || null),
        lat: Number.isFinite(lat) ? lat : 0,
        lng: Number.isFinite(lng) ? lng : 0,
        movement: s.movement || null,
        track: [], // NHC active feed gives only current fix
        source: 'NHC',
        title: [s.classification, s.name].filter(Boolean).join(' ') || s.name || 'Unnamed',
        source_url: s.publicAdvisory?.url || `https://www.nhc.noaa.gov/`,
      } as Storm;
    });
  } catch { return []; }
}

async function fetchEonet(): Promise<Storm[]> {
  try {
    const res = await fetch(EONET_URL, {
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const events: any[] = Array.isArray(json.events) ? json.events : [];
    return events.map((ev: any) => {
      const geoms: any[] = Array.isArray(ev.geometry) ? ev.geometry : [];
      const last = geoms[geoms.length - 1];
      if (!last?.coordinates) return null;
      const [lng, lat] = last.coordinates;
      const track: StormPosition[] = geoms
        .filter((g: any) => Array.isArray(g.coordinates))
        .map((g: any) => ({ lng: g.coordinates[0], lat: g.coordinates[1], date: g.date || null } as any));
      const magnitude = last.magnitudeValue;
      return {
        id: ev.id || `eonet-${Math.random().toString(36).slice(2,8)}`,
        name: (ev.title || 'Storm').replace(/^.*?[ -]/, '').trim() || ev.title || 'Storm',
        basin: basinFromLngLat(lng, lat),
        classification: 'TC',
        category: '',
        max_wind_mph: typeof magnitude === 'number' ? Math.round(magnitude * 1.15078) : null, // kts→mph if magnitude is kts
        pressure_mbar: null,
        lat, lng,
        movement: null,
        track,
        source: 'EONET',
        title: ev.title || 'Storm',
        source_url: ev.sources?.[0]?.url || `https://eonet.gsfc.nasa.gov/api/v3/events/${ev.id}`,
      } as Storm;
    }).filter((s): s is Storm => !!s);
  } catch { return []; }
}

interface Payload { storms: Storm[]; sources: string[]; built_at: string; }

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } },
    );
  }
  try {
    const [nhc, eonet] = await Promise.all([fetchNhc(), fetchEonet()]);
    // Dedup if NHC and EONET both report the same storm — match by name (case-insensitive)
    const seen = new Set<string>();
    const merged: Storm[] = [];
    for (const s of [...nhc, ...eonet]) {
      const key = s.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
    const payload: Payload = { storms: merged, sources: ['NOAA NHC', 'NASA EONET'], built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } },
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
      { error: 'Failed to fetch storm data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
