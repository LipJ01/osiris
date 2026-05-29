import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Oil Refineries (downstream)
 *
 * Curated dataset of significant crude-oil refineries globally. Capacities
 * are nameplate distillation throughput in thousand barrels per day (kbpd),
 * sourced from operator filings, EIA, OPEC, and OGJ refining surveys (2024).
 *
 * Distinct from upstream `oil-gas` route: these are processing plants, not
 * production sites. Marker style is cyan rings vs. oil-gas amber.
 */

type RefStatus = 'operating' | 'restructuring' | 'idle' | 'closing';

interface Refinery {
  name: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  capacity_kbpd: number;
  operator: string;
  status: RefStatus;
  // Nelson Complexity Index — higher = more upgrading capacity. Most simple
  // refineries are 4-6, deep-conversion complex refineries are 10-14+.
  nelson: number | null;
  notes: string;
}

const REFINERIES: Refinery[] = [
  // ── Mega-refineries (>800 kbpd) ──
  { name: 'Jamnagar Refinery Complex', city: 'Jamnagar', country: 'IN', region: 'Asia-Pacific',
    lat: 22.34, lng: 69.84, capacity_kbpd: 1240, operator: 'Reliance Industries',
    status: 'operating', nelson: 14.0,
    notes: 'Largest refining complex on Earth (two adjacent refineries). Exports diesel + jet to Europe/US.' },
  { name: 'SK Energy Ulsan', city: 'Ulsan', country: 'KR', region: 'Asia-Pacific',
    lat: 35.50, lng: 129.39, capacity_kbpd: 840, operator: 'SK Energy',
    status: 'operating', nelson: 9.4,
    notes: 'Second-largest single-site refinery globally. Integrated with petrochemicals.' },
  { name: 'GS Caltex Yeosu', city: 'Yeosu', country: 'KR', region: 'Asia-Pacific',
    lat: 34.86, lng: 127.71, capacity_kbpd: 800, operator: 'GS Caltex',
    status: 'operating', nelson: 11.6, notes: 'Heavy-conversion refinery with major crackers.' },
  { name: 'Paraguaná Refining Complex', city: 'Punto Fijo', country: 'VE', region: 'South America',
    lat: 11.68, lng: -70.21, capacity_kbpd: 955, operator: 'PDVSA',
    status: 'restructuring', nelson: 7.5,
    notes: 'Was world\'s largest refinery; running at <30% capacity due to sanctions + decay.' },
  { name: 'Ras Tanura Refinery', city: 'Ras Tanura', country: 'SA', region: 'Middle East',
    lat: 26.66, lng: 50.16, capacity_kbpd: 550, operator: 'Saudi Aramco',
    status: 'operating', nelson: 7.8, notes: 'Aramco\'s flagship; co-located with the world\'s largest oil-export terminal.' },
  { name: 'Onsan Refinery (S-Oil)', city: 'Ulsan', country: 'KR', region: 'Asia-Pacific',
    lat: 35.42, lng: 129.34, capacity_kbpd: 670, operator: 'S-Oil (Saudi Aramco)',
    status: 'operating', nelson: 10.5, notes: 'Aramco\'s downstream foothold in South Korea.' },

  // ── United States ──
  { name: 'Motiva Port Arthur', city: 'Port Arthur, TX', country: 'US', region: 'North America',
    lat: 29.85, lng: -93.93, capacity_kbpd: 636, operator: 'Motiva (Saudi Aramco)',
    status: 'operating', nelson: 11.5, notes: 'Largest US refinery. Heavy/sour crude focus.' },
  { name: 'Marathon Galveston Bay', city: 'Texas City, TX', country: 'US', region: 'North America',
    lat: 29.38, lng: -94.92, capacity_kbpd: 631, operator: 'Marathon',
    status: 'operating', nelson: 12.4, notes: 'Acquired from BP; high-complexity Gulf Coast plant.' },
  { name: 'ExxonMobil Beaumont', city: 'Beaumont, TX', country: 'US', region: 'North America',
    lat: 30.07, lng: -94.10, capacity_kbpd: 609, operator: 'ExxonMobil',
    status: 'operating', nelson: 9.4, notes: 'Crude unit expansion completed 2023.' },
  { name: 'ExxonMobil Baytown', city: 'Baytown, TX', country: 'US', region: 'North America',
    lat: 29.74, lng: -95.00, capacity_kbpd: 587, operator: 'ExxonMobil',
    status: 'operating', nelson: 12.1, notes: 'Integrated refining + chemicals complex.' },
  { name: 'Marathon Garyville', city: 'Garyville, LA', country: 'US', region: 'North America',
    lat: 30.05, lng: -90.61, capacity_kbpd: 596, operator: 'Marathon',
    status: 'operating', nelson: 12.7, notes: 'Third-largest US refinery.' },
  { name: 'Phillips 66 Wood River', city: 'Roxana, IL', country: 'US', region: 'North America',
    lat: 38.86, lng: -90.10, capacity_kbpd: 356, operator: 'Phillips 66 + Cenovus',
    status: 'operating', nelson: 9.9, notes: 'Mid-continent hub, processes Canadian heavy crude.' },
  { name: 'Valero St. Charles', city: 'Norco, LA', country: 'US', region: 'North America',
    lat: 29.97, lng: -90.40, capacity_kbpd: 340, operator: 'Valero',
    status: 'operating', nelson: 13.4, notes: 'Among the highest-complexity refineries globally.' },

  // ── Europe ──
  { name: 'ExxonMobil Fawley', city: 'Southampton', country: 'GB', region: 'Europe',
    lat: 50.83, lng: -1.34, capacity_kbpd: 270, operator: 'ExxonMobil',
    status: 'operating', nelson: 8.4,
    notes: 'UK\'s largest refinery; supplies ~20% of UK transport fuels. Solent Estuary site.' },
  { name: 'Shell Pernis', city: 'Rotterdam', country: 'NL', region: 'Europe',
    lat: 51.88, lng: 4.39, capacity_kbpd: 404, operator: 'Shell',
    status: 'operating', nelson: 10.6, notes: 'Largest refinery in Europe; integrated with Rotterdam petrochemicals.' },
  { name: 'TotalEnergies Antwerp', city: 'Antwerp', country: 'BE', region: 'Europe',
    lat: 51.30, lng: 4.31, capacity_kbpd: 360, operator: 'TotalEnergies',
    status: 'operating', nelson: 9.4, notes: 'Largest in Belgium; deep-conversion with hydrocrackers.' },
  { name: 'Repsol Cartagena', city: 'Cartagena', country: 'ES', region: 'Europe',
    lat: 37.59, lng: -0.95, capacity_kbpd: 220, operator: 'Repsol',
    status: 'operating', nelson: 11.0, notes: 'Spain\'s most complex refinery; produces renewable diesel from 2024.' },
  { name: 'OMV Schwechat', city: 'Vienna', country: 'AT', region: 'Europe',
    lat: 48.13, lng: 16.49, capacity_kbpd: 210, operator: 'OMV',
    status: 'operating', nelson: 9.5, notes: 'Austria\'s only refinery; supplies central-European product markets.' },
  { name: 'PCK Schwedt', city: 'Schwedt', country: 'DE', region: 'Europe',
    lat: 53.07, lng: 14.27, capacity_kbpd: 233, operator: 'PCK Raffinerie',
    status: 'restructuring', nelson: 7.5,
    notes: 'Was Russian Druzhba pipeline endpoint; cut off Jan 2023, now imports via Rostock + Gdansk.' },

  // ── Asia (ex-Korea / India) ──
  { name: 'Sinopec Zhenhai', city: 'Ningbo', country: 'CN', region: 'Asia-Pacific',
    lat: 29.96, lng: 121.72, capacity_kbpd: 540, operator: 'Sinopec',
    status: 'operating', nelson: 9.8, notes: 'Largest Sinopec refinery; coastal Yangtze Delta megacomplex.' },
  { name: 'PetroChina Dalian', city: 'Dalian', country: 'CN', region: 'Asia-Pacific',
    lat: 38.93, lng: 121.61, capacity_kbpd: 410, operator: 'PetroChina',
    status: 'operating', nelson: 8.9, notes: 'Major NE-Asia exporter; sources Russian + Saudi crude.' },
  { name: 'Hengli Petrochemical Changxing', city: 'Dalian', country: 'CN', region: 'Asia-Pacific',
    lat: 39.36, lng: 121.59, capacity_kbpd: 400, operator: 'Hengli Group',
    status: 'operating', nelson: 12.2, notes: 'New private mega-refinery (commissioned 2019), feeds PX chain.' },
  { name: 'Indian Oil Panipat', city: 'Panipat', country: 'IN', region: 'Asia-Pacific',
    lat: 29.39, lng: 76.96, capacity_kbpd: 300, operator: 'Indian Oil',
    status: 'operating', nelson: 11.0, notes: 'Northern India anchor refinery; expanding to 500 kbpd.' },
  { name: 'JX Nippon Mizushima', city: 'Kurashiki', country: 'JP', region: 'Asia-Pacific',
    lat: 34.50, lng: 133.78, capacity_kbpd: 380, operator: 'ENEOS',
    status: 'operating', nelson: 9.2, notes: 'Japan\'s largest refinery, Inland Sea coast.' },

  // ── Middle East ──
  { name: 'Ruwais Refinery', city: 'Ruwais', country: 'AE', region: 'Middle East',
    lat: 24.10, lng: 52.74, capacity_kbpd: 922, operator: 'ADNOC',
    status: 'operating', nelson: 10.0, notes: 'Two co-located plants; flagship UAE downstream asset.' },
  { name: 'Jazan Refinery', city: 'Jazan', country: 'SA', region: 'Middle East',
    lat: 16.89, lng: 42.55, capacity_kbpd: 400, operator: 'Saudi Aramco',
    status: 'operating', nelson: 10.5, notes: 'Aramco\'s newest large refinery (commissioned 2020).' },
  { name: 'Abadan Refinery', city: 'Abadan', country: 'IR', region: 'Middle East',
    lat: 30.34, lng: 48.30, capacity_kbpd: 400, operator: 'NIORDC',
    status: 'operating', nelson: 6.0, notes: 'Oldest large refinery in the Middle East (1912); rebuilt after Iran-Iraq War.' },

  // ── Africa ──
  { name: 'Dangote Refinery', city: 'Lekki', country: 'NG', region: 'Africa',
    lat: 6.42, lng: 3.69, capacity_kbpd: 650, operator: 'Dangote Group',
    status: 'operating', nelson: 11.0,
    notes: 'Single-train megarefinery (commissioned 2024); ends Nigerian fuel imports.' },
  { name: 'Skikda Refinery', city: 'Skikda', country: 'DZ', region: 'Africa',
    lat: 36.89, lng: 6.90, capacity_kbpd: 335, operator: 'Sonatrach',
    status: 'operating', nelson: 6.5, notes: 'Algeria\'s largest; exports product to S. Europe.' },

  // ── Russia ──
  { name: 'Omsk Refinery', city: 'Omsk', country: 'RU', region: 'Russia & Caspian',
    lat: 54.94, lng: 73.34, capacity_kbpd: 440, operator: 'Gazprom Neft',
    status: 'operating', nelson: 9.8, notes: 'Largest Russian refinery; recently modernised.' },
  { name: 'Kirishi Refinery', city: 'Kirishi', country: 'RU', region: 'Russia & Caspian',
    lat: 59.45, lng: 32.04, capacity_kbpd: 420, operator: 'Surgutneftegas',
    status: 'operating', nelson: 7.0, notes: 'Supplies St. Petersburg + Baltic exports.' },

  // ── Latin America (ex-Venezuela) ──
  { name: 'Tula Refinery', city: 'Tula', country: 'MX', region: 'North America',
    lat: 20.06, lng: -99.34, capacity_kbpd: 315, operator: 'Pemex',
    status: 'operating', nelson: 7.0, notes: 'Mexico\'s largest operating refinery, north of Mexico City.' },
  { name: 'Dos Bocas (Olmeca)', city: 'Paraíso, Tabasco', country: 'MX', region: 'North America',
    lat: 18.43, lng: -93.20, capacity_kbpd: 340, operator: 'Pemex',
    status: 'operating', nelson: 8.5,
    notes: 'Mexico\'s newest refinery (2024); reduces gasoline import dependence.' },
];

export async function GET() {
  const maxCap = REFINERIES.reduce((m, x) => Math.max(m, x.capacity_kbpd), 0) || 1;
  const refineries = REFINERIES.map(r => ({
    ...r,
    intensity: Math.min(1, r.capacity_kbpd / maxCap),
  }));

  const totalCapacity = REFINERIES.reduce((a, r) => a + r.capacity_kbpd, 0);

  return NextResponse.json({
    refineries,
    total: REFINERIES.length,
    total_capacity_kbpd: totalCapacity,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
