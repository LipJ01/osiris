import { NextResponse } from 'next/server';

/**
 * OSIRIS — Air Cargo Hubs
 *
 * Curated dataset of the world's largest cargo-handling airports + dedicated
 * integrator super-hubs (FedEx Memphis, UPS Worldport, DHL Leipzig, etc.).
 *
 * Volumes are 2023-2024 annual cargo tonnage from ACI World rankings + each
 * airport's own filings.
 */

type Operator = 'integrator' | 'multi-carrier' | 'transshipment';
interface Hub {
  name: string;
  city: string;
  country: string;
  region: string;
  iata: string;
  lat: number;
  lng: number;
  cargo_tonnes_yr: number;     // metric tonnes
  primary_operator: string;
  operator_type: Operator;
  notes: string;
}

const HUBS: Hub[] = [
  // ── #1-10 by tonnage (2023-2024) ──
  { name: 'Hong Kong International (HKG)', city: 'Hong Kong', country: 'HK', region: 'Asia-Pacific',
    iata: 'HKG', lat: 22.31, lng: 113.91, cargo_tonnes_yr: 4_330_000,
    primary_operator: 'Cathay Pacific Cargo + multi', operator_type: 'multi-carrier',
    notes: 'World #1 cargo airport every year since 2010. Bridges Pearl River Delta manufacturing to global markets.' },
  { name: 'Memphis International (MEM)', city: 'Memphis, TN', country: 'US', region: 'North America',
    iata: 'MEM', lat: 35.04, lng: -89.98, cargo_tonnes_yr: 4_050_000,
    primary_operator: 'FedEx Express', operator_type: 'integrator',
    notes: 'FedEx SuperHub. ~150 inbound flights nightly converge for sorting then redepart. Used to be world #1 before HKG.' },
  { name: 'Shanghai Pudong (PVG)', city: 'Shanghai', country: 'CN', region: 'Asia-Pacific',
    iata: 'PVG', lat: 31.14, lng: 121.81, cargo_tonnes_yr: 3_440_000,
    primary_operator: 'China Cargo + Cainiao + multi', operator_type: 'multi-carrier',
    notes: 'Main air gateway for Chinese exports. Alibaba Cainiao has built a parallel hub here for cross-border e-commerce.' },
  { name: 'Ted Stevens Anchorage (ANC)', city: 'Anchorage, AK', country: 'US', region: 'North America',
    iata: 'ANC', lat: 61.17, lng: -150.02, cargo_tonnes_yr: 3_200_000,
    primary_operator: 'multi (FedEx, UPS, Cargolux, Korean Air, ANA)', operator_type: 'transshipment',
    notes: 'Trans-Pacific transshipment point — geographic sweet spot for Asia↔NorthAmerica freighters. Almost zero local origin/destination cargo.' },
  { name: 'Incheon International (ICN)', city: 'Seoul', country: 'KR', region: 'Asia-Pacific',
    iata: 'ICN', lat: 37.46, lng: 126.44, cargo_tonnes_yr: 2_900_000,
    primary_operator: 'Korean Air Cargo + Asiana', operator_type: 'multi-carrier',
    notes: 'NE Asia hub. Korean Air is the world\'s largest international cargo carrier by FTK.' },
  { name: 'Louisville Muhammad Ali (SDF)', city: 'Louisville, KY', country: 'US', region: 'North America',
    iata: 'SDF', lat: 38.18, lng: -85.74, cargo_tonnes_yr: 2_870_000,
    primary_operator: 'UPS Worldport', operator_type: 'integrator',
    notes: 'UPS\'s global super-hub. 416 conveyor miles. Sort capacity 416k packages/hour.' },
  { name: 'Taipei Taoyuan (TPE)', city: 'Taipei', country: 'TW', region: 'Asia-Pacific',
    iata: 'TPE', lat: 25.08, lng: 121.23, cargo_tonnes_yr: 2_310_000,
    primary_operator: 'China Airlines Cargo + EVA Air', operator_type: 'multi-carrier',
    notes: 'Semiconductor + electronics gateway. TSMC chip exports heavily air-freighted.' },
  { name: 'Dubai International (DXB) + DWC', city: 'Dubai', country: 'AE', region: 'Middle East',
    iata: 'DXB', lat: 25.25, lng: 55.36, cargo_tonnes_yr: 2_290_000,
    primary_operator: 'Emirates SkyCargo + DHL', operator_type: 'multi-carrier',
    notes: 'Combined DXB+DWC volume. Emirates SkyCargo operates ~265 widebody freighter routings/week from here.' },
  { name: 'Doha Hamad (DOH)', city: 'Doha', country: 'QA', region: 'Middle East',
    iata: 'DOH', lat: 25.27, lng: 51.61, cargo_tonnes_yr: 2_150_000,
    primary_operator: 'Qatar Airways Cargo', operator_type: 'multi-carrier',
    notes: 'Qatar Airways Cargo is world\'s #2 international cargo carrier. Built-out cargo facilities to handle 4Mt by 2030.' },
  { name: 'Guangzhou Baiyun (CAN)', city: 'Guangzhou', country: 'CN', region: 'Asia-Pacific',
    iata: 'CAN', lat: 23.39, lng: 113.31, cargo_tonnes_yr: 2_030_000,
    primary_operator: 'China Southern Cargo + FedEx (Asia-Pacific hub)', operator_type: 'multi-carrier',
    notes: 'FedEx\'s Asia-Pacific super-hub (opened 2009). Direct nightly flights to Memphis.' },

  // ── European hubs ──
  { name: 'Leipzig/Halle (LEJ)', city: 'Leipzig', country: 'DE', region: 'Europe',
    iata: 'LEJ', lat: 51.42, lng: 12.24, cargo_tonnes_yr: 1_330_000,
    primary_operator: 'DHL Aviation European hub', operator_type: 'integrator',
    notes: 'DHL\'s European super-hub since 2008. 24h ops + central location made it dominate Frankfurt for express cargo.' },
  { name: 'Frankfurt (FRA)', city: 'Frankfurt', country: 'DE', region: 'Europe',
    iata: 'FRA', lat: 50.03, lng: 8.56, cargo_tonnes_yr: 1_960_000,
    primary_operator: 'Lufthansa Cargo + multi', operator_type: 'multi-carrier',
    notes: '#1 cargo airport in Europe by total tonnage (belly + dedicated). Lufthansa Cargo HQ.' },
  { name: 'Liège (LGG)', city: 'Liège', country: 'BE', region: 'Europe',
    iata: 'LGG', lat: 50.64, lng: 5.44, cargo_tonnes_yr: 1_000_000,
    primary_operator: 'Alibaba Cainiao + multi-freighter', operator_type: 'multi-carrier',
    notes: 'Europe\'s fastest-growing cargo airport. Alibaba\'s eHub for EU e-commerce. 24h ops with minimal noise restrictions.' },
  { name: 'Amsterdam Schiphol (AMS)', city: 'Amsterdam', country: 'NL', region: 'Europe',
    iata: 'AMS', lat: 52.31, lng: 4.76, cargo_tonnes_yr: 1_470_000,
    primary_operator: 'KLM Cargo + multi', operator_type: 'multi-carrier',
    notes: 'Major European pharma + flowers hub. Royal FloraHolland transships ~10M flowers/day here.' },
  { name: 'Paris CDG', city: 'Paris', country: 'FR', region: 'Europe',
    iata: 'CDG', lat: 49.01, lng: 2.55, cargo_tonnes_yr: 1_960_000,
    primary_operator: 'Air France-KLM Cargo + FedEx EU hub', operator_type: 'multi-carrier',
    notes: 'FedEx\'s European hub (since 1999). FAFL HQ.' },
  { name: 'London Heathrow (LHR)', city: 'London', country: 'GB', region: 'Europe',
    iata: 'LHR', lat: 51.47, lng: -0.45, cargo_tonnes_yr: 1_350_000,
    primary_operator: 'IAG Cargo + multi', operator_type: 'multi-carrier',
    notes: 'Mostly belly-cargo from passenger widebodies. UK\'s primary air gateway despite no dedicated freighter facilities.' },

  // ── Other notable ──
  { name: 'Singapore Changi (SIN)', city: 'Singapore', country: 'SG', region: 'Asia-Pacific',
    iata: 'SIN', lat: 1.36, lng: 103.99, cargo_tonnes_yr: 1_870_000,
    primary_operator: 'Singapore Airlines Cargo + multi', operator_type: 'multi-carrier',
    notes: 'SE Asia gateway. Cathay Pacific tested LHR-SIN-HKG triangulation, then dropped.' },
  { name: 'Tokyo Narita (NRT)', city: 'Tokyo', country: 'JP', region: 'Asia-Pacific',
    iata: 'NRT', lat: 35.77, lng: 140.39, cargo_tonnes_yr: 2_500_000,
    primary_operator: 'JAL Cargo + ANA + multi', operator_type: 'multi-carrier',
    notes: 'Japan\'s primary air freight gateway. JAL discontinued freighter ops 2010 but air cargo recovered as belly-only.' },
  { name: 'Beijing Capital (PEK) + Daxing (PKX)', city: 'Beijing', country: 'CN', region: 'Asia-Pacific',
    iata: 'PEK', lat: 40.08, lng: 116.58, cargo_tonnes_yr: 1_960_000,
    primary_operator: 'Air China Cargo + multi', operator_type: 'multi-carrier',
    notes: 'Combined PEK + PKX freight. Air China Cargo is China\'s largest cargo airline.' },
  { name: 'Miami International (MIA)', city: 'Miami, FL', country: 'US', region: 'North America',
    iata: 'MIA', lat: 25.79, lng: -80.29, cargo_tonnes_yr: 2_490_000,
    primary_operator: 'multi (Atlas, Amerijet, LATAM Cargo, FedEx)', operator_type: 'multi-carrier',
    notes: 'Largest international air freight hub in Americas. Perishables (flowers, seafood, fruit) dominate inbound from S. America.' },
  { name: 'Cincinnati/Northern Kentucky (CVG)', city: 'Cincinnati, OH', country: 'US', region: 'North America',
    iata: 'CVG', lat: 39.05, lng: -84.66, cargo_tonnes_yr: 1_240_000,
    primary_operator: 'DHL Americas super-hub + Amazon Air HQ', operator_type: 'integrator',
    notes: 'DHL Americas hub (opened 2009 replacing Wilmington). Amazon Air opened its prime air hub here in 2021.' },
  { name: 'Bangkok (BKK)', city: 'Bangkok', country: 'TH', region: 'Asia-Pacific',
    iata: 'BKK', lat: 13.69, lng: 100.75, cargo_tonnes_yr: 1_320_000,
    primary_operator: 'Thai Airways Cargo + multi', operator_type: 'multi-carrier',
    notes: 'SE Asia transshipment for European express carriers. Major automotive parts hub.' },
];

export async function GET() {
  const total_tonnes = HUBS.reduce((a, h) => a + h.cargo_tonnes_yr, 0);
  const maxTonnes = HUBS.reduce((m, h) => Math.max(m, h.cargo_tonnes_yr), 0) || 1;
  const hubs = HUBS.map(h => ({
    ...h,
    intensity: Math.min(1, Math.sqrt(h.cargo_tonnes_yr / maxTonnes)),
  }));
  return NextResponse.json({
    hubs, total: HUBS.length, total_tonnes_yr: total_tonnes,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
