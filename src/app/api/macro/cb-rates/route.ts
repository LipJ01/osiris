import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { cacheRead, cacheWrite, cacheReadStale } from '@/lib/disk-cache';

/**
 * OSIRIS — Central Bank Interest Rates
 *
 * Reads algo-fund's backfilled FRED/BLS macro stream
 *   ~/algo-fund/data/macro/historic-macro.jsonl
 * and projects it into one marker per central bank with its current policy
 * rate + recent trajectory. Cached in our SQLite for 6h — algo-fund only
 * re-runs the puller on demand, so we're not racing a fast-moving file.
 *
 * For each country we prefer (in order):
 *   US — DFF (Effective Fed Funds Rate, daily)
 *   EZ — ECB_MRR (ECB Main Refinancing Operations Rate, daily)
 *   * — CBRATE_<ISO> (OECD overnight interbank, monthly)
 */

const FUND_JSONL = path.join(os.homedir(), 'algo-fund', 'data', 'macro', 'historic-macro.jsonl');
const TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = 'cb-rates';

interface CB {
  iso: string;
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  // Series codes to try in order, first one with data wins.
  series_preference: string[];
}

const BANKS: CB[] = [
  { iso: 'US', name: 'US Federal Reserve',         country: 'United States',  city: 'Washington DC',  lat: 38.8924, lng: -77.0455, series_preference: ['DFF'] },
  { iso: 'EZ', name: 'European Central Bank',      country: 'Euro Area',      city: 'Frankfurt',      lat: 50.1090, lng:   8.6700, series_preference: ['ECB_MRR', 'CBRATE_EZ'] },
  { iso: 'GB', name: 'Bank of England',            country: 'United Kingdom', city: 'London',         lat: 51.5142, lng:  -0.0886, series_preference: ['CBRATE_GB'] },
  { iso: 'JP', name: 'Bank of Japan',              country: 'Japan',          city: 'Tokyo',          lat: 35.6868, lng: 139.7707, series_preference: ['CBRATE_JP'] },
  { iso: 'CA', name: 'Bank of Canada',             country: 'Canada',         city: 'Ottawa',         lat: 45.4215, lng: -75.7010, series_preference: ['CBRATE_CA'] },
  { iso: 'CH', name: 'Swiss National Bank',        country: 'Switzerland',    city: 'Bern',           lat: 46.9478, lng:   7.4440, series_preference: ['CBRATE_CH'] },
  { iso: 'AU', name: 'Reserve Bank of Australia',  country: 'Australia',      city: 'Sydney',         lat: -33.8675, lng: 151.2098, series_preference: ['CBRATE_AU'] },
  { iso: 'KR', name: 'Bank of Korea',              country: 'South Korea',    city: 'Seoul',          lat: 37.5612, lng: 126.9851, series_preference: ['CBRATE_KR'] },
  { iso: 'IN', name: 'Reserve Bank of India',      country: 'India',          city: 'Mumbai',         lat: 18.9329, lng:  72.8367, series_preference: ['CBRATE_IN'] },
  { iso: 'BR', name: 'Banco Central do Brasil',    country: 'Brazil',         city: 'Brasília',       lat: -15.8020, lng: -47.8822, series_preference: ['CBRATE_BR'] },
  { iso: 'MX', name: 'Banco de México',            country: 'Mexico',         city: 'Mexico City',    lat: 19.4347, lng: -99.1396, series_preference: ['CBRATE_MX'] },
  { iso: 'ZA', name: 'South African Reserve Bank', country: 'South Africa',   city: 'Pretoria',       lat: -25.7459, lng:  28.1879, series_preference: ['CBRATE_ZA'] },
  { iso: 'CN', name: 'People\'s Bank of China',    country: 'China',          city: 'Beijing',        lat: 39.9067, lng: 116.3920, series_preference: ['CBRATE_CN'] },
];

