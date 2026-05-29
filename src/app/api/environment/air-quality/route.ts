import { NextResponse } from 'next/server';
import { cacheRead, cacheReadStale, cacheWrite } from '@/lib/disk-cache';

/**
 * OSIRIS — Air Quality
 *
 * Pulls current PM2.5 + US AQI + dominant-pollutant readings for ~80 major
 * cities globally via Open-Meteo's Air Quality endpoint (CAMS-based model,
 * no auth required, attribution required).
 *
 * Server-side cached 30 min in SQLite; concurrent batches of 8 keep cold load
 * to ~5s vs the 80×1s a serial loop would take.
 */

const TTL_MS = 30 * 60 * 1000;
const CACHE_KEY = 'air-quality';
const BATCH = 8;

interface City { name: string; country: string; region: string; lat: number; lng: number; population_m?: number; note?: string; }

// Hand-picked megacities + air-quality storyline cities (Diwali Delhi, fire-
// season Vancouver, harmattan Lagos, winter-inversion Krakow, etc.)
const CITIES: City[] = [
  // ── Asia (mega + heavy smog) ──
  { name: 'Beijing',        country: 'CN', region: 'Asia-Pacific', lat: 39.9042, lng: 116.4074, population_m: 22 },
  { name: 'Shanghai',       country: 'CN', region: 'Asia-Pacific', lat: 31.2304, lng: 121.4737, population_m: 26 },
  { name: 'Chongqing',      country: 'CN', region: 'Asia-Pacific', lat: 29.4316, lng: 106.9123, population_m: 17 },
  { name: 'Chengdu',        country: 'CN', region: 'Asia-Pacific', lat: 30.5728, lng: 104.0668, population_m: 16 },
  { name: 'Wuhan',          country: 'CN', region: 'Asia-Pacific', lat: 30.5928, lng: 114.3055, population_m: 11 },
  { name: 'Guangzhou',      country: 'CN', region: 'Asia-Pacific', lat: 23.1291, lng: 113.2644, population_m: 19 },
  { name: 'Shenzhen',       country: 'CN', region: 'Asia-Pacific', lat: 22.5431, lng: 114.0579, population_m: 17 },
  { name: 'Xi\'an',         country: 'CN', region: 'Asia-Pacific', lat: 34.3416, lng: 108.9398, population_m: 13 },
  { name: 'Harbin',         country: 'CN', region: 'Asia-Pacific', lat: 45.8038, lng: 126.5350, population_m: 10,
    note: 'Heating-season particulate spikes from coal-fired district heating.' },
  { name: 'Delhi',          country: 'IN', region: 'Asia-Pacific', lat: 28.7041, lng: 77.1025, population_m: 33,
    note: 'World\'s most polluted megacity in autumn; crop-burning + vehicle + industrial.' },
  { name: 'Mumbai',         country: 'IN', region: 'Asia-Pacific', lat: 19.0760, lng: 72.8777, population_m: 22 },
  { name: 'Kolkata',        country: 'IN', region: 'Asia-Pacific', lat: 22.5726, lng: 88.3639, population_m: 16 },
  { name: 'Chennai',        country: 'IN', region: 'Asia-Pacific', lat: 13.0827, lng: 80.2707, population_m: 11 },
  { name: 'Bengaluru',      country: 'IN', region: 'Asia-Pacific', lat: 12.9716, lng: 77.5946, population_m: 14 },
  { name: 'Hyderabad',      country: 'IN', region: 'Asia-Pacific', lat: 17.3850, lng: 78.4867, population_m: 11 },
  { name: 'Ahmedabad',      country: 'IN', region: 'Asia-Pacific', lat: 23.0225, lng: 72.5714, population_m:  8 },
  { name: 'Dhaka',          country: 'BD', region: 'Asia-Pacific', lat: 23.8103, lng: 90.4125, population_m: 23,
    note: 'Brick-kiln + dust + vehicle emissions; consistently top-5 polluted globally.' },
  { name: 'Karachi',        country: 'PK', region: 'Asia-Pacific', lat: 24.8607, lng: 67.0011, population_m: 17 },
  { name: 'Lahore',         country: 'PK', region: 'Asia-Pacific', lat: 31.5497, lng: 74.3436, population_m: 13,
    note: 'Worst winter smog in South Asia (Nov-Jan); schools repeatedly closed.' },
  { name: 'Jakarta',        country: 'ID', region: 'Asia-Pacific', lat: -6.2088, lng: 106.8456, population_m: 33 },
  { name: 'Manila',         country: 'PH', region: 'Asia-Pacific', lat: 14.5995, lng: 120.9842, population_m: 14 },
  { name: 'Bangkok',        country: 'TH', region: 'Asia-Pacific', lat: 13.7563, lng: 100.5018, population_m: 15,
    note: 'Burning-season PM2.5 spikes Jan-Apr from sugarcane + rice-straw burning.' },
  { name: 'Ho Chi Minh City',country: 'VN',region: 'Asia-Pacific', lat: 10.8231, lng: 106.6297, population_m: 14 },
  { name: 'Hanoi',          country: 'VN', region: 'Asia-Pacific', lat: 21.0285, lng: 105.8542, population_m:  9 },
  { name: 'Seoul',          country: 'KR', region: 'Asia-Pacific', lat: 37.5665, lng: 126.9780, population_m: 26 },
  { name: 'Tokyo',          country: 'JP', region: 'Asia-Pacific', lat: 35.6762, lng: 139.6503, population_m: 37 },
  { name: 'Hong Kong',      country: 'HK', region: 'Asia-Pacific', lat: 22.3193, lng: 114.1694, population_m:  7 },
  { name: 'Singapore',      country: 'SG', region: 'Asia-Pacific', lat: 1.3521, lng: 103.8198, population_m:  6,
    note: 'Vulnerable to Sumatran peatland-fire haze (Jul-Oct).' },
  { name: 'Ulaanbaatar',    country: 'MN', region: 'Asia-Pacific', lat: 47.8864, lng: 106.9057, population_m: 1.7,
    note: 'World\'s worst air in winter — coal stoves + temperature inversion at -30°C.' },
  { name: 'Kathmandu',      country: 'NP', region: 'Asia-Pacific', lat: 27.7172, lng: 85.3240, population_m: 1.5 },
  { name: 'Taipei',         country: 'TW', region: 'Asia-Pacific', lat: 25.0330, lng: 121.5654, population_m:  7 },

  // ── Middle East ──
  { name: 'Tehran',         country: 'IR', region: 'Middle East', lat: 35.6892, lng: 51.3890, population_m:  9,
    note: 'Alborz mountains trap pollution against the city — schools regularly close.' },
  { name: 'Baghdad',        country: 'IQ', region: 'Middle East', lat: 33.3152, lng: 44.3661, population_m:  8 },
  { name: 'Riyadh',         country: 'SA', region: 'Middle East', lat: 24.7136, lng: 46.6753, population_m:  7 },
  { name: 'Dubai',          country: 'AE', region: 'Middle East', lat: 25.2048, lng: 55.2708, population_m:  4 },
  { name: 'Cairo',          country: 'EG', region: 'Africa',     lat: 30.0444, lng: 31.2357, population_m: 22,
    note: '"Black Cloud" autumn pollution from rice-straw burning + vehicles.' },
  { name: 'Istanbul',       country: 'TR', region: 'Europe',     lat: 41.0082, lng: 28.9784, population_m: 16 },
  { name: 'Tel Aviv',       country: 'IL', region: 'Middle East', lat: 32.0853, lng: 34.7818, population_m:  4 },

  // ── Europe ──
  { name: 'London',         country: 'GB', region: 'Europe',     lat: 51.5074, lng: -0.1278, population_m:  9 },
  { name: 'Paris',          country: 'FR', region: 'Europe',     lat: 48.8566, lng:  2.3522, population_m: 11 },
  { name: 'Berlin',         country: 'DE', region: 'Europe',     lat: 52.5200, lng: 13.4050, population_m:  4 },
  { name: 'Madrid',         country: 'ES', region: 'Europe',     lat: 40.4168, lng: -3.7038, population_m:  7 },
  { name: 'Rome',           country: 'IT', region: 'Europe',     lat: 41.9028, lng: 12.4964, population_m:  4 },
  { name: 'Milan',          country: 'IT', region: 'Europe',     lat: 45.4642, lng:  9.1900, population_m:  3,
    note: 'Po Valley inversion creates Europe\'s worst urban PM2.5 each winter.' },
  { name: 'Athens',         country: 'GR', region: 'Europe',     lat: 37.9838, lng: 23.7275, population_m:  3 },
  { name: 'Moscow',         country: 'RU', region: 'Europe',     lat: 55.7558, lng: 37.6173, population_m: 12 },
  { name: 'Warsaw',         country: 'PL', region: 'Europe',     lat: 52.2297, lng: 21.0122, population_m:  2 },
  { name: 'Krakow',         country: 'PL', region: 'Europe',     lat: 50.0647, lng: 19.9450, population_m:  1,
    note: 'Coal-heated tenement smog among Europe\'s worst (Oct-Mar).' },
  { name: 'Sarajevo',       country: 'BA', region: 'Europe',     lat: 43.8563, lng: 18.4131, population_m:  0.4 },
  { name: 'Skopje',         country: 'MK', region: 'Europe',     lat: 41.9981, lng: 21.4254, population_m:  0.6,
    note: 'Frequently world #1 PM2.5 in winter inversion days.' },
  { name: 'Stockholm',      country: 'SE', region: 'Europe',     lat: 59.3293, lng: 18.0686, population_m:  2 },
  { name: 'Copenhagen',     country: 'DK', region: 'Europe',     lat: 55.6761, lng: 12.5683, population_m:  1 },
  { name: 'Amsterdam',      country: 'NL', region: 'Europe',     lat: 52.3676, lng:  4.9041, population_m:  1 },

  // ── Africa ──
  { name: 'Lagos',          country: 'NG', region: 'Africa',     lat: 6.5244, lng:   3.3792, population_m: 16 },
  { name: 'Kinshasa',       country: 'CD', region: 'Africa',     lat: -4.4419, lng: 15.2663, population_m: 17 },
  { name: 'Johannesburg',   country: 'ZA', region: 'Africa',     lat: -26.2041, lng: 28.0473, population_m:  6 },
  { name: 'Cape Town',      country: 'ZA', region: 'Africa',     lat: -33.9249, lng: 18.4241, population_m:  5 },
  { name: 'Nairobi',        country: 'KE', region: 'Africa',     lat: -1.2921, lng: 36.8219, population_m:  5 },
  { name: 'Addis Ababa',    country: 'ET', region: 'Africa',     lat: 9.0320, lng: 38.7469,   population_m:  5 },
  { name: 'Accra',          country: 'GH', region: 'Africa',     lat: 5.6037, lng:  -0.1870, population_m:  3 },
  { name: 'Casablanca',     country: 'MA', region: 'Africa',     lat: 33.5731, lng: -7.5898, population_m:  4 },
  { name: 'N\'Djamena',     country: 'TD', region: 'Africa',     lat: 12.1348, lng: 15.0557, population_m:  1,
    note: 'Harmattan-season dust regularly puts it world #1 for PM2.5 (Dec-Mar).' },
  { name: 'Khartoum',       country: 'SD', region: 'Africa',     lat: 15.5007, lng: 32.5599, population_m:  6 },

  // ── Americas ──
  { name: 'New York',       country: 'US', region: 'North America', lat: 40.7128, lng: -74.0060, population_m: 20 },
  { name: 'Los Angeles',    country: 'US', region: 'North America', lat: 34.0522, lng: -118.2437, population_m: 13,
    note: 'Classic photochemical smog basin; CARB-driven reductions partly offset by wildfire smoke.' },
  { name: 'Chicago',        country: 'US', region: 'North America', lat: 41.8781, lng: -87.6298, population_m:  9 },
  { name: 'Houston',        country: 'US', region: 'North America', lat: 29.7604, lng: -95.3698, population_m:  7 },
  { name: 'Denver',         country: 'US', region: 'North America', lat: 39.7392, lng: -104.9903, population_m:  3 },
  { name: 'San Francisco',  country: 'US', region: 'North America', lat: 37.7749, lng: -122.4194, population_m:  8 },
  { name: 'Seattle',        country: 'US', region: 'North America', lat: 47.6062, lng: -122.3321, population_m:  4,
    note: 'Smoke-season AQI spikes Jul-Sep from BC + Cascades wildfires.' },
  { name: 'Vancouver',      country: 'CA', region: 'North America', lat: 49.2827, lng: -123.1207, population_m:  3 },
  { name: 'Toronto',        country: 'CA', region: 'North America', lat: 43.6532, lng: -79.3832, population_m:  6 },
  { name: 'Mexico City',    country: 'MX', region: 'North America', lat: 19.4326, lng: -99.1332, population_m: 22,
    note: 'High-altitude basin still struggles with ozone despite catalytic-converter rollouts.' },
  { name: 'São Paulo',      country: 'BR', region: 'South America', lat: -23.5505, lng: -46.6333, population_m: 22 },
  { name: 'Rio de Janeiro', country: 'BR', region: 'South America', lat: -22.9068, lng: -43.1729, population_m: 13 },
  { name: 'Buenos Aires',   country: 'AR', region: 'South America', lat: -34.6037, lng: -58.3816, population_m: 16 },
  { name: 'Lima',           country: 'PE', region: 'South America', lat: -12.0464, lng: -77.0428, population_m: 11 },
  { name: 'Bogotá',         country: 'CO', region: 'South America', lat: 4.7110, lng:  -74.0721, population_m: 11 },
  { name: 'Santiago',       country: 'CL', region: 'South America', lat: -33.4489, lng: -70.6693, population_m:  7,
    note: 'Andean basin geography traps pollution in winter; episodes can match Asian megacities.' },

  // ── Oceania ──
  { name: 'Sydney',         country: 'AU', region: 'Asia-Pacific', lat: -33.8688, lng: 151.2093, population_m:  5,
    note: 'Black Summer 2019-20 wildfires gave it brief world-worst readings.' },
  { name: 'Melbourne',      country: 'AU', region: 'Asia-Pacific', lat: -37.8136, lng: 144.9631, population_m:  5 },
  { name: 'Auckland',       country: 'NZ', region: 'Asia-Pacific', lat: -36.8485, lng: 174.7633, population_m:  1 },
];

