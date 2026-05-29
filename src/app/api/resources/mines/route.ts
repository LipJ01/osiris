import { NextResponse } from 'next/server';

/**
 * OSIRIS — Tier-1 Mines
 *
 * Curated dataset of the world's largest producing mines, weighted toward
 * critical-mineral and strategic supply-chain plays. Numbers are 2023-2024
 * annual figures from company reports, USGS Mineral Yearbook, S&P Capital IQ
 * summaries, and government statistical bureaus. Static — production at this
 * scale shifts on quarterly time-frames, not minute-to-minute.
 *
 *   commodity   primary product
 *   secondary   meaningful co-product (or null)
 *   production  short prose: tonnes/year of primary commodity
 *   revenue_musd  approx annual mine-mouth revenue in USD millions
 *   ore_grade   short prose
 *   life_years  remaining mine life in years (approx)
 */

type Commodity = 'copper' | 'gold' | 'iron' | 'lithium' | 'nickel' | 'coal' | 'rare-earth' | 'uranium' | 'diamond' | 'silver' | 'bauxite' | 'cobalt' | 'platinum';

interface Mine {
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  commodity: Commodity;
  secondary?: Commodity | null;
  production: string;
  revenue_musd: number;
  ore_grade: string;
  life_years: number;
  operator: string;
  notes: string;
}

