import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Ransomware Tracker
 *
 * Pulls the last ~100 ransomware-victim leak-site postings from
 * ransomware.live (free, no auth — aggregates Tor-hosted leak sites from
 * Qilin, LockBit, BlackCat, Akira, Play, Cl0p and ~340 other groups).
 *
 * Server-side cached 1h in SQLite — leak-site posts appear at roughly that
 * cadence and we don't need to hammer the upstream.
 */

const URL = 'https://api.ransomware.live/v2/recentvictims';
const TTL_MS = 60 * 60 * 1000;
const CACHE_KEY = 'ransomware-victims';

interface Victim {
  victim: string;
  group: string;
  country: string;
  activity: string;
  attackdate: string;
  claim_url: string;
  domain?: string;
  description?: string;
  press?: string;
  screenshot?: string;
}

// Country centroids — covers ~55 countries that appear in ransomware leaks.
const C: Record<string, { lat: number; lng: number; name: string }> = {
  US: { lat: 39.83, lng: -98.58, name: 'United States' },
  GB: { lat: 54.00, lng: -2.50,  name: 'United Kingdom' },
  CA: { lat: 56.13, lng: -106.35,name: 'Canada' },
  DE: { lat: 51.17, lng: 10.45,  name: 'Germany' },
  FR: { lat: 46.23, lng:  2.21,  name: 'France' },
  IT: { lat: 41.87, lng: 12.57,  name: 'Italy' },
  ES: { lat: 40.46, lng: -3.75,  name: 'Spain' },
  NL: { lat: 52.13, lng:  5.29,  name: 'Netherlands' },
  BE: { lat: 50.50, lng:  4.47,  name: 'Belgium' },
  AT: { lat: 47.52, lng: 14.55,  name: 'Austria' },
  CH: { lat: 46.82, lng:  8.23,  name: 'Switzerland' },
  PL: { lat: 51.92, lng: 19.15,  name: 'Poland' },
  CZ: { lat: 49.82, lng: 15.47,  name: 'Czechia' },
  DK: { lat: 56.26, lng:  9.50,  name: 'Denmark' },
  SE: { lat: 60.13, lng: 18.64,  name: 'Sweden' },
  NO: { lat: 60.47, lng:  8.47,  name: 'Norway' },
  FI: { lat: 61.92, lng: 25.75,  name: 'Finland' },
  IE: { lat: 53.41, lng: -8.24,  name: 'Ireland' },
  PT: { lat: 39.40, lng: -8.22,  name: 'Portugal' },
  GR: { lat: 39.07, lng: 21.82,  name: 'Greece' },
  RO: { lat: 45.94, lng: 24.97,  name: 'Romania' },
  HU: { lat: 47.16, lng: 19.50,  name: 'Hungary' },
  BG: { lat: 42.73, lng: 25.49,  name: 'Bulgaria' },
  HR: { lat: 45.10, lng: 15.20,  name: 'Croatia' },
  SK: { lat: 48.67, lng: 19.70,  name: 'Slovakia' },
  SI: { lat: 46.15, lng: 14.99,  name: 'Slovenia' },
  EE: { lat: 58.60, lng: 25.01,  name: 'Estonia' },
  LV: { lat: 56.88, lng: 24.60,  name: 'Latvia' },
  LT: { lat: 55.17, lng: 23.88,  name: 'Lithuania' },
  AU: { lat: -25.27, lng: 133.78,name: 'Australia' },
  NZ: { lat: -40.90, lng: 174.89,name: 'New Zealand' },
  JP: { lat: 36.20, lng: 138.25, name: 'Japan' },
  KR: { lat: 35.91, lng: 127.77, name: 'South Korea' },
  SG: { lat:  1.35, lng: 103.82, name: 'Singapore' },
  HK: { lat: 22.30, lng: 114.17, name: 'Hong Kong' },
  TW: { lat: 23.70, lng: 121.00, name: 'Taiwan' },
  IN: { lat: 20.59, lng: 78.96,  name: 'India' },
  TH: { lat: 15.87, lng: 100.99, name: 'Thailand' },
  MY: { lat:  4.21, lng: 101.98, name: 'Malaysia' },
  PH: { lat: 12.88, lng: 121.77, name: 'Philippines' },
  ID: { lat: -0.79, lng: 113.92, name: 'Indonesia' },
  VN: { lat: 14.06, lng: 108.28, name: 'Vietnam' },
  IL: { lat: 31.05, lng:  34.85, name: 'Israel' },
  AE: { lat: 23.42, lng:  53.85, name: 'UAE' },
  SA: { lat: 23.89, lng:  45.08, name: 'Saudi Arabia' },
  TR: { lat: 38.96, lng:  35.24, name: 'Türkiye' },
  ZA: { lat: -30.56, lng: 22.94, name: 'South Africa' },
  EG: { lat: 26.82, lng:  30.80, name: 'Egypt' },
  NG: { lat:  9.08, lng:   8.68, name: 'Nigeria' },
  KE: { lat: -0.02, lng:  37.91, name: 'Kenya' },
  BR: { lat: -14.24,lng: -51.93, name: 'Brazil' },
  AR: { lat: -38.42,lng: -63.62, name: 'Argentina' },
  MX: { lat: 23.63, lng: -102.55,name: 'Mexico' },
  CL: { lat: -35.68,lng: -71.54, name: 'Chile' },
  CO: { lat:  4.57, lng:  -74.30,name: 'Colombia' },
  PE: { lat:  -9.19,lng:  -75.02,name: 'Peru' },
  RU: { lat: 61.52, lng: 105.32, name: 'Russia' },
  UA: { lat: 48.38, lng:  31.17, name: 'Ukraine' },
};

