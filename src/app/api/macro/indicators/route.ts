import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { cacheRead, cacheWrite, cacheReadStale } from '@/lib/disk-cache';

/**
 * OSIRIS — US Macro Indicators
 *
 * Sibling to /api/macro/cb-rates. Reads the same algo-fund FRED/BLS backfill
 * (~/algo-fund/data/macro/historic-macro.jsonl) and projects a richer
 * multi-indicator panel for the US economy at a single NYC marker.
 *
 * Each indicator: latest value, latest date, optional YoY change for
 * series where it's meaningful, and last 24 points downsampled to monthly.
 */

const FUND_JSONL = path.join(os.homedir(), 'algo-fund', 'data', 'macro', 'historic-macro.jsonl');
const TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = 'macro-indicators-us';

type Computed = 'level' | 'yoy_pct' | 'mom_change';

interface IndicatorSpec {
  code: string;            // series code in JSONL
  group: 'inflation' | 'labor' | 'growth' | 'liquidity' | 'credit' | 'fx';
  display_name: string;
  unit: string;
  computed: Computed;      // how to summarise the "current" headline
  short_note?: string;
}

const SPECS: IndicatorSpec[] = [
  // Inflation — show YoY % so the headline reads as "inflation rate"
  { code: 'CPIAUCSL', group: 'inflation', display_name: 'CPI', unit: '% YoY', computed: 'yoy_pct',
    short_note: 'Headline CPI year-over-year (BLS)' },
  { code: 'PCEPI', group: 'inflation', display_name: 'PCE Price Index', unit: '% YoY', computed: 'yoy_pct',
    short_note: "Fed's preferred inflation gauge — 2% target" },
  // Labor — unemployment is already a percent, NFP is level so show MoM change
  { code: 'UNRATE', group: 'labor', display_name: 'Unemployment Rate', unit: '%', computed: 'level',
    short_note: 'U-3 unemployment rate (BLS)' },
  { code: 'PAYEMS', group: 'labor', display_name: 'Nonfarm Payrolls', unit: 'k MoM', computed: 'mom_change',
    short_note: 'Month-over-month payrolls change (BLS)' },
  // Growth
  { code: 'GDPC1', group: 'growth', display_name: 'Real GDP', unit: '% YoY', computed: 'yoy_pct',
    short_note: 'Real Gross Domestic Product (BEA, quarterly)' },
  // Liquidity
  { code: 'WALCL', group: 'liquidity', display_name: 'Fed Balance Sheet', unit: '$T', computed: 'level',
    short_note: 'H.4.1 Total Fed Assets — QE/QT gauge' },
  { code: 'RRPONTSYD', group: 'liquidity', display_name: 'Reverse Repo', unit: '$B', computed: 'level',
    short_note: 'Overnight RRP — money-market drainage indicator' },
  // Credit
  { code: 'BAMLH0A0HYM2', group: 'credit', display_name: 'HY OAS Spread', unit: 'bps', computed: 'level',
    short_note: 'ICE BofA US High Yield Option-Adjusted Spread' },
  { code: 'T10Y2Y', group: 'credit', display_name: '10y-2y Curve', unit: 'pp', computed: 'level',
    short_note: 'Yield-curve spread — recession signal when negative' },
  // FX
  { code: 'DTWEXBGS', group: 'fx', display_name: 'Broad USD Index', unit: 'index', computed: 'level',
    short_note: 'Nominal Broad US Dollar Index (Fed H.10)' },
];

interface Observation { date: string; value: number; }
interface IndicatorPayload {
  code: string;
  group: string;
  display_name: string;
  unit: string;
  short_note: string;
  frequency: string;
  current_value: number | null;
  current_date: string | null;
  yoy_pct: number | null;          // year-over-year % change if computed
  mom_change: number | null;       // raw month-over-month delta in level units
  history: Observation[];          // last 24 obs (or quarterly = 8 if shorter)
}

interface Payload {
  city: string;
  country: string;
  lat: number;
  lng: number;
  indicators: IndicatorPayload[];
  groups: string[];
  built_at: string;
}

async function readSeriesIndex(): Promise<Map<string, { name: string; frequency: string; observations: Observation[] }>> {
  const raw = await fs.readFile(FUND_JSONL, 'utf-8');
  const idx = new Map<string, { name: string; frequency: string; observations: Observation[] }>();
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const rec = JSON.parse(line);
      const code = rec?.series?.code;
      if (!code) continue;
      const obs: Observation[] = (rec.observations || [])
        .filter((o: any) => typeof o.value === 'number' && !Number.isNaN(o.value))
        .map((o: any) => ({ date: o.date, value: o.value }));
      idx.set(code, { name: rec.series.name, frequency: rec.series.frequency, observations: obs });
    } catch { /* skip */ }
  }
  return idx;
}

function buildIndicator(spec: IndicatorSpec, idx: Map<string, any>): IndicatorPayload | null {
  const entry = idx.get(spec.code);
  if (!entry || entry.observations.length === 0) return null;
  const obs: Observation[] = entry.observations;
  const latest = obs[obs.length - 1];

  // For computed metrics
  let yoy_pct: number | null = null;
  let mom_change: number | null = null;
  if (spec.computed === 'yoy_pct') {
    // Find observation closest to 12 months ago
    const monthsBack = entry.frequency === 'monthly' ? 12 : entry.frequency === 'quarterly' ? 4 : 252;
    const anchor = obs[Math.max(0, obs.length - 1 - monthsBack)];
    if (anchor) yoy_pct = ((latest.value - anchor.value) / anchor.value) * 100;
  } else if (spec.computed === 'mom_change') {
    const prev = obs[obs.length - 2];
    if (prev) mom_change = latest.value - prev.value;
  }

  // History — downsample daily to monthly (last value of month wins), keep
  // monthly/quarterly as-is. Cap at 24 points.
  let history: Observation[];
  if (entry.frequency === 'daily') {
    const monthly = new Map<string, Observation>();
    for (const o of obs) {
      const ym = o.date.slice(0, 7);
      monthly.set(ym, { date: ym + '-01', value: o.value });
    }
    history = [...monthly.values()].slice(-24);
  } else if (entry.frequency === 'weekly') {
    // Sample one obs per month
    const monthly = new Map<string, Observation>();
    for (const o of obs) monthly.set(o.date.slice(0, 7), o);
    history = [...monthly.values()].slice(-24);
  } else if (entry.frequency === 'quarterly') {
    history = obs.slice(-8); // 2 years of quarterly
  } else {
    history = obs.slice(-24);
  }

  return {
    code: spec.code,
    group: spec.group,
    display_name: spec.display_name,
    unit: spec.unit,
    short_note: spec.short_note || entry.name,
    frequency: entry.frequency,
    current_value: latest.value,
    current_date: latest.date,
    yoy_pct,
    mom_change,
    history,
  };
}

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
    );
  }
  try {
    const idx = await readSeriesIndex();
    const indicators = SPECS
      .map(spec => buildIndicator(spec, idx))
      .filter((x): x is IndicatorPayload => !!x);
    const groups = Array.from(new Set(indicators.map(i => i.group)));
    const payload: Payload = {
      city: 'New York',
      country: 'US',
      lat: 40.7128, lng: -74.0060,
      indicators,
      groups,
      built_at: new Date().toISOString(),
    };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600' } },
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
      { error: 'Failed to read algo-fund macro stream', detail: e instanceof Error ? e.message : String(e), source: FUND_JSONL },
      { status: 502 },
    );
  }
}