interface CityReading {
  name: string; country: string; region: string; lat: number; lng: number;
  population_m?: number; note?: string;
  pm25: number | null;
  pm10: number | null;
  us_aqi: number | null;
  european_aqi: number | null;
  no2: number | null;
  so2: number | null;
  ozone: number | null;
  co: number | null;
  category: 'good' | 'moderate' | 'usg' | 'unhealthy' | 'very-unhealthy' | 'hazardous' | 'unknown';
  dominant: string | null;
  measured_at: string | null;
  error?: string;
}

function aqiCategory(aqi: number | null): CityReading['category'] {
  if (aqi == null) return 'unknown';
  if (aqi <= 50)  return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'usg';                 // unhealthy for sensitive groups
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very-unhealthy';
  return 'hazardous';
}

// Naive pick-the-worst-pollutant heuristic. Real CAMS dominant-pollutant logic
// is messier; this is sufficient for popup colour.
function dominantPollutant(r: { pm25: number | null; pm10: number | null; no2: number | null; so2: number | null; ozone: number | null }): string | null {
  // WHO 2021 annual targets — distance above target = relative load
  const targets = { pm25: 5, pm10: 15, no2: 10, so2: 40, ozone: 60 };
  const scored = Object.entries(targets)
    .map(([k, t]) => ({ k, ratio: (r as any)[k] != null ? (r as any)[k] / t : 0 }))
    .filter(x => x.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio);
  return scored[0]?.k ?? null;
}

