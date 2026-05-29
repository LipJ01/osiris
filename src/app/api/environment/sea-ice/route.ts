import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Sea Ice Extent (Arctic + Antarctic)
 *
 * Pulls daily passive-microwave sea ice extent CSVs from NSIDC (G02135 v4)
 * and joins each pole's current value to the 1981-2010 day-of-year
 * climatology to compute the anomaly + percentile rank.
 *
 * Updated by NSIDC daily; server-cached 12h.
 */

const N_DAILY = 'https://noaadata.apps.nsidc.org/NOAA/G02135/north/daily/data/N_seaice_extent_daily_v4.0.csv';
const N_CLIM  = 'https://noaadata.apps.nsidc.org/NOAA/G02135/north/daily/data/N_seaice_extent_climatology_1981-2010_v4.0.csv';
const S_DAILY = 'https://noaadata.apps.nsidc.org/NOAA/G02135/south/daily/data/S_seaice_extent_daily_v4.0.csv';
const S_CLIM  = 'https://noaadata.apps.nsidc.org/NOAA/G02135/south/daily/data/S_seaice_extent_climatology_1981-2010_v4.0.csv';

const TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_KEY = 'sea-ice-v4';

interface Observation { date: string; doy: number; extent_mkm2: number; }
interface ClimDoy { doy: number; mean: number; std: number; p10: number; p25: number; p50: number; p75: number; p90: number; }

interface PolePayload {
  pole: 'Arctic' | 'Antarctic';
  lat: number;
  lng: number;
  current_extent_mkm2: number;
  current_date: string;
  climatology_mean_mkm2: number;        // 1981-2010 average for this DOY
  climatology_std_mkm2: number;         // 1981-2010 std-dev
  anomaly_mkm2: number;                 // current - climatology mean
  anomaly_pct: number;                  // (current - mean) / mean * 100
  z_score: number;                      // (current - mean) / std
  percentile_estimate: '<10' | '10-25' | '25-50' | '50-75' | '75-90' | '>90' | 'unknown';
  // Annual cycle: last 365 days for sparkline
  recent_year: Observation[];
  // Climatology band for sparkline overlay: 366 points (mean, p10, p90)
  climatology_band: { doy: number; mean: number; p10: number; p90: number }[];
}

interface Payload { poles: PolePayload[]; built_at: string; }

function dateToDoy(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(Date.UTC(year, 0, 1));
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
}

function parseDailyCsv(csv: string): Observation[] {
  const lines = csv.split('\n');
  const out: Observation[] = [];
  // First line is the header; second line is unit annotation. Start from row 2.
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const year = parseInt(parts[0].trim());
    const month = parseInt(parts[1].trim());
    const day = parseInt(parts[2].trim());
    const extent = parseFloat(parts[3].trim());
    if (!Number.isFinite(year) || !Number.isFinite(extent)) continue;
    if (extent <= 0) continue;
    out.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      doy: dateToDoy(year, month, day),
      extent_mkm2: extent,
    });
  }
  return out;
}

function parseClimCsv(csv: string): ClimDoy[] {
  const lines = csv.split('\n');
  const out: ClimDoy[] = [];
  // First line "std Years = ..." then header, data from row 2.
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 8) continue;
    const doy = parseInt(parts[0]);
    if (!Number.isFinite(doy)) continue;
    out.push({
      doy,
      mean: parseFloat(parts[1]),
      std: parseFloat(parts[2]),
      p10: parseFloat(parts[3]),
      p25: parseFloat(parts[4]),
      p50: parseFloat(parts[5]),
      p75: parseFloat(parts[6]),
      p90: parseFloat(parts[7]),
    });
  }
  return out;
}

function percentileFromClim(value: number, c: ClimDoy): PolePayload['percentile_estimate'] {
  if (!c) return 'unknown';
  if (value < c.p10) return '<10';
  if (value < c.p25) return '10-25';
  if (value < c.p50) return '25-50';
  if (value < c.p75) return '50-75';
  if (value < c.p90) return '75-90';
  return '>90';
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    cache: 'no-store',
    headers: { 'User-Agent': 'OSIRIS/1.0' },
  });
  if (!res.ok) throw new Error(`NSIDC ${url} → ${res.status}`);
  return res.text();
}

function buildPole(
  name: 'Arctic' | 'Antarctic',
  lat: number, lng: number,
  daily: Observation[], clim: ClimDoy[],
): PolePayload {
  const latest = daily[daily.length - 1];
  const climDay = clim.find(c => c.doy === latest.doy);
  const climMean = climDay?.mean ?? 0;
  const climStd = climDay?.std ?? 0;
  const anomaly = latest.extent_mkm2 - climMean;
  const anomalyPct = climMean > 0 ? (anomaly / climMean) * 100 : 0;
  const z = climStd > 0 ? anomaly / climStd : 0;
  const percentile = climDay ? percentileFromClim(latest.extent_mkm2, climDay) : 'unknown';

  // Last 365 observations for the sparkline
  const recent_year = daily.slice(-365);

  // Slim the climatology band to one point per DOY
  const climatology_band = clim.map(c => ({ doy: c.doy, mean: c.mean, p10: c.p10, p90: c.p90 }));

  return {
    pole: name,
    lat, lng,
    current_extent_mkm2: latest.extent_mkm2,
    current_date: latest.date,
    climatology_mean_mkm2: climMean,
    climatology_std_mkm2: climStd,
    anomaly_mkm2: anomaly,
    anomaly_pct: anomalyPct,
    z_score: z,
    percentile_estimate: percentile,
    recent_year,
    climatology_band,
  };
}

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=43200' } },
    );
  }
  try {
    const [nDaily, nClim, sDaily, sClim] = await Promise.all([
      fetchCsv(N_DAILY), fetchCsv(N_CLIM), fetchCsv(S_DAILY), fetchCsv(S_CLIM),
    ]);
    const arctic = buildPole('Arctic',   80, 0,   parseDailyCsv(nDaily), parseClimCsv(nClim));
    const antarctic = buildPole('Antarctic', -70, 0, parseDailyCsv(sDaily), parseClimCsv(sClim));
    const payload: Payload = { poles: [arctic, antarctic], built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=43200' } },
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
      { error: 'Failed to fetch NSIDC data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
