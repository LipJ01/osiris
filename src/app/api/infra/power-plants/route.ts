import { NextResponse } from 'next/server';

/**
 * OSIRIS — Tier-1 Power Plants
 *
 * Curated dataset of the world's largest and/or most strategically important
 * electricity generators across all major technologies. Numbers are nameplate
 * capacity in MW from operator filings, IEA, EIA, WRI Global Power Plant
 * Database, and national grid operators (2023-2024).
 *
 *   type:     hydro | nuclear | coal | gas | solar | wind | geothermal | pumped-storage
 *   status:   operating | partial | construction | retired | disputed
 *   capacity_mw  nameplate generation capacity
 *   year      first commercial operation year (or planned)
 */

type GenType = 'hydro' | 'nuclear' | 'coal' | 'gas' | 'solar' | 'wind' | 'geothermal' | 'pumped-storage';
type PlantStatus = 'operating' | 'partial' | 'construction' | 'retired' | 'disputed';

interface Plant {
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  type: GenType;
  capacity_mw: number;
  operator: string;
  status: PlantStatus;
  year: number;
  notes: string;
}

const PLANTS: Plant[] = [
  // ── Hydroelectric (the giants) ──
  { name: 'Three Gorges Dam', country: 'CN', region: 'Asia-Pacific', lat: 30.823, lng: 111.003,
    type: 'hydro', capacity_mw: 22500, operator: 'China Three Gorges Corp.', status: 'operating', year: 2012,
    notes: 'Largest power station on Earth. 32 × 700 MW turbines on the Yangtze.' },
  { name: 'Itaipu Dam', country: 'BR/PY', region: 'South America', lat: -25.408, lng: -54.589,
    type: 'hydro', capacity_mw: 14000, operator: 'Itaipu Binacional', status: 'operating', year: 1984,
    notes: 'Brazil–Paraguay joint venture. World #2 by capacity, #1 by total energy ever generated.' },
  { name: 'Xiluodu Dam', country: 'CN', region: 'Asia-Pacific', lat: 28.255, lng: 103.638,
    type: 'hydro', capacity_mw: 13860, operator: 'China Three Gorges Corp.', status: 'operating', year: 2014,
    notes: 'Upper Jinsha River; arch dam 285 m tall.' },
  { name: 'Belo Monte Dam', country: 'BR', region: 'South America', lat: -3.114, lng: -51.794,
    type: 'hydro', capacity_mw: 11233, operator: 'Norte Energia', status: 'operating', year: 2019,
    notes: 'Xingu River, Amazon basin. Highly controversial — flooded indigenous lands.' },
  { name: 'Guri Dam (Simón Bolívar)', country: 'VE', region: 'South America', lat: 7.766, lng: -62.998,
    type: 'hydro', capacity_mw: 10235, operator: 'Corpoelec', status: 'partial', year: 1986,
    notes: 'Caroní River. Supplies ~70% of Venezuela; chronic outages since 2019 mismanagement.' },
  { name: 'Wudongde Dam', country: 'CN', region: 'Asia-Pacific', lat: 26.341, lng: 102.713,
    type: 'hydro', capacity_mw: 10200, operator: 'China Three Gorges Corp.', status: 'operating', year: 2021,
    notes: 'Newest mega-hydro on the Jinsha; double-curvature arch dam.' },
  { name: 'Grand Coulee', country: 'US', region: 'North America', lat: 47.957, lng: -118.982,
    type: 'hydro', capacity_mw: 6809, operator: 'US Bureau of Reclamation', status: 'operating', year: 1942,
    notes: 'Largest US power station. Columbia River; legacy WWII-era infrastructure.' },
  { name: 'Sayano-Shushenskaya', country: 'RU', region: 'Russia & Caspian', lat: 52.829, lng: 91.371,
    type: 'hydro', capacity_mw: 6400, operator: 'RusHydro', status: 'operating', year: 1989,
    notes: 'Yenisei River. Catastrophic 2009 accident killed 75; fully restored 2014.' },
  { name: 'Robert-Bourassa', country: 'CA', region: 'North America', lat: 53.787, lng: -77.441,
    type: 'hydro', capacity_mw: 5616, operator: 'Hydro-Québec', status: 'operating', year: 1981,
    notes: 'Underground powerhouse 137 m below surface. Largest in Canada.' },
  { name: 'Krasnoyarsk Dam', country: 'RU', region: 'Russia & Caspian', lat: 55.937, lng: 92.298,
    type: 'hydro', capacity_mw: 6000, operator: 'EuroSibEnergo', status: 'operating', year: 1972,
    notes: 'Soviet-era Yenisei dam, feeds aluminium smelters in Krasnoyarsk.' },
  { name: 'Aswan High Dam', country: 'EG', region: 'Africa', lat: 23.971, lng: 32.878,
    type: 'hydro', capacity_mw: 2100, operator: 'Egyptian Electricity Holding', status: 'operating', year: 1970,
    notes: 'Tames Nile flooding; Egypt\'s most strategically critical dam.' },
  { name: 'Grand Ethiopian Renaissance Dam', country: 'ET', region: 'Africa', lat: 11.215, lng: 35.093,
    type: 'hydro', capacity_mw: 5150, operator: 'Ethiopian Electric Power', status: 'partial', year: 2022,
    notes: 'Blue Nile. Africa\'s largest dam; flashpoint with Egypt over downstream flow.' },

  // ── Nuclear (power-gen, not weapons) ──
  { name: 'Kashiwazaki-Kariwa', country: 'JP', region: 'Asia-Pacific', lat: 37.428, lng: 138.602,
    type: 'nuclear', capacity_mw: 7965, operator: 'TEPCO', status: 'partial', year: 1985,
    notes: 'World\'s largest nuclear station by net capacity. Mostly offline since Fukushima; partial restart 2024.' },
  { name: 'Bruce Nuclear', country: 'CA', region: 'North America', lat: 44.323, lng: -81.602,
    type: 'nuclear', capacity_mw: 6358, operator: 'Bruce Power', status: 'operating', year: 1977,
    notes: 'Lake Huron. Largest operating nuclear station globally. Mid-life refurbishment ongoing through 2033.' },
  { name: 'Tianwan Nuclear', country: 'CN', region: 'Asia-Pacific', lat: 34.685, lng: 119.453,
    type: 'nuclear', capacity_mw: 6650, operator: 'CNNC + Rosatom', status: 'operating', year: 2007,
    notes: 'Jiangsu province. Largest Russian VVER export project; 8 units (6 operating, 2 building).' },
  { name: 'Hanul (Uljin)', country: 'KR', region: 'Asia-Pacific', lat: 37.092, lng: 129.383,
    type: 'nuclear', capacity_mw: 6189, operator: 'KHNP', status: 'operating', year: 1988,
    notes: 'East coast. APR1400 reactors; backbone of South Korean baseload.' },
  { name: 'Yangjiang Nuclear', country: 'CN', region: 'Asia-Pacific', lat: 21.703, lng: 112.279,
    type: 'nuclear', capacity_mw: 6516, operator: 'CGN', status: 'operating', year: 2014,
    notes: 'Guangdong coast. 6 × CPR-1000 / ACPR1000 units.' },
  { name: 'Gravelines', country: 'FR', region: 'Europe', lat: 51.015, lng: 2.136,
    type: 'nuclear', capacity_mw: 5460, operator: 'EDF', status: 'operating', year: 1980,
    notes: 'Largest reactor station in Western Europe. North Sea coast, supplies UK + BeNeLux interconnect.' },
  { name: 'Zaporizhzhia', country: 'UA', region: 'Europe', lat: 47.512, lng: 34.585,
    type: 'nuclear', capacity_mw: 5700, operator: 'Energoatom (Russian-occupied)', status: 'disputed', year: 1984,
    notes: 'Largest reactor station in Europe. Russian-occupied since March 2022; all 6 units in cold shutdown.' },
  { name: 'Olkiluoto 3 (EPR)', country: 'FI', region: 'Europe', lat: 61.237, lng: 21.441,
    type: 'nuclear', capacity_mw: 1600, operator: 'TVO', status: 'operating', year: 2023,
    notes: 'First EPR reactor in Europe. Originally due 2009; budget overran 3x. Now Europe\'s most-modern nuclear unit.' },
  { name: 'Vogtle 3+4', country: 'US', region: 'North America', lat: 33.143, lng: -81.762,
    type: 'nuclear', capacity_mw: 2234, operator: 'Southern Company', status: 'operating', year: 2024,
    notes: 'First new US reactors in 30 years. AP1000 design; 7 years late, ~$35B over budget.' },
  { name: 'Barakah', country: 'AE', region: 'Middle East', lat: 23.985, lng: 52.198,
    type: 'nuclear', capacity_mw: 5600, operator: 'ENEC + KEPCO', status: 'operating', year: 2021,
    notes: 'First nuclear plant in the Arab world. 4 × Korean APR1400 units, all online by 2024.' },

  // ── Coal (the largest, often dirtiest) ──
  { name: 'Tuoketuo Power Station', country: 'CN', region: 'Asia-Pacific', lat: 40.270, lng: 111.250,
    type: 'coal', capacity_mw: 6720, operator: 'Datang International', status: 'operating', year: 2003,
    notes: 'Inner Mongolia. Largest coal-fired power station globally. Burns local lignite.' },
  { name: 'Taichung Power Plant', country: 'TW', region: 'Asia-Pacific', lat: 24.211, lng: 120.483,
    type: 'coal', capacity_mw: 5500, operator: 'Taipower', status: 'operating', year: 1991,
    notes: 'Largest emitter of CO2 of any single facility on Earth.' },
  { name: 'Bełchatów', country: 'PL', region: 'Europe', lat: 51.270, lng: 19.327,
    type: 'coal', capacity_mw: 5102, operator: 'PGE', status: 'operating', year: 1988,
    notes: 'EU\'s largest CO2 emitter. Brown coal (lignite) burned on-site from adjacent open-pit mine.' },
  { name: 'Vindhyachal', country: 'IN', region: 'Asia-Pacific', lat: 24.108, lng: 82.660,
    type: 'coal', capacity_mw: 4760, operator: 'NTPC', status: 'operating', year: 1987,
    notes: 'Largest coal plant in India. Madhya Pradesh.' },
  { name: 'Mundra Ultra Mega', country: 'IN', region: 'Asia-Pacific', lat: 22.823, lng: 69.541,
    type: 'coal', capacity_mw: 4620, operator: 'Adani Power', status: 'operating', year: 2012,
    notes: 'Coastal supercritical plant burning imported coal from Indonesia + Australia.' },
  { name: 'Datteln 4', country: 'DE', region: 'Europe', lat: 51.616, lng: 7.319,
    type: 'coal', capacity_mw: 1052, operator: 'Uniper', status: 'operating', year: 2020,
    notes: 'Last new German hard-coal plant; commissioned amid coal-phase-out controversy.' },

  // ── Gas-fired (CCGT / OCGT) ──
  { name: 'Surgut-2', country: 'RU', region: 'Russia & Caspian', lat: 61.165, lng: 73.486,
    type: 'gas', capacity_mw: 5597, operator: 'Unipro', status: 'operating', year: 1985,
    notes: 'Western Siberia. World\'s largest gas-fired plant. Fed by associated gas from Surgut oil fields.' },
  { name: 'Futtsu', country: 'JP', region: 'Asia-Pacific', lat: 35.299, lng: 139.795,
    type: 'gas', capacity_mw: 5040, operator: 'JERA', status: 'operating', year: 1985,
    notes: 'Tokyo Bay. Largest LNG-fired plant globally; powers the Kanto megacity.' },
  { name: 'Ras Laffan Combined Cycle', country: 'QA', region: 'Middle East', lat: 25.870, lng: 51.575,
    type: 'gas', capacity_mw: 2730, operator: 'Qatar Power Company', status: 'operating', year: 2011,
    notes: 'Adjacent to the LNG export complex. Co-generation with desalination.' },
  { name: 'Cheniere Sabine Pass', country: 'US', region: 'North America', lat: 29.748, lng: -93.876,
    type: 'gas', capacity_mw: 3100, operator: 'Cheniere Energy', status: 'operating', year: 2016,
    notes: 'First US LNG-export terminal; the on-site CCGT powers liquefaction trains.' },
  { name: 'Pembroke Power Station', country: 'GB', region: 'Europe', lat: 51.687, lng: -4.926,
    type: 'gas', capacity_mw: 2200, operator: 'RWE', status: 'operating', year: 2012,
    notes: 'Largest CCGT in Europe. Pembrokeshire, Wales.' },

  // ── Utility-scale Solar ──
  { name: 'Bhadla Solar Park', country: 'IN', region: 'Asia-Pacific', lat: 27.539, lng: 71.913,
    type: 'solar', capacity_mw: 2245, operator: 'multiple (Adani, ReNew, ACME, …)', status: 'operating', year: 2018,
    notes: 'Rajasthan Thar Desert. World\'s largest single solar PV facility.' },
  { name: 'Pavagada Solar Park', country: 'IN', region: 'Asia-Pacific', lat: 14.092, lng: 77.260,
    type: 'solar', capacity_mw: 2050, operator: 'multiple', status: 'operating', year: 2019,
    notes: 'Karnataka. Built on drought-stricken farmland; major rural economic stimulus.' },
  { name: 'Mohammed bin Rashid Al Maktoum', country: 'AE', region: 'Middle East', lat: 24.755, lng: 55.265,
    type: 'solar', capacity_mw: 1627, operator: 'DEWA', status: 'operating', year: 2017,
    notes: 'Dubai. CSP + PV hybrid; targets 5 GW by 2030. World-record-low LCOE tariffs.' },
  { name: 'Benban Solar Park', country: 'EG', region: 'Africa', lat: 24.456, lng: 32.737,
    type: 'solar', capacity_mw: 1650, operator: 'multiple (consortium)', status: 'operating', year: 2019,
    notes: 'Aswan. Largest solar facility in Africa. 41 separate plants on a shared substation.' },
  { name: 'Tengger Desert Solar Park', country: 'CN', region: 'Asia-Pacific', lat: 37.563, lng: 105.054,
    type: 'solar', capacity_mw: 1547, operator: 'multiple', status: 'operating', year: 2016,
    notes: '"Great Wall of Solar" — visible from orbit.' },

  // ── Wind ──
  { name: 'Gansu Wind Farm', country: 'CN', region: 'Asia-Pacific', lat: 39.778, lng: 97.038,
    type: 'wind', capacity_mw: 8000, operator: 'multiple (China)', status: 'operating', year: 2012,
    notes: 'Jiuquan. Largest wind farm complex on Earth; expansion targets 20 GW.' },
  { name: 'Alta Wind Energy Center', country: 'US', region: 'North America', lat: 35.040, lng: -118.337,
    type: 'wind', capacity_mw: 1548, operator: 'Terra-Gen', status: 'operating', year: 2010,
    notes: 'Tehachapi Pass, California. Largest US wind farm.' },
  { name: 'Hornsea Offshore (1+2+3)', country: 'GB', region: 'Europe', lat: 53.885, lng: 1.791,
    type: 'wind', capacity_mw: 4032, operator: 'Ørsted', status: 'partial', year: 2019,
    notes: 'North Sea offshore. Largest offshore wind complex globally once Hornsea 3 finishes 2027.' },
  { name: 'Borssele Offshore', country: 'NL', region: 'Europe', lat: 51.717, lng: 3.029,
    type: 'wind', capacity_mw: 1488, operator: 'Ørsted + Shell + Eneco', status: 'operating', year: 2020,
    notes: 'Dutch North Sea. Record-low offshore wind tariff at award (€72.7/MWh).' },

  // ── Geothermal ──
  { name: 'The Geysers', country: 'US', region: 'North America', lat: 38.789, lng: -122.756,
    type: 'geothermal', capacity_mw: 900, operator: 'Calpine', status: 'operating', year: 1960,
    notes: 'Northern California. Largest geothermal field globally by capacity.' },
  { name: 'Larderello', country: 'IT', region: 'Europe', lat: 43.244, lng: 10.870,
    type: 'geothermal', capacity_mw: 769, operator: 'Enel Green Power', status: 'operating', year: 1913,
    notes: 'Tuscany. World\'s oldest geothermal power complex; producing since 1913.' },
  { name: 'Cerro Prieto', country: 'MX', region: 'North America', lat: 32.408, lng: -115.232,
    type: 'geothermal', capacity_mw: 720, operator: 'CFE', status: 'operating', year: 1973,
    notes: 'Baja California. Largest geothermal plant in Latin America.' },
  { name: 'Hellisheiði', country: 'IS', region: 'Europe', lat: 64.040, lng: -21.402,
    type: 'geothermal', capacity_mw: 303, operator: 'ON Power (Orkuveita Reykjavíkur)', status: 'operating', year: 2006,
    notes: 'Iceland. Co-located with CarbFix CO2 mineralization plant.' },

  // ── Pumped Storage Hydro ──
  { name: 'Bath County Pumped Storage', country: 'US', region: 'North America', lat: 38.207, lng: -79.802,
    type: 'pumped-storage', capacity_mw: 3003, operator: 'Dominion Energy', status: 'operating', year: 1985,
    notes: 'Virginia. Was world\'s largest battery for 36 years — "the world\'s largest rechargeable battery".' },
  { name: 'Fengning Pumped Storage', country: 'CN', region: 'Asia-Pacific', lat: 41.275, lng: 116.605,
    type: 'pumped-storage', capacity_mw: 3600, operator: 'State Grid Xinyuan', status: 'operating', year: 2022,
    notes: 'Hebei. Largest pumped storage on Earth, replacing Bath County for the crown.' },
  { name: 'Dinorwig', country: 'GB', region: 'Europe', lat: 53.117, lng: -4.114,
    type: 'pumped-storage', capacity_mw: 1728, operator: 'Engie', status: 'operating', year: 1984,
    notes: '"Electric Mountain" inside a former Welsh slate quarry. Black-start asset for UK grid.' },
];

export async function GET() {
  const maxMw = PLANTS.reduce((m, p) => Math.max(m, p.capacity_mw), 0) || 1;
  const plants = PLANTS.map(p => ({
    ...p,
    // sqrt scale so small but iconic plants (Olkiluoto, Hellisheiði) stay visible
    intensity: Math.min(1, Math.sqrt(p.capacity_mw / maxMw)),
  }));

  const byType: Record<string, number> = {};
  let totalMw = 0;
  for (const p of PLANTS) {
    byType[p.type] = (byType[p.type] || 0) + 1;
    totalMw += p.capacity_mw;
  }

  return NextResponse.json({
    plants,
    total: PLANTS.length,
    total_mw: totalMw,
    by_type: byType,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