async function fetchCity(city: City): Promise<CityReading> {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', String(city.lat));
  url.searchParams.set('longitude', String(city.lng));
  url.searchParams.set('current', 'pm2_5,pm10,european_aqi,us_aqi,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone');
  url.searchParams.set('timezone', 'GMT');
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return { ...city, pm25: null, pm10: null, us_aqi: null, european_aqi: null, no2: null, so2: null, ozone: null, co: null, category: 'unknown', dominant: null, measured_at: null, error: `HTTP ${res.status}` };
    }
    const j = await res.json();
    const c = j.current || {};
    const out: CityReading = {
      ...city,
      pm25: typeof c.pm2_5 === 'number' ? c.pm2_5 : null,
      pm10: typeof c.pm10 === 'number' ? c.pm10 : null,
      us_aqi: typeof c.us_aqi === 'number' ? c.us_aqi : null,
      european_aqi: typeof c.european_aqi === 'number' ? c.european_aqi : null,
      no2: typeof c.nitrogen_dioxide === 'number' ? c.nitrogen_dioxide : null,
      so2: typeof c.sulphur_dioxide === 'number' ? c.sulphur_dioxide : null,
      ozone: typeof c.ozone === 'number' ? c.ozone : null,
      co: typeof c.carbon_monoxide === 'number' ? c.carbon_monoxide : null,
      category: 'unknown',
      dominant: null,
      measured_at: c.time || null,
    };
    out.category = aqiCategory(out.us_aqi);
    out.dominant = dominantPollutant({ pm25: out.pm25, pm10: out.pm10, no2: out.no2, so2: out.so2, ozone: out.ozone });
    return out;
  } catch (e) {
    return { ...city, pm25: null, pm10: null, us_aqi: null, european_aqi: null, no2: null, so2: null, ozone: null, co: null, category: 'unknown', dominant: null, measured_at: null, error: e instanceof Error ? e.message : String(e) };
  }
}

