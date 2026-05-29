import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Pipelines (midstream energy)
 *
 * Curated dataset of strategically significant oil + gas + product pipelines
 * worldwide. Closes the upstream→midstream→downstream visual loop alongside
 * existing Oil & Gas (fields) and Refineries layers.
 *
 *   type      oil | gas | product
 *   status    operating | partial | suspended | damaged | planned | cancelled
 *   geometry  [lng, lat][] waypoints — hand-traced approximate routes for
 *             rendering as polylines (not survey-grade)
 *
 * Sources: company filings, EIA Energy Atlas, Global Energy Monitor pipeline
 * tracker, government regulatory filings (NEB Canada, FERC US, etc.).
 */

type PipelineType = 'oil' | 'gas' | 'product';
type PipelineStatus = 'operating' | 'partial' | 'suspended' | 'damaged' | 'planned' | 'cancelled';

interface Pipeline {
  name: string;
  type: PipelineType;
  operator: string;
  countries: string[];
  capacity: string;
  length_km: number;
  commissioned: number;
  status: PipelineStatus;
  geometry: [number, number][];
  notes: string;
}

const PIPELINES: Pipeline[] = [
  // ── Russian gas to Europe (the big geopolitical story) ──
  { name: 'Nord Stream 1', type: 'gas', operator: 'Nord Stream AG (Gazprom-led)',
    countries: ['RU','DE'], capacity: '55 bcm/yr', length_km: 1224, commissioned: 2011,
    status: 'damaged',
    geometry: [[28.87, 60.62],[27.50, 60.05],[20.30, 58.40],[15.50, 55.40],[14.30, 54.85]],
    notes: 'Sabotaged Sept 26 2022 — 4 ruptures off Bornholm. Three of four lines destroyed. Investigation ongoing.' },
  { name: 'Nord Stream 2', type: 'gas', operator: 'Nord Stream 2 AG (Gazprom-led)',
    countries: ['RU','DE'], capacity: '55 bcm/yr (never commissioned)', length_km: 1234, commissioned: 0,
    status: 'damaged',
    geometry: [[27.85, 59.80],[26.00, 59.20],[19.50, 57.80],[15.50, 55.40],[14.30, 54.85]],
    notes: 'Completed Sept 2021. Germany suspended certification Feb 2022. Sabotaged Sept 2022. One of two lines may be intact.' },
  { name: 'Yamal-Europe', type: 'gas', operator: 'EuRoPol GAZ (Gazprom + PGNiG)',
    countries: ['RU','BY','PL','DE'], capacity: '33 bcm/yr', length_km: 4196, commissioned: 1999,
    status: 'suspended',
    geometry: [[66.00, 65.50],[55.00, 60.00],[40.00, 55.50],[30.00, 53.50],[20.00, 52.50],[14.30, 52.50]],
    notes: 'Russia halted flow May 2022 after Poland refused ruble payment. Reverse flow E→W from German market replaced direct supply.' },
  { name: 'Druzhba (Friendship)', type: 'oil', operator: 'Transneft + downstream',
    countries: ['RU','BY','PL','DE','UA','SK','HU','CZ'], capacity: '~1.4 mbpd at peak', length_km: 4000, commissioned: 1964,
    status: 'partial',
    geometry: [[51.40, 51.80],[40.00, 53.00],[30.00, 53.50],[24.00, 53.50],[20.00, 52.00],[14.00, 52.50]],
    notes: 'Northern arm to Germany/Poland stopped Jan 2023 (EU embargo). Southern arm (Slovakia/Hungary/Czechia) still flowing under exemption.' },
  { name: 'TurkStream', type: 'gas', operator: 'South Stream Transport B.V. (Gazprom)',
    countries: ['RU','TR','BG','RS','HU'], capacity: '31.5 bcm/yr (2 lines)', length_km: 930, commissioned: 2020,
    status: 'operating',
    geometry: [[37.80, 44.70],[35.00, 43.50],[31.50, 41.50],[28.00, 41.30],[28.50, 41.10]],
    notes: 'Russia\'s only remaining direct gas pipeline to Europe. Strategically supports Hungary/Serbia/Bulgaria.' },

  // ── Caspian / Azerbaijan / Central Asia ──
  { name: 'Baku-Tbilisi-Ceyhan (BTC)', type: 'oil', operator: 'BP-led consortium',
    countries: ['AZ','GE','TR'], capacity: '1.2 mbpd', length_km: 1768, commissioned: 2006,
    status: 'operating',
    geometry: [[49.86, 40.38],[45.00, 41.50],[42.00, 41.50],[39.00, 40.50],[36.20, 36.60]],
    notes: 'Bypasses Russia + Iran + Hormuz to deliver Azeri crude to Mediterranean. Geopolitically critical.' },
  { name: 'Southern Gas Corridor (TANAP+TAP)', type: 'gas', operator: 'BP+SOCAR+Snam+others',
    countries: ['AZ','GE','TR','GR','AL','IT'], capacity: '16 bcm/yr (expandable to 31)', length_km: 3500, commissioned: 2020,
    status: 'operating',
    geometry: [[51.20, 39.80],[45.00, 41.50],[42.00, 41.50],[33.00, 39.50],[25.00, 41.00],[20.00, 41.00],[18.50, 40.55],[16.00, 40.50]],
    notes: 'EU\'s flagship non-Russian gas route. Capacity doubling under discussion to replace lost Russian volumes.' },
  { name: 'Caspian Pipeline Consortium (CPC)', type: 'oil', operator: 'CPC',
    countries: ['KZ','RU'], capacity: '1.4 mbpd', length_km: 1510, commissioned: 2001,
    status: 'operating',
    geometry: [[53.50, 46.10],[48.00, 46.00],[44.00, 45.50],[39.00, 45.00],[37.80, 44.70]],
    notes: 'Carries 80% of Kazakh export crude (Tengiz/Kashagan) to Russian Black Sea port. Russia briefly halted in 2022 for "maintenance".' },
  { name: 'Eastern Siberia–Pacific Ocean (ESPO)', type: 'oil', operator: 'Transneft',
    countries: ['RU','CN'], capacity: '1.6 mbpd', length_km: 4857, commissioned: 2012,
    status: 'operating',
    geometry: [[105.00, 56.10],[114.00, 53.50],[125.00, 51.50],[132.00, 47.50],[131.40, 43.40]],
    notes: 'Russia\'s strategic pivot pipeline. Spur to Daqing supplies China; main line continues to Pacific port of Kozmino.' },
  { name: 'Power of Siberia', type: 'gas', operator: 'Gazprom + CNPC',
    countries: ['RU','CN'], capacity: '38 bcm/yr', length_km: 3000, commissioned: 2019,
    status: 'operating',
    geometry: [[122.00, 60.00],[125.00, 56.00],[127.50, 52.00],[127.00, 48.50],[125.00, 45.00],[123.00, 41.80],[116.40, 39.91]],
    notes: 'Russia\'s eastern gas-export pivot. Ramping to full capacity 2025. Power of Siberia 2 still under negotiation.' },
  { name: 'Trans-Caspian Pipeline (TCP)', type: 'gas', operator: 'planned multi-party',
    countries: ['TM','AZ'], capacity: '30 bcm/yr (planned)', length_km: 300, commissioned: 0,
    status: 'planned',
    geometry: [[53.00, 39.50],[51.20, 40.20]],
    notes: 'Would let Turkmen gas reach Europe via Southern Gas Corridor. Russian + Iranian opposition has blocked construction for 25 yrs.' },
  { name: 'TAPI', type: 'gas', operator: 'TAPI Pipeline Company (4-state JV)',
    countries: ['TM','AF','PK','IN'], capacity: '33 bcm/yr (planned)', length_km: 1814, commissioned: 0,
    status: 'planned',
    geometry: [[63.00, 37.50],[65.00, 35.50],[67.00, 32.00],[70.00, 30.00],[74.00, 30.50]],
    notes: 'Turkmenistan→Afghanistan→Pakistan→India. Afghan section partially built 2024; security + financing perpetual obstacles.' },

  // ── North America ──
  { name: 'Trans-Alaska Pipeline (TAPS)', type: 'oil', operator: 'Alyeska Pipeline Service',
    countries: ['US'], capacity: '2.1 mbpd nameplate (0.5 actual)', length_km: 1287, commissioned: 1977,
    status: 'operating',
    geometry: [[-148.46, 70.25],[-148.00, 67.00],[-147.50, 64.85],[-145.00, 62.00],[-146.36, 61.13]],
    notes: 'Prudhoe Bay → Valdez. Carried ~25% of US oil at peak; now operating at quarter capacity as Alaskan production declines.' },
  { name: 'Keystone Pipeline', type: 'oil', operator: 'TC Energy',
    countries: ['CA','US'], capacity: '0.6 mbpd', length_km: 4324, commissioned: 2010,
    status: 'operating',
    geometry: [[-110.50, 53.50],[-105.00, 50.00],[-100.00, 47.00],[-96.00, 43.00],[-95.00, 39.00],[-95.50, 31.00]],
    notes: 'Carries Alberta dilbit to US Gulf Coast refineries. Major Mt. Vernon MO spill 2022 spilled 14000 barrels. Keystone XL was cancelled 2021.' },
  { name: 'Trans Mountain Pipeline (TMX)', type: 'oil', operator: 'Trans Mountain Corp (Govt of Canada)',
    countries: ['CA'], capacity: '0.89 mbpd', length_km: 1147, commissioned: 1953,
    status: 'operating',
    geometry: [[-114.07, 53.55],[-118.50, 53.00],[-122.00, 50.50],[-123.10, 49.28]],
    notes: 'Expansion (TMX) completed May 2024 tripling capacity. Gives Alberta heavy crude access to Pacific tidewater + Asian markets.' },
  { name: 'Coastal GasLink', type: 'gas', operator: 'TC Energy',
    countries: ['CA'], capacity: '14 bcm/yr', length_km: 670, commissioned: 2023,
    status: 'operating',
    geometry: [[-120.00, 56.50],[-122.00, 55.00],[-126.00, 54.50],[-128.42, 54.27]],
    notes: 'Feeds LNG Canada export terminal at Kitimat (first shipments 2025). Major Wet\'suwet\'en land-rights conflict.' },
  { name: 'Dakota Access (DAPL)', type: 'oil', operator: 'Energy Transfer',
    countries: ['US'], capacity: '0.75 mbpd', length_km: 1886, commissioned: 2017,
    status: 'operating',
    geometry: [[-103.00, 47.80],[-100.00, 46.50],[-96.00, 44.00],[-92.00, 42.00],[-89.00, 39.00]],
    notes: 'Bakken shale → Patoka IL hub → Gulf. Standing Rock Sioux protests 2016-17; still litigated.' },

  // ── Mediterranean / North Africa ──
  { name: 'Trans-Mediterranean (Transmed)', type: 'gas', operator: 'Sonatrach + ENI',
    countries: ['DZ','TN','IT'], capacity: '33 bcm/yr', length_km: 2200, commissioned: 1983,
    status: 'operating',
    geometry: [[5.00, 33.00],[9.00, 34.00],[11.00, 36.50],[12.50, 37.50],[14.00, 41.00]],
    notes: 'Algeria → Tunisia → Sicily → mainland Italy. Doubled in value post-Ukraine war as Russian alternative.' },
  { name: 'MEDGAZ', type: 'gas', operator: 'Sonatrach + Naturgy',
    countries: ['DZ','ES'], capacity: '10.5 bcm/yr', length_km: 757, commissioned: 2011,
    status: 'operating',
    geometry: [[-0.55, 35.71],[-1.50, 36.50],[-2.00, 37.00],[-2.13, 36.74]],
    notes: 'Direct Algeria → Spain (Almería) sub-Mediterranean gas line. Has supplanted Maghreb-Europe Pipeline since 2021.' },
  { name: 'Maghreb-Europe Pipeline', type: 'gas', operator: 'multi-party',
    countries: ['DZ','MA','ES'], capacity: '12 bcm/yr', length_km: 1620, commissioned: 1996,
    status: 'cancelled',
    geometry: [[3.00, 36.00],[-2.00, 35.20],[-5.50, 35.80],[-5.40, 36.10]],
    notes: 'Algeria → Morocco → Spain. Algeria let contract expire Oct 2021 over Western Sahara dispute. Now run in reverse (Spain → Morocco).' },
  { name: 'GreenStream', type: 'gas', operator: 'ENI + NOC Libya',
    countries: ['LY','IT'], capacity: '8 bcm/yr', length_km: 540, commissioned: 2004,
    status: 'operating',
    geometry: [[15.45, 32.40],[14.00, 33.50],[13.00, 35.50],[14.55, 37.10]],
    notes: 'Libya → Sicily. Periodically disrupted by Libyan civil conflict episodes.' },
  { name: 'Arab Gas Pipeline', type: 'gas', operator: 'EGAS + downstream',
    countries: ['EG','JO','SY','LB'], capacity: '10 bcm/yr nameplate', length_km: 1200, commissioned: 2003,
    status: 'partial',
    geometry: [[33.62, 30.80],[35.00, 30.50],[36.00, 32.00],[36.20, 33.50],[35.50, 34.50]],
    notes: 'Egypt → Jordan → Syria → Lebanon. Frequently disrupted by Sinai militancy + Syrian war damage. Limited flows since 2010s.' },

  // ── Middle East ──
  { name: 'Iran–Pakistan (IP)', type: 'gas', operator: 'NIGC + ISGS',
    countries: ['IR','PK'], capacity: '21 bcm/yr (planned)', length_km: 1900, commissioned: 0,
    status: 'partial',
    geometry: [[52.10, 27.50],[58.00, 27.00],[62.00, 26.50],[66.00, 26.00],[67.00, 24.85]],
    notes: 'Iran side built to border (2013); Pakistan side stalled under US sanctions threat. Pakistan facing $18B penalty if not completed by 2024 deadline.' },
  { name: 'Saudi East-West Pipeline (Petroline)', type: 'oil', operator: 'Saudi Aramco',
    countries: ['SA'], capacity: '5 mbpd', length_km: 1200, commissioned: 1981,
    status: 'operating',
    geometry: [[49.50, 26.00],[46.00, 25.00],[42.00, 23.00],[39.00, 22.00],[38.95, 22.34]],
    notes: 'Carries Eastern Province crude to Yanbu Red Sea export — bypasses Strait of Hormuz. Hit by Houthi drones 2019.' },
  { name: 'Iraq–Türkiye (Kirkuk–Ceyhan)', type: 'oil', operator: 'BOTAS + Iraqi Pipeline Co.',
    countries: ['IQ','TR'], capacity: '1.6 mbpd nameplate', length_km: 970, commissioned: 1977,
    status: 'suspended',
    geometry: [[44.30, 35.50],[42.50, 36.50],[40.00, 37.50],[37.00, 37.30],[35.85, 36.85]],
    notes: 'Kurdistan crude export route. Türkiye shut it Mar 2023 after ICC arbitration ruled in Iraq\'s favour. Restart still blocked.' },

  // ── UK / North Sea ──
  { name: 'Forties Pipeline System', type: 'oil', operator: 'INEOS',
    countries: ['GB'], capacity: '0.6 mbpd', length_km: 169, commissioned: 1975,
    status: 'operating',
    geometry: [[1.07, 58.07],[0.50, 57.50],[0.00, 57.00],[-1.80, 56.50],[-1.80, 56.34]],
    notes: 'North Sea Forties Blend pipeline to Cruden Bay/Grangemouth. Brent crude benchmark relies on FPS uptime.' },
  { name: 'Langeled', type: 'gas', operator: 'Gassco',
    countries: ['NO','GB'], capacity: '24 bcm/yr', length_km: 1166, commissioned: 2006,
    status: 'operating',
    geometry: [[5.50, 62.00],[4.50, 60.00],[3.00, 58.00],[1.50, 56.00],[-0.30, 53.65]],
    notes: 'Norway → UK (Easington). World\'s longest subsea export pipeline at commissioning. Carries up to 25% of UK gas demand.' },

  // ── New / strategic ──
  { name: 'Baltic Pipe', type: 'gas', operator: 'Gaz-System + Energinet',
    countries: ['NO','DK','PL'], capacity: '10 bcm/yr', length_km: 900, commissioned: 2022,
    status: 'operating',
    geometry: [[3.00, 56.30],[8.50, 56.00],[11.50, 55.50],[14.00, 54.50],[16.00, 54.00]],
    notes: 'Norwegian gas → Denmark → Poland. Commissioned 5 days before Nord Stream sabotage — strategic substitution.' },
  { name: 'GIPL (Poland–Lithuania)', type: 'gas', operator: 'Gaz-System + Amber Grid',
    countries: ['PL','LT'], capacity: '2 bcm/yr', length_km: 508, commissioned: 2022,
    status: 'operating',
    geometry: [[22.30, 53.00],[23.50, 54.00],[24.10, 54.70]],
    notes: 'Baltic states\' first physical gas link to the EU west — ended Russian-only supply dependency.' },
  { name: 'East African Crude Oil Pipeline (EACOP)', type: 'oil', operator: 'TotalEnergies + CNOOC',
    countries: ['UG','TZ'], capacity: '0.25 mbpd', length_km: 1443, commissioned: 0,
    status: 'planned',
    geometry: [[31.50, -1.50],[32.50, -2.50],[34.00, -4.00],[36.00, -5.50],[38.50, -7.00],[39.20, -6.78]],
    notes: 'World\'s longest heated crude oil pipeline (planned). Climate-activist + Indigenous land opposition; Western banks have largely declined financing.' },
];

export async function GET() {
  const total_km = PIPELINES.reduce((a, p) => a + p.length_km, 0);
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const p of PIPELINES) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byType[p.type] = (byType[p.type] || 0) + 1;
  }
  return NextResponse.json({
    pipelines: PIPELINES,
    total: PIPELINES.length,
    total_km,
    by_status: byStatus,
    by_type: byType,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