interface CountryAggregate {
  iso: string;
  name: string;
  lat: number;
  lng: number;
  victim_count: number;
  most_recent_date: string;
  most_recent_days_ago: number;
  top_groups: { group: string; count: number }[];
  top_sectors: { sector: string; count: number }[];
  victims: {
    victim: string; group: string; sector: string; date: string; days_ago: number;
    domain: string | null; description: string | null; claim_url: string;
  }[];
}

interface Payload {
  countries: CountryAggregate[];
  total_victims: number;
  window_days: number;
  groups_seen: number;
  built_at: string;
}

export async function GET() {
  const fresh = await cacheRead<Payload>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    );
  }

  try {
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
      headers: { 'User-Agent': 'OSIRIS/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`ransomware.live ${res.status}`);
    const items: Victim[] = await res.json();
    const now = Date.now();
    const dayMs = 86400000;

    const byCountry = new Map<string, any>();
    let oldestDays = 0;
    const allGroups = new Set<string>();

    for (const v of items) {
      const iso = (v.country || '').trim().toUpperCase();
      const centroid = iso ? C[iso] : null;
      if (!centroid) continue;
      const days = Math.floor((now - new Date(v.attackdate).getTime()) / dayMs);
      oldestDays = Math.max(oldestDays, days);
      allGroups.add(v.group);
      if (!byCountry.has(iso)) {
        byCountry.set(iso, {
          iso, name: centroid.name, lat: centroid.lat, lng: centroid.lng,
          victim_count: 0,
          most_recent_date: v.attackdate,
          most_recent_days_ago: days,
          groups: new Map<string, number>(),
          sectors: new Map<string, number>(),
          victims: [],
        });
      }
      const c = byCountry.get(iso);
      c.victim_count++;
      c.groups.set(v.group, (c.groups.get(v.group) || 0) + 1);
      const sec = (v.activity || 'Unknown').trim() || 'Unknown';
      c.sectors.set(sec, (c.sectors.get(sec) || 0) + 1);
      if (days < c.most_recent_days_ago) {
        c.most_recent_days_ago = days;
        c.most_recent_date = v.attackdate;
      }
      c.victims.push({
        victim: v.victim || '(unnamed)',
        group: v.group,
        sector: sec,
        date: v.attackdate,
        days_ago: days,
        domain: v.domain || null,
        description: v.description?.slice(0, 240) || null,
        claim_url: v.claim_url || '',
      });
    }

    const countries: CountryAggregate[] = [...byCountry.values()].map(c => {
      c.victims.sort((a: any, b: any) => a.days_ago - b.days_ago);
      const top_groups = [...c.groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([group, count]) => ({ group, count }));
      const top_sectors = [...c.sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sector, count]) => ({ sector, count }));
      delete c.groups; delete c.sectors;
      return { ...c, top_groups, top_sectors };
    }).sort((a, b) => b.victim_count - a.victim_count);

    const payload: Payload = {
      countries,
      total_victims: items.length,
      window_days: oldestDays,
      groups_seen: allGroups.size,
      built_at: new Date().toISOString(),
    };
    await cacheWrite(CACHE_KEY, payload);
    return NextResponse.json(
      { ...payload, cached: false },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
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
      { error: 'Failed to fetch ransomware data', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
