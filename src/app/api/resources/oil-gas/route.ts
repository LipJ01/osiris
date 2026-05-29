import { NextResponse } from 'next/server';

/**
 * OSIRIS — Oil & Gas Upstream
 *
 * Curated dataset of major producing basins and supergiant fields. Numbers
 * are 2023-2024 figures from EIA, IEA, Rystad, BP Statistical Review,
 * company filings, and OPEC monthly bulletins. Static — these don't shift
 * minute-to-minute and a hand-curated set has higher signal than a noisy
 * scrape of hundreds of small wells.
 *
 *   type      'oil' | 'gas' | 'mixed'  — what dominates the production
 *   oil_kbpd  thousands of barrels of oil per day
 *   gas_mmcfd million cubic feet of gas per day
 *   reserves  short prose, proven + likely
 */

type FieldType = 'oil' | 'gas' | 'mixed';
type Status = 'producing' | 'declining' | 'rebuilding' | 'sanctioned';

interface Field {
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  type: FieldType;
  oil_kbpd: number;       // 0 if pure gas
  gas_mmcfd: number;      // 0 if pure oil
  reserves: string;
  operator: string;
  status: Status;
  notes: string;
}

// Production figures are recent annual averages. Where ranges exist I take the
// midpoint. Operator is the lead/largest stakeholder, not always 100%.
const FIELDS: Field[] = [
  // ── Middle East — the heart of global supply ──
  { name: 'Ghawar Field', country: 'SA', region: 'Middle East', lat: 25.30, lng: 49.30, type: 'oil',
    oil_kbpd: 3800, gas_mmcfd: 1100, reserves: '48 Bbbl proven (largest conventional field)',
    operator: 'Saudi Aramco', status: 'producing',
    notes: 'Largest conventional oilfield on Earth, in production since 1951.' },
  { name: 'Safaniya Field', country: 'SA', region: 'Middle East', lat: 28.05, lng: 48.78, type: 'oil',
    oil_kbpd: 1300, gas_mmcfd: 0, reserves: '37 Bbbl proven, largest offshore field',
    operator: 'Saudi Aramco', status: 'producing',
    notes: 'Persian Gulf supergiant — heavy/medium crude, ~70 yrs of life.' },
  { name: 'Burgan Field', country: 'KW', region: 'Middle East', lat: 28.95, lng: 47.92, type: 'oil',
    oil_kbpd: 1600, gas_mmcfd: 800, reserves: '70 Bbbl original-in-place',
    operator: 'Kuwait Oil Company', status: 'producing',
    notes: 'Second-largest oilfield ever discovered. Damaged in 1991 Gulf War.' },
  { name: 'Rumaila Field', country: 'IQ', region: 'Middle East', lat: 30.40, lng: 47.30, type: 'oil',
    oil_kbpd: 1450, gas_mmcfd: 0, reserves: '17 Bbbl proven',
    operator: 'BP / PetroChina', status: 'producing',
    notes: 'Iraq\'s largest field; production tripled since 2009 redevelopment.' },
  { name: 'Majnoon Field', country: 'IQ', region: 'Middle East', lat: 31.10, lng: 47.50, type: 'oil',
    oil_kbpd: 240, gas_mmcfd: 0, reserves: '12.6 Bbbl proven',
    operator: 'Basra Oil Company', status: 'producing', notes: 'Iran-Iraq border field, named "crazy" for its huge reserves.' },
  { name: 'South Pars / North Field', country: 'IR/QA', region: 'Middle East', lat: 26.50, lng: 51.50, type: 'gas',
    oil_kbpd: 700, gas_mmcfd: 27000, reserves: '1,800 Tcf gas (largest gas field globally)',
    operator: 'NIOC + QatarEnergy', status: 'producing',
    notes: 'Shared between Iran (South Pars) and Qatar (North Field). Single largest hydrocarbon accumulation on Earth.' },
  { name: 'Manifa Field', country: 'SA', region: 'Middle East', lat: 27.71, lng: 49.20, type: 'oil',
    oil_kbpd: 900, gas_mmcfd: 90, reserves: '11 Bbbl proven',
    operator: 'Saudi Aramco', status: 'producing', notes: 'Heavy-sour crude restarted 2013 for petrochemical feedstock.' },
  { name: 'Khurais Field', country: 'SA', region: 'Middle East', lat: 25.10, lng: 48.10, type: 'oil',
    oil_kbpd: 1200, gas_mmcfd: 320, reserves: '27 Bbbl proven',
    operator: 'Saudi Aramco', status: 'producing', notes: 'Hit by 2019 drone strike; restored within days.' },

  // ── North America ──
  { name: 'Permian Basin', country: 'US', region: 'North America', lat: 31.83, lng: -102.36, type: 'mixed',
    oil_kbpd: 6500, gas_mmcfd: 25000, reserves: '46 Bbbl + 280 Tcf recoverable',
    operator: 'multi (Exxon, Chevron, Pioneer, EOG)', status: 'producing',
    notes: 'Largest US oil basin; shale revolution epicentre. >40% of US crude output.' },
  { name: 'Bakken (Williston Basin)', country: 'US', region: 'North America', lat: 47.83, lng: -103.43, type: 'oil',
    oil_kbpd: 1180, gas_mmcfd: 3200, reserves: '7.4 Bbbl recoverable',
    operator: 'multi (Continental, Hess, ConocoPhillips)', status: 'producing',
    notes: 'Light-tight oil play across ND/MT. Peaked 2019, plateauing.' },
  { name: 'Eagle Ford Shale', country: 'US', region: 'North America', lat: 28.55, lng: -99.10, type: 'mixed',
    oil_kbpd: 1190, gas_mmcfd: 7000, reserves: '7.3 Bbbl + 50 Tcf recoverable',
    operator: 'multi (EOG, ConocoPhillips, Marathon)', status: 'producing',
    notes: 'South TX wet-gas/condensate window — high-margin barrels.' },
  { name: 'Appalachian (Marcellus/Utica)', country: 'US', region: 'North America', lat: 40.27, lng: -80.39, type: 'gas',
    oil_kbpd: 130, gas_mmcfd: 36000, reserves: '410 Tcf gas recoverable',
    operator: 'multi (EQT, Antero, Range, Southwestern)', status: 'producing',
    notes: 'Largest natural gas field in the US — supplies 1/3 of national output.' },
  { name: 'Athabasca Oil Sands', country: 'CA', region: 'North America', lat: 56.74, lng: -111.39, type: 'oil',
    oil_kbpd: 3300, gas_mmcfd: 0, reserves: '165 Bbbl proven (mostly bitumen)',
    operator: 'multi (Suncor, CNRL, Cenovus, Imperial)', status: 'producing',
    notes: '3rd largest oil reserves globally. Mined + SAGD bitumen, high CO2 intensity.' },
  { name: 'Gulf of Mexico (Deepwater)', country: 'US', region: 'North America', lat: 27.50, lng: -90.50, type: 'mixed',
    oil_kbpd: 1900, gas_mmcfd: 1900, reserves: '24 Bbbl recoverable',
    operator: 'multi (Chevron, Shell, BP, Equinor)', status: 'producing',
    notes: '70% of GoM is deepwater. Mars, Thunder Horse, Stampede hubs dominate.' },
  { name: 'Cantarell Field', country: 'MX', region: 'North America', lat: 19.60, lng: -92.20, type: 'oil',
    oil_kbpd: 130, gas_mmcfd: 230, reserves: '4 Bbbl remaining',
    operator: 'Pemex', status: 'declining',
    notes: 'Peaked at 2.1 mbpd in 2003, declined 95% since — Mexico\'s production crisis.' },

  // ── Russia / Caspian ──
  { name: 'Samotlor Field', country: 'RU', region: 'Russia & Caspian', lat: 60.93, lng: 76.83, type: 'oil',
    oil_kbpd: 380, gas_mmcfd: 0, reserves: '6 Bbbl recoverable (declined from 30 Bbbl)',
    operator: 'Rosneft', status: 'declining',
    notes: 'Soviet-era supergiant in West Siberia. Down from 3.3 mbpd peak (1980).' },
  { name: 'Priobskoye Field', country: 'RU', region: 'Russia & Caspian', lat: 60.93, lng: 70.10, type: 'oil',
    oil_kbpd: 700, gas_mmcfd: 0, reserves: '13 Bbbl proven', operator: 'Rosneft / Gazprom Neft',
    status: 'producing', notes: 'Largest currently producing Russian oilfield.' },
  { name: 'Urengoy Field', country: 'RU', region: 'Russia & Caspian', lat: 66.10, lng: 76.70, type: 'gas',
    oil_kbpd: 0, gas_mmcfd: 16000, reserves: '350 Tcf original-in-place', operator: 'Gazprom',
    status: 'declining', notes: 'World\'s 2nd-largest gas field by reserves. Anchors Yamal LNG.' },
  { name: 'Yamburg Field', country: 'RU', region: 'Russia & Caspian', lat: 67.95, lng: 75.10, type: 'gas',
    oil_kbpd: 0, gas_mmcfd: 11000, reserves: '170 Tcf original-in-place', operator: 'Gazprom',
    status: 'declining', notes: 'Arctic gas giant powering Russia\'s westbound exports.' },
  { name: 'Kashagan Field', country: 'KZ', region: 'Russia & Caspian', lat: 46.50, lng: 51.50, type: 'oil',
    oil_kbpd: 400, gas_mmcfd: 0, reserves: '13 Bbbl recoverable',
    operator: 'NCOC (ExxonMobil, Shell, Total, KMG, ENI)', status: 'producing',
    notes: 'North Caspian. World\'s most expensive single-project ever (~$50B).' },
  { name: 'Tengiz Field', country: 'KZ', region: 'Russia & Caspian', lat: 46.10, lng: 53.40, type: 'oil',
    oil_kbpd: 700, gas_mmcfd: 0, reserves: '9 Bbbl recoverable',
    operator: 'Chevron (TengizChevroil)', status: 'producing',
    notes: 'High-sulphur Caspian crude exported via CPC pipeline to Black Sea.' },

  // ── Africa ──
  { name: 'Bonga Field', country: 'NG', region: 'Africa', lat: 4.00, lng: 5.30, type: 'oil',
    oil_kbpd: 225, gas_mmcfd: 150, reserves: '1.0 Bbbl recoverable',
    operator: 'Shell', status: 'producing', notes: 'Nigeria\'s first deepwater development (2005).' },
  { name: 'Akpo / Egina Fields', country: 'NG', region: 'Africa', lat: 4.20, lng: 7.00, type: 'oil',
    oil_kbpd: 250, gas_mmcfd: 530, reserves: '1.6 Bbbl recoverable', operator: 'TotalEnergies',
    status: 'producing', notes: 'Deepwater Niger Delta. Egina FPSO launched 2018.' },
  { name: 'Block 32 (Kaombo)', country: 'AO', region: 'Africa', lat: -6.50, lng: 11.30, type: 'oil',
    oil_kbpd: 180, gas_mmcfd: 0, reserves: '780 Mbbl recoverable', operator: 'TotalEnergies',
    status: 'producing', notes: 'Angola pre-salt, two FPSOs serving 59 wells.' },
  { name: 'Bouri Field', country: 'LY', region: 'Africa', lat: 33.96, lng: 12.45, type: 'oil',
    oil_kbpd: 30, gas_mmcfd: 0, reserves: '4.5 Bbbl original-in-place', operator: 'ENI / NOC',
    status: 'declining', notes: 'Largest producing field in the Mediterranean. Aging infrastructure.' },

  // ── South America ──
  { name: 'Lula (Tupi) Pre-Salt', country: 'BR', region: 'South America', lat: -25.50, lng: -42.50, type: 'oil',
    oil_kbpd: 1100, gas_mmcfd: 1500, reserves: '8.3 Bbbl recoverable', operator: 'Petrobras',
    status: 'producing', notes: 'Discovered 2006; anchors the Santos Basin pre-salt boom.' },
  { name: 'Búzios Field', country: 'BR', region: 'South America', lat: -25.30, lng: -42.20, type: 'oil',
    oil_kbpd: 800, gas_mmcfd: 0, reserves: '11.5 Bbbl recoverable', operator: 'Petrobras / CNPC',
    status: 'producing', notes: 'Largest deepwater oilfield globally; 4 FPSOs operating, more on order.' },
  { name: 'Orinoco Belt', country: 'VE', region: 'South America', lat: 8.50, lng: -64.00, type: 'oil',
    oil_kbpd: 300, gas_mmcfd: 0, reserves: '300 Bbbl extra-heavy (largest globally)', operator: 'PDVSA',
    status: 'declining', notes: 'Holds largest proven reserves on Earth but production has collapsed under sanctions/mismanagement.' },
  { name: 'Stabroek Block', country: 'GY', region: 'South America', lat: 7.50, lng: -56.00, type: 'oil',
    oil_kbpd: 700, gas_mmcfd: 0, reserves: '11 Bbbl recoverable + still growing',
    operator: 'ExxonMobil + Hess + CNOOC', status: 'producing',
    notes: 'Largest oil discovery of the past decade. Guyana now exports more crude than several OPEC members.' },

  // ── Europe ──
  { name: 'Johan Sverdrup', country: 'NO', region: 'Europe', lat: 58.85, lng: 2.50, type: 'oil',
    oil_kbpd: 720, gas_mmcfd: 0, reserves: '2.7 Bbbl recoverable', operator: 'Equinor',
    status: 'producing', notes: 'North Sea giant powered from shore — lowest-CO2 oil per barrel globally.' },
  { name: 'Troll Field', country: 'NO', region: 'Europe', lat: 60.65, lng: 3.60, type: 'gas',
    oil_kbpd: 130, gas_mmcfd: 11000, reserves: '40 Tcf recoverable gas', operator: 'Equinor',
    status: 'producing', notes: 'Norway\'s gas backbone, exports to UK + continental Europe.' },
  { name: 'Groningen Field', country: 'NL', region: 'Europe', lat: 53.30, lng: 6.80, type: 'gas',
    oil_kbpd: 0, gas_mmcfd: 100, reserves: '0.6 Tcf remaining (was 96 Tcf)', operator: 'NAM (Shell/Exxon)',
    status: 'sanctioned', notes: 'Closed Oct 2024 after induced seismicity; once Europe\'s largest gas field.' },

  // ── Asia-Pacific ──
  { name: 'Daqing Field', country: 'CN', region: 'Asia-Pacific', lat: 46.59, lng: 125.10, type: 'oil',
    oil_kbpd: 600, gas_mmcfd: 0, reserves: '7 Bbbl remaining', operator: 'CNPC',
    status: 'declining', notes: 'China\'s largest oilfield, peaked at 1.1 mbpd in 1997; EOR-extended.' },
  { name: 'NW Shelf / Carnarvon', country: 'AU', region: 'Asia-Pacific', lat: -19.50, lng: 116.00, type: 'gas',
    oil_kbpd: 100, gas_mmcfd: 5500, reserves: '40 Tcf recoverable', operator: 'Woodside / NW Shelf JV',
    status: 'producing', notes: 'Anchors Australia\'s LNG export business via Karratha trains.' },
  { name: 'Tangguh LNG (Berau Bay)', country: 'ID', region: 'Asia-Pacific', lat: -2.20, lng: 133.30, type: 'gas',
    oil_kbpd: 0, gas_mmcfd: 1500, reserves: '14 Tcf recoverable', operator: 'BP',
    status: 'producing', notes: 'Papua-based LNG export hub, 3 trains operating.' },
];

export async function GET() {
  const oilTotal = FIELDS.reduce((a, f) => a + f.oil_kbpd, 0);
  const gasTotal = FIELDS.reduce((a, f) => a + f.gas_mmcfd, 0);
  // For the marker size we want a single "intensity" per field. Crude proxy:
  // BOE-day where 1 mcf ≈ 1/6 boe. Lets oil and gas plays scale on one axis.
  const fields = FIELDS.map(f => ({
    ...f,
    boed_kbpd: Math.round(f.oil_kbpd + (f.gas_mmcfd / 6)),
  }));

  return NextResponse.json({
    fields,
    total: FIELDS.length,
    oil_kbpd_total: oilTotal,
    gas_mmcfd_total: gasTotal,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