interface Bundle { cities: CityReading[]; total: number; built_at: string; }

export async function GET() {
  const fresh = await cacheRead<Bundle>(CACHE_KEY, TTL_MS);
  if (fresh) {
    return NextResponse.json(
      { ...fresh.data, cached: true, age_seconds: Math.floor(fresh.age_ms / 1000) },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } },
    );
  }

  try {
    const cities: CityReading[] = [];
    for (let i = 0; i < CITIES.length; i += BATCH) {
      const batch = CITIES.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(fetchCity));
      cities.push(...results);
      if (i + BATCH < CITIES.length) await new Promise(r => setTimeout(r, 150));
    }
    const erroredCount = cities.filter(c => c.error).length;

    // If almost every city failed, fall back to stale rather than poisoning.
    if (erroredCount > cities.length / 2) {
      const stale = await cacheReadStale<Bundle>(CACHE_KEY);
      if (stale) {
        return NextResponse.json(
          { ...stale.data, cached: true, stale: true, age_seconds: Math.floor(stale.age_ms / 1000), error_count: erroredCount },
          { headers: { 'Cache-Control': 'public, s-maxage=60' } },
        );
      }
    }

    const bundle: Bundle = { cities, total: cities.length, built_at: new Date().toISOString() };
    await cacheWrite(CACHE_KEY, bundle);
    return NextResponse.json(
      { ...bundle, cached: false, error_count: erroredCount },
      { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } },
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
      { error: 'Failed to fetch air quality', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
