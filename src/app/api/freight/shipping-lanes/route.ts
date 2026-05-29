import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Shipping Lanes
 *
 * Curated dataset of the principal sea-borne trade routes by traffic class
 * (container / crude / LNG / dry bulk / chemical). Geometry is hand-traced
 * approximate great-circle routing avoiding land masses — not survey-grade.
 *
 * Sources: UNCTAD Maritime Review, Clarksons Research, MarineTraffic
 * density maps, IMO emissions reports, EIA Global Energy Atlas.
 */

type LaneType = 'container' | 'crude' | 'lng' | 'bulk' | 'chemical' | 'mixed';
type LaneStatus = 'normal' | 'disrupted' | 'rerouted';

interface Lane {
  name: string;
  type: LaneType;
  status: LaneStatus;
  traffic: string;
  importance: 1 | 2 | 3;  // 1=critical, 2=major, 3=secondary
  geometry: [number, number][];  // [lng, lat][] waypoints
  notes: string;
}

const LANES: Lane[] = [
  // ── Container mainlines (East→West trade) ──
  { name: 'Asia–North Europe (mainline)', type: 'container', status: 'rerouted', traffic: '~20M TEU/yr',
    importance: 1,
    geometry: [[121.50, 31.20],[114.06, 22.54],[110.00, 5.00],[103.85, 1.35],[97.00, 6.00],[80.00, 8.00],[63.00, 12.00],[51.50, 19.00],[43.50, 13.50],[32.30, 27.50],[32.30, 31.50],[26.00, 36.00],[14.00, 36.00],[-5.50, 36.00],[-9.50, 38.50],[-1.00, 47.00],[2.50, 51.00],[4.00, 51.95]],
    notes: 'Shanghai/Ningbo→Singapore→Suez→Rotterdam/Hamburg/Antwerp. Largest container trade lane globally. Since Nov 2023, most container lines reroute via Cape due to Houthi Red Sea attacks (~10-14 extra days).' },
  { name: 'Cape Route (Houthi diversion)', type: 'container', status: 'rerouted', traffic: '~18M TEU/yr (diverted)',
    importance: 1,
    geometry: [[121.50, 31.20],[114.06, 22.54],[103.85, 1.35],[80.00, 0.00],[60.00, -10.00],[40.00, -20.00],[25.00, -34.50],[18.50, -34.36],[10.00, -20.00],[-5.00, 0.00],[-10.00, 20.00],[-9.50, 38.50],[-1.00, 47.00],[2.50, 51.00],[4.00, 51.95]],
    notes: 'Houthi-imposed alternative to Suez since Nov 2023. Adds ~3,500 nm + $1M/voyage. Suez Canal revenue fell 60% in 2024.' },
  { name: 'Trans-Pacific Eastbound', type: 'container', status: 'normal', traffic: '~25M TEU/yr',
    importance: 1,
    geometry: [[121.50, 31.20],[125.00, 35.00],[140.00, 38.00],[170.00, 45.00],[-180.00, 50.00],[-150.00, 50.00],[-130.00, 42.00],[-122.00, 37.00],[-118.27, 33.74]],
    notes: 'Shanghai/Ningbo/Shenzhen → LA/Long Beach (San Pedro Bay handles ~40% of US container imports). Pandemic-era backlogs largely cleared.' },
  { name: 'Trans-Pacific Northern', type: 'container', status: 'normal', traffic: '~8M TEU/yr',
    importance: 2,
    geometry: [[140.00, 35.00],[160.00, 45.00],[-180.00, 53.00],[-160.00, 55.00],[-140.00, 53.00],[-128.42, 54.27],[-123.10, 49.28],[-122.41, 47.60]],
    notes: 'Japan/Korea→Vancouver/Seattle/Prince Rupert. Shorter than south-Pacific but ports have less capacity.' },
  { name: 'Trans-Atlantic Westbound', type: 'container', status: 'normal', traffic: '~5M TEU/yr',
    importance: 2,
    geometry: [[4.00, 51.95],[1.00, 50.00],[-5.50, 47.00],[-30.00, 42.00],[-60.00, 40.00],[-74.04, 40.71]],
    notes: 'Rotterdam/Hamburg/Antwerp → NY/NJ/Norfolk/Savannah. Stable, mature corridor.' },

  // ── Crude oil flows ──
  { name: 'Persian Gulf → Asia (VLCC)', type: 'crude', status: 'normal', traffic: '17 mbpd through Hormuz',
    importance: 1,
    geometry: [[50.16, 26.64],[56.25, 26.57],[63.00, 22.00],[75.00, 12.00],[90.00, 6.00],[100.00, 3.00],[105.00, 5.00],[114.06, 22.54],[121.50, 31.20],[135.00, 35.00]],
    notes: '20% of global oil consumption transits Hormuz. Houthi threats periodically extend insurance premiums.' },
  { name: 'Russia → Asia (post-sanctions)', type: 'crude', status: 'normal', traffic: '~3 mbpd',
    importance: 1,
    geometry: [[132.00, 43.40],[125.00, 36.00],[120.00, 30.00],[114.06, 22.54],[105.00, 0.00],[80.00, 18.00],[72.84, 18.93]],
    notes: 'ESPO + Sakhalin → India/China. Massive shift post-Ukraine war — Indian refiners + Chinese teapots became dominant Russian crude buyers.' },
  { name: 'West Africa → Asia', type: 'crude', status: 'normal', traffic: '~2.5 mbpd',
    importance: 2,
    geometry: [[5.30, 4.00],[0.00, -5.00],[18.50, -34.36],[40.00, -20.00],[63.00, 12.00],[80.00, 8.00],[105.00, 5.00],[114.06, 22.54]],
    notes: 'Angola + Nigeria + Equatorial Guinea crude rounded the Cape to India + China. Cape route entrenched even before Houthi disruption.' },
  { name: 'Middle East → Europe (BTC/Suez)', type: 'crude', status: 'normal', traffic: '~4 mbpd',
    importance: 2,
    geometry: [[50.16, 26.64],[56.25, 26.57],[55.00, 20.00],[43.50, 13.50],[32.30, 27.50],[32.30, 31.50],[14.00, 41.00],[5.00, 38.00],[-5.50, 36.00],[-9.50, 38.50]],
    notes: 'Saudi/Iraqi/UAE crude → Mediterranean European refiners via Suez/SUMED + Bab el-Mandeb. Cape diversion mostly affects container ships, not VLCC tankers.' },
  { name: 'Russia (Novorossiysk) → Med/Asia', type: 'crude', status: 'normal', traffic: '~1.5 mbpd',
    importance: 2,
    geometry: [[37.77, 44.72],[33.00, 41.00],[29.07, 41.12],[26.00, 39.00],[19.00, 36.00],[10.00, 34.00],[5.00, 36.00],[-5.50, 36.00]],
    notes: 'CPC Kazakh crude + Russian export blend through Bosphorus. Turkish strait transit fees significant.' },

  // ── LNG ──
  { name: 'Qatar/UAE → NE Asia LNG', type: 'lng', status: 'normal', traffic: '~80 Mt/yr',
    importance: 1,
    geometry: [[51.57, 25.87],[56.25, 26.57],[63.00, 18.00],[80.00, 8.00],[100.00, 3.00],[121.50, 31.20],[135.00, 35.00],[126.98, 37.57]],
    notes: 'Qatar → Japan/Korea/China/Taiwan via Hormuz + Malacca. Qatar competing with US LNG for the same Asian markets.' },
  { name: 'US Gulf → Europe LNG', type: 'lng', status: 'normal', traffic: '~50 Mt/yr',
    importance: 1,
    geometry: [[-93.88, 29.75],[-80.00, 25.00],[-70.00, 32.00],[-50.00, 38.00],[-30.00, 42.00],[-10.00, 45.00],[-2.00, 50.00],[2.50, 51.00]],
    notes: 'Replaced ~half of lost Russian pipeline gas to EU since 2022. Sabine Pass + Corpus Christi + Cameron LNG dominant exporters.' },
  { name: 'Australia → NE Asia LNG', type: 'lng', status: 'normal', traffic: '~75 Mt/yr',
    importance: 1,
    geometry: [[116.00, -19.50],[115.00, -8.00],[120.00, -5.00],[125.00, 0.00],[130.00, 15.00],[135.00, 35.00],[126.98, 37.57]],
    notes: 'NW Shelf + Gorgon + Ichthys → Japan/Korea/China. Australia + Qatar + US are the big three LNG exporters globally.' },

  // ── Iron ore + dry bulk ──
  { name: 'Australia → China iron ore', type: 'bulk', status: 'normal', traffic: '~850 Mt/yr',
    importance: 1,
    geometry: [[116.00, -22.50],[115.00, -10.00],[118.00, -3.00],[120.00, 5.00],[121.50, 22.00],[121.50, 31.20]],
    notes: 'Pilbara → Chinese steel mills. Single biggest dry-bulk trade flow globally (~12% of all global maritime tonnage).' },
  { name: 'Brazil → China iron ore', type: 'bulk', status: 'normal', traffic: '~200 Mt/yr',
    importance: 1,
    geometry: [[-43.20, -22.91],[-40.00, -25.00],[-20.00, -30.00],[10.00, -34.50],[40.00, -25.00],[80.00, -5.00],[105.00, 5.00],[114.06, 22.54],[121.50, 31.20]],
    notes: 'Carajás + Vitória → Chinese mills via Cape. Valemax 400k DWT ships designed specifically for this lane.' },
  { name: 'US Gulf → World (grain)', type: 'bulk', status: 'normal', traffic: '~100 Mt/yr',
    importance: 2,
    geometry: [[-90.00, 29.00],[-80.00, 25.00],[-72.00, 12.00],[-79.68, 9.08],[-100.00, 5.00],[-160.00, 30.00],[140.00, 35.00]],
    notes: 'Mississippi → world (esp. China, Mexico, Japan). Trans-Panama Canal traffic significantly affected by 2023-24 drought.' },
  { name: 'Black Sea → world (grain)', type: 'bulk', status: 'disrupted', traffic: '~80 Mt/yr',
    importance: 2,
    geometry: [[33.50, 44.62],[33.00, 42.00],[29.07, 41.12],[26.00, 36.00],[14.00, 36.00],[-5.50, 36.00]],
    notes: 'Ukrainian + Russian wheat/corn → Africa/Middle East/Asia. Black Sea Grain Initiative collapsed Jul 2023; Ukraine reopened "humanitarian corridor" 2023-2024.' },

  // ── Specialised + secondary ──
  { name: 'Northern Sea Route', type: 'mixed', status: 'normal', traffic: '~36 Mt/yr',
    importance: 3,
    geometry: [[33.00, 70.00],[60.00, 73.00],[100.00, 75.00],[140.00, 73.00],[170.00, 70.00],[-170.00, 67.00],[-150.00, 65.00]],
    notes: 'Russian Arctic route. Open ~4 months per year. China + Russia pushing Polar Silk Road; CMA CGM + Maersk officially avoid for ESG reasons.' },
  { name: 'Panama Canal Asia–US East', type: 'container', status: 'disrupted', traffic: '~6M TEU/yr',
    importance: 2,
    geometry: [[121.50, 31.20],[140.00, 25.00],[-160.00, 20.00],[-130.00, 18.00],[-100.00, 12.00],[-80.40, 9.13],[-79.55, 9.30],[-77.00, 11.00],[-72.00, 25.00],[-74.04, 40.71]],
    notes: 'Asia → US East Coast via Panama. 2023-24 drought reduced canal transit slots ~40%, pushing some traffic to Suez (then to Cape).' },
  { name: 'Strait of Malacca', type: 'mixed', status: 'normal', traffic: '~84,000 ships/yr',
    importance: 1,
    geometry: [[103.85, 1.35],[102.00, 3.00],[100.50, 4.50],[98.50, 6.00],[96.50, 7.50]],
    notes: 'World\'s busiest strait by ship count. ~30% of global trade by tonnage. China\'s "Malacca Dilemma" — Beijing seeks alternatives (Kra Canal, Belt-and-Road land bridge).' },
];

export async function GET() {
  const total_lanes = LANES.length;
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const l of LANES) {
    byType[l.type] = (byType[l.type] || 0) + 1;
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  }
  return NextResponse.json({
    lanes: LANES, total: total_lanes, by_type: byType, by_status: byStatus,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