const MINES: Mine[] = [
  // ── Copper (largest by global value) ──
  { name: 'Escondida', country: 'CL', region: 'South America', lat: -24.27, lng: -69.07,
    commodity: 'copper', production: '1.05 Mt Cu / yr', revenue_musd: 10500,
    ore_grade: '0.6% Cu (declining)', life_years: 30, operator: 'BHP + Rio Tinto',
    notes: 'Single largest copper mine on Earth. Atacama Desert. Open-pit + sulphide leach.' },
  { name: 'Collahuasi', country: 'CL', region: 'South America', lat: -20.96, lng: -68.71,
    commodity: 'copper', production: '560 kt Cu / yr', revenue_musd: 5500,
    ore_grade: '0.9% Cu', life_years: 50, operator: 'Anglo American + Glencore',
    notes: '4,400 m altitude in the Andes — third-largest copper mine.' },
  { name: 'Cerro Verde', country: 'PE', region: 'South America', lat: -16.53, lng: -71.60,
    commodity: 'copper', secondary: 'silver', production: '450 kt Cu / yr', revenue_musd: 4500,
    ore_grade: '0.4% Cu', life_years: 30, operator: 'Freeport-McMoRan',
    notes: 'Largest copper producer in Peru. Expanded 3× via 2015 concentrator build.' },
  { name: 'Antamina', country: 'PE', region: 'South America', lat: -9.55, lng: -77.05,
    commodity: 'copper', secondary: 'silver', production: '440 kt Cu / yr', revenue_musd: 4200,
    ore_grade: '1.0% Cu + 1.1% Zn', life_years: 15, operator: 'BHP + Glencore + Teck + Mitsubishi',
    notes: 'Polymetallic — also zinc, molybdenum, silver, lead. Andes at 4,300 m.' },
  { name: 'Kamoa-Kakula', country: 'CD', region: 'Africa', lat: -10.75, lng: 25.30,
    commodity: 'copper', production: '400 kt Cu / yr (ramping)', revenue_musd: 4000,
    ore_grade: '5.5% Cu (world\'s highest-grade large mine)', life_years: 40,
    operator: 'Ivanhoe + Zijin', notes: 'DRC. Fastest-growing major copper mine; targeting 600 kt/y.' },
  { name: 'Grasberg', country: 'ID', region: 'Asia-Pacific', lat: -4.06, lng: 137.11,
    commodity: 'copper', secondary: 'gold', production: '770 kt Cu / yr + 50 t Au',
    revenue_musd: 9000, ore_grade: '0.9% Cu + 0.8 g/t Au', life_years: 17,
    operator: 'Freeport-McMoRan + PT-FI', notes: 'Largest single gold reserve on Earth; transitioning open-pit → block-cave.' },
  { name: 'Oyu Tolgoi', country: 'MN', region: 'Asia-Pacific', lat: 43.00, lng: 106.85,
    commodity: 'copper', secondary: 'gold', production: '200 kt Cu / yr (ramping to 500)',
    revenue_musd: 3000, ore_grade: '0.85% Cu + 0.35 g/t Au', life_years: 90,
    operator: 'Rio Tinto + Mongolia Govt', notes: 'Mongolia\'s largest project. Block-cave underground.' },

  // ── Gold ──
  { name: 'Carlin Trend (Nevada)', country: 'US', region: 'North America', lat: 40.95, lng: -116.30,
    commodity: 'gold', production: '110 t Au / yr (combined operations)',
    revenue_musd: 7700, ore_grade: 'varies — open pit 1-2 g/t, UG 8-10 g/t',
    life_years: 15, operator: 'Nevada Gold Mines (Barrick + Newmont JV)',
    notes: 'Largest gold-producing district in North America.' },
  { name: 'Muruntau', country: 'UZ', region: 'Asia-Pacific', lat: 41.50, lng: 64.55,
    commodity: 'gold', production: '70 t Au / yr', revenue_musd: 4900,
    ore_grade: '2.4 g/t Au', life_years: 30, operator: 'Navoi Mining',
    notes: 'Single deepest open-pit gold mine. Kyzylkum Desert.' },
  { name: 'Lihir', country: 'PG', region: 'Asia-Pacific', lat: -3.13, lng: 152.64,
    commodity: 'gold', production: '23 t Au / yr', revenue_musd: 1600,
    ore_grade: '2.5 g/t Au (in active volcano caldera)', life_years: 25,
    operator: 'Newmont', notes: 'Mining inside the Luise Caldera; ore mined hot, dewatered continuously.' },
  { name: 'Olimpiada', country: 'RU', region: 'Russia & Caspian', lat: 59.40, lng: 92.50,
    commodity: 'gold', production: '40 t Au / yr', revenue_musd: 2800,
    ore_grade: '3.0 g/t Au', life_years: 25, operator: 'Polyus',
    notes: 'Russia\'s largest gold mine. Krasnoyarsk Krai, central Siberia.' },
  { name: 'Mponeng', country: 'ZA', region: 'Africa', lat: -26.42, lng: 27.42,
    commodity: 'gold', production: '7 t Au / yr', revenue_musd: 500,
    ore_grade: '8 g/t Au', life_years: 8, operator: 'Harmony Gold',
    notes: 'Deepest mine on Earth at >4 km. Witwatersrand Basin.' },

  // ── Iron Ore ──
  { name: 'Carajás', country: 'BR', region: 'South America', lat: -6.05, lng: -50.18,
    commodity: 'iron', production: '180 Mt Fe / yr', revenue_musd: 18000,
    ore_grade: '67% Fe (highest-grade major hematite)', life_years: 50,
    operator: 'Vale', notes: 'Largest iron ore complex on Earth. Amazon rainforest.' },
  { name: 'Pilbara — Mt Whaleback', country: 'AU', region: 'Asia-Pacific', lat: -23.36, lng: 119.71,
    commodity: 'iron', production: '85 Mt Fe / yr', revenue_musd: 8500,
    ore_grade: '62% Fe', life_years: 25, operator: 'BHP',
    notes: 'Largest single-pit iron mine in the world.' },
  { name: 'Pilbara — Hamersley hub', country: 'AU', region: 'Asia-Pacific', lat: -22.50, lng: 117.80,
    commodity: 'iron', production: '270 Mt Fe / yr (hub-wide)', revenue_musd: 27000,
    ore_grade: '61% Fe', life_years: 30, operator: 'Rio Tinto',
    notes: 'Rio\'s 16 connected operations form the world\'s largest iron ore system.' },
  { name: 'Sishen', country: 'ZA', region: 'Africa', lat: -27.78, lng: 22.99,
    commodity: 'iron', production: '30 Mt Fe / yr', revenue_musd: 3000,
    ore_grade: '64% Fe', life_years: 13, operator: 'Kumba (Anglo American)',
    notes: 'Northern Cape; rail-bound to Saldanha Bay.' },
  { name: 'Kursk Magnetic Anomaly', country: 'RU', region: 'Russia & Caspian', lat: 51.40, lng: 36.20,
    commodity: 'iron', production: '95 Mt Fe / yr (combined)', revenue_musd: 8000,
    ore_grade: '36% Fe (banded iron formation)', life_years: 80,
    operator: 'Metalloinvest + Severstal', notes: 'Largest iron-ore deposit in the world by reserves.' },

  // ── Lithium ──
  { name: 'Greenbushes', country: 'AU', region: 'Asia-Pacific', lat: -33.85, lng: 116.06,
    commodity: 'lithium', production: '1.5 Mt spodumene / yr', revenue_musd: 4500,
    ore_grade: '2.0% Li2O (highest-grade hard-rock)', life_years: 25,
    operator: 'IGO + Albemarle + Tianqi', notes: 'World\'s largest lithium operation; supplies ~40% of hard-rock lithium.' },
  { name: 'Salar de Atacama', country: 'CL', region: 'South America', lat: -23.50, lng: -68.20,
    commodity: 'lithium', production: '200 kt LCE / yr (basin)', revenue_musd: 4000,
    ore_grade: 'brine ~1,800 ppm Li', life_years: 50, operator: 'SQM + Albemarle',
    notes: 'Highest-grade lithium brine. Chile\'s Lithium Triangle anchor.' },
  { name: 'Salar de Uyuni / Lipez', country: 'BO', region: 'South America', lat: -20.13, lng: -67.50,
    commodity: 'lithium', production: '5 kt LCE / yr (pilot)', revenue_musd: 100,
    ore_grade: 'brine ~530 ppm Li', life_years: 100,
    operator: 'YLB (state)', notes: 'Largest known lithium reserves; production stuck at pilot scale.' },

  // ── Coal ──
  { name: 'Bowen Basin', country: 'AU', region: 'Asia-Pacific', lat: -22.50, lng: 148.00,
    commodity: 'coal', production: '210 Mt coal / yr (basin)', revenue_musd: 35000,
    ore_grade: 'Coking + thermal mix', life_years: 60,
    operator: 'multi (BHP, Glencore, Peabody, Whitehaven)', notes: 'World\'s largest coking-coal supplier. Exports via Hay Point/Gladstone.' },
  { name: 'North Antelope Rochelle', country: 'US', region: 'North America', lat: 43.74, lng: -105.30,
    commodity: 'coal', production: '60 Mt thermal coal / yr', revenue_musd: 800,
    ore_grade: '8,800 BTU/lb sub-bituminous', life_years: 15, operator: 'Peabody',
    notes: 'Largest US coal mine; Wyoming\'s Powder River Basin.' },
  { name: 'Haerwusu', country: 'CN', region: 'Asia-Pacific', lat: 39.78, lng: 111.10,
    commodity: 'coal', production: '35 Mt thermal coal / yr', revenue_musd: 1700,
    ore_grade: '4,500 BTU/lb lignite/sub-bituminous', life_years: 80,
    operator: 'Shenhua Group', notes: 'Inner Mongolia. Part of China\'s largest coal complex.' },

  // ── Nickel & Cobalt ──
  { name: 'Norilsk', country: 'RU', region: 'Russia & Caspian', lat: 69.34, lng: 88.20,
    commodity: 'nickel', secondary: 'platinum', production: '215 kt Ni + 90 kt Pd / yr',
    revenue_musd: 16000, ore_grade: '1.0% Ni + 7 g/t PGE', life_years: 40,
    operator: 'Nornickel', notes: 'Above Arctic Circle. World\'s top palladium + nickel producer.' },
  { name: 'Sudbury Basin', country: 'CA', region: 'North America', lat: 46.61, lng: -81.05,
    commodity: 'nickel', secondary: 'copper', production: '80 kt Ni + 80 kt Cu / yr',
    revenue_musd: 3200, ore_grade: '1.5% Ni + 1.0% Cu', life_years: 50,
    operator: 'Vale + Glencore', notes: 'Meteorite-impact deposit. 130 years of production and counting.' },
  { name: 'Mutanda', country: 'CD', region: 'Africa', lat: -10.96, lng: 25.56,
    commodity: 'cobalt', secondary: 'copper', production: '30 kt Co + 200 kt Cu / yr',
    revenue_musd: 3000, ore_grade: '0.7% Co + 3% Cu', life_years: 25,
    operator: 'Glencore', notes: 'Largest single cobalt mine. Katanga DRC.' },

  // ── Diamond ──
  { name: 'Jwaneng', country: 'BW', region: 'Africa', lat: -24.55, lng: 24.69,
    commodity: 'diamond', production: '11 Mct / yr', revenue_musd: 2700,
    ore_grade: '$200+/ct (world\'s highest-value mine)', life_years: 12,
    operator: 'Debswana (De Beers + Botswana Govt)', notes: 'Highest revenue diamond mine on Earth.' },
  { name: 'Mirny / Udachny', country: 'RU', region: 'Russia & Caspian', lat: 62.55, lng: 113.93,
    commodity: 'diamond', production: '14 Mct / yr (combined)', revenue_musd: 2800,
    ore_grade: 'varies by pipe', life_years: 30, operator: 'Alrosa',
    notes: 'Yakutia. Mirny pit visible from space.' },

  // ── Uranium ──
  { name: 'Cigar Lake', country: 'CA', region: 'North America', lat: 58.05, lng: -104.49,
    commodity: 'uranium', production: '7,000 t U3O8 / yr', revenue_musd: 700,
    ore_grade: '14% U3O8 (highest grade globally)', life_years: 10,
    operator: 'Cameco + Orano', notes: 'Athabasca Basin. World\'s top uranium mine.' },
  { name: 'Olympic Dam', country: 'AU', region: 'Asia-Pacific', lat: -30.44, lng: 136.87,
    commodity: 'copper', secondary: 'uranium', production: '210 kt Cu + 3,300 t U3O8 / yr',
    revenue_musd: 2400, ore_grade: '1.8% Cu + 0.05% U3O8', life_years: 100,
    operator: 'BHP', notes: 'Polymetallic supergiant: copper, uranium, gold, silver. South Australia.' },

  // ── Rare Earths ──
  { name: 'Bayan Obo', country: 'CN', region: 'Asia-Pacific', lat: 41.78, lng: 109.97,
    commodity: 'rare-earth', secondary: 'iron', production: '105 kt REO + 38 Mt Fe / yr',
    revenue_musd: 2200, ore_grade: '5% REO + 35% Fe', life_years: 80,
    operator: 'Baotou Steel (China Northern REE)', notes: 'Inner Mongolia. ~38% of world REO production.' },
  { name: 'Mountain Pass', country: 'US', region: 'North America', lat: 35.48, lng: -115.53,
    commodity: 'rare-earth', production: '42 kt REO / yr', revenue_musd: 250,
    ore_grade: '7% REO (bastnaesite)', life_years: 20,
    operator: 'MP Materials', notes: 'Only operating REE mine in the western hemisphere.' },

  // ── Bauxite ──
  { name: 'Weipa', country: 'AU', region: 'Asia-Pacific', lat: -12.65, lng: 141.87,
    commodity: 'bauxite', production: '36 Mt bauxite / yr', revenue_musd: 1500,
    ore_grade: '52% Al2O3', life_years: 25, operator: 'Rio Tinto',
    notes: 'Cape York. World\'s largest bauxite operation.' },
  { name: 'CBG (Sangaredi)', country: 'GN', region: 'Africa', lat: 11.13, lng: -13.78,
    commodity: 'bauxite', production: '18 Mt bauxite / yr', revenue_musd: 800,
    ore_grade: '60% Al2O3 (highest-grade major deposit)', life_years: 50,
    operator: 'CBG (Halco + Govt)', notes: 'Guinea hosts ~25% of world bauxite reserves; CBG is the marquee mine.' },

  // ── Silver (large primary only — most silver is co-product) ──
  { name: 'Fresnillo / Saucito', country: 'MX', region: 'North America', lat: 23.21, lng: -102.86,
    commodity: 'silver', production: '700 t Ag / yr (combined)', revenue_musd: 700,
    ore_grade: '200 g/t Ag', life_years: 15, operator: 'Fresnillo plc',
    notes: 'Zacatecas state. Largest primary silver producer globally.' },
];

export async function GET() {
  // Marker size driven by revenue — apples-to-apples across commodities.
  const maxRev = MINES.reduce((m, x) => Math.max(m, x.revenue_musd), 0) || 1;
  const mines = MINES.map(m => ({
    ...m,
    intensity: Math.min(1, m.revenue_musd / maxRev),
  }));

  const byCommodity: Record<string, number> = {};
  for (const m of MINES) byCommodity[m.commodity] = (byCommodity[m.commodity] || 0) + 1;
  const totalRevenueMusd = MINES.reduce((a, m) => a + m.revenue_musd, 0);

  return NextResponse.json({
    mines,
    total: MINES.length,
    by_commodity: byCommodity,
    total_revenue_musd: totalRevenueMusd,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