interface RateObservation { date: string; value: number; }
interface CBPayload {
  iso: string;
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  series_code: string;
  series_name: string;
  frequency: string;
  current_rate: number;
  current_rate_date: string;
  prev_rate: number | null;
  prev_rate_date: string | null;
  change_bps: number | null;
  // 24 most recent points for sparkline
  history: RateObservation[];
  // Trailing 12-month change for trend chip
  yoy_change_bps: number | null;
}

interface CachedPayload { banks: CBPayload[]; source_file: string; built_at: string; }

async function readSeriesIndex(): Promise<Map<string, { name: string; frequency: string; observations: RateObservation[] }>> {
  const raw = await fs.readFile(FUND_JSONL, 'utf-8');
  const idx = new Map<string, { name: string; frequency: string; observations: RateObservation[] }>();
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const rec = JSON.parse(line);
      const code = rec?.series?.code;
      if (!code) continue;
      const obs: RateObservation[] = (rec.observations || [])
        .filter((o: any) => typeof o.value === 'number' && !Number.isNaN(o.value))
        .map((o: any) => ({ date: o.date, value: o.value }));
      idx.set(code, {
        name: rec.series.name,
        frequency: rec.series.frequency,
        observations: obs,
      });
    } catch { /* skip malformed line */ }
  }
  return idx;
}

function buildPayload(bank: CB, idx: Map<string, any>): CBPayload | null {
  let chosen: { code: string; entry: any } | null = null;
  for (const code of bank.series_preference) {
    const entry = idx.get(code);
    if (entry && entry.observations.length > 0) { chosen = { code, entry }; break; }
  }
  if (!chosen) return null;

  const obs = chosen.entry.observations as RateObservation[];
  const latest = obs[obs.length - 1];
  // Find the last datapoint where the rate actually differs from the current.
  let prev: RateObservation | null = null;
  for (let i = obs.length - 2; i >= 0; i--) {
    if (Math.abs(obs[i].value - latest.value) > 1e-9) { prev = obs[i]; break; }
  }
  const change_bps = prev ? Math.round((latest.value - prev.value) * 100) : null;

  // History: last 24 points (or all if fewer). For daily data downsample to monthly
  // to keep sparkline readable across short/long frequencies.
  let history: RateObservation[];
  if (chosen.entry.frequency === 'daily') {
    const monthly = new Map<string, RateObservation>();
    for (const o of obs) {
      const ym = o.date.slice(0, 7);
      monthly.set(ym, { date: ym + '-01', value: o.value }); // last value of the month wins
    }
    history = [...monthly.values()].slice(-24);
  } else {
    history = obs.slice(-24);
  }

  // YoY change: compare latest to value from ~12 months ago.
  const yoyAnchor = obs[Math.max(0, obs.length - 13)];
  const yoy_change_bps = yoyAnchor ? Math.round((latest.value - yoyAnchor.value) * 100) : null;

  return {
    iso: bank.iso, name: bank.name, country: bank.country, city: bank.city, lat: bank.lat, lng: bank.lng,
    series_code: chosen.code, series_name: chosen.entry.name, frequency: chosen.entry.frequency,
    current_rate: latest.value, current_rate_date: latest.date,
    prev_rate: prev?.value ?? null, prev_rate_date: prev?.date ?? null,
    change_bps, history, yoy_change_bps,
  };
}

export async function GET() {
  const fresh = await cacheRead<CachedPayload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
    );
  }

  try {
    const idx = await readSeriesIndex();
    const banks = BANKS
      .map(b => buildPayload(b, idx))
      .filter((b): b is CBPayload => !!b);
    const payload: CachedPayload = { banks, source_file: FUND_JSONL, built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
    );
  } catch (e) {
    const stale = await cacheReadStale<CachedPayload>(CACHE_KEY);
    if (stale) {
      return NextResponse.json(
        { ...stale.data, cached: true, stale: true, age_seconds: Math.floor(stale.age_ms / 1000) },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      );
    }
    return NextResponse.json(
      { error: 'Failed to read algo-fund macro stream', detail: e instanceof Error ? e.message : String(e), source: FUND_JSONL },
      { status: 502 },
    );
  }
}
