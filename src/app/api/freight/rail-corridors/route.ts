import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Rail Freight Corridors
 *
 * Curated dataset of the world's largest rail freight + container land-
 * bridge corridors. Includes operating intercontinental rail (Eurasian
 * Land Bridge, Trans-Siberian) and the major North American Class I main
 * lines.
 *
 * Geometry is hand-traced approximate routing; not survey-grade.
 */

type CorridorStatus = 'operating' | 'reduced' | 'planned' | 'sanctioned';

interface Corridor {
  name: string;
  countries: string[];
  status: CorridorStatus;
  length_km: number;
  annual_teu: string;
  operator: string;
  geometry: [number, number][];
  notes: string;
}

const CORRIDORS: Corridor[] = [
  // ── Eurasian Land Bridges ──
  { name: 'China–Europe Express (Belt-and-Road)', countries: ['CN','KZ','RU','BY','PL','DE'],
    status: 'reduced', length_km: 11000, annual_teu: '~700,000 TEU (2023, peak 2021 was 1.5M)',
    operator: 'CR Express + ÖBB Rail Cargo + DB Cargo',
    geometry: [[114.31, 30.59],[112.97, 28.20],[103.85, 30.66],[100.00, 40.00],[87.62, 43.83],[76.85, 43.25],[60.00, 50.00],[40.00, 55.00],[28.00, 53.50],[19.00, 51.00],[8.40, 49.00],[6.95, 50.94]],
    notes: 'Belt-and-Road land bridge. Halved since 2022 Ukraine war made the Russia/Belarus transit politically toxic + insurance unviable for many EU shippers.' },
  { name: 'Trans-Siberian Railway', countries: ['RU'], status: 'operating',
    length_km: 9289, annual_teu: '~200,000 TEU container',
    operator: 'Russian Railways (RZD)',
    geometry: [[37.62, 55.75],[60.00, 56.00],[82.93, 55.04],[92.00, 56.00],[104.30, 52.30],[114.30, 51.85],[127.50, 52.00],[131.40, 43.40]],
    notes: 'Moscow → Vladivostok. Now overwhelmingly carries Russian + Chinese trade rerouted from sanctioned sea + EU rail routes.' },
  { name: 'Baikal-Amur Mainline (BAM)', countries: ['RU'], status: 'operating',
    length_km: 4324, annual_teu: '~70 Mt cargo/yr',
    operator: 'Russian Railways (RZD)',
    geometry: [[97.00, 52.00],[110.00, 56.50],[122.00, 56.00],[131.00, 51.00],[140.00, 49.00]],
    notes: 'Parallel northern route to Trans-Sib. Lower capacity but bypasses some chokepoints. Major expansion underway to push Russian coal exports east.' },
  { name: 'Middle Corridor (Trans-Caspian)', countries: ['CN','KZ','AZ','GE','TR'],
    status: 'operating', length_km: 6500, annual_teu: '~80,000 TEU (rapidly growing)',
    operator: 'multi (Aktau Sea Port + KTZ + ADY + Georgian Railway)',
    geometry: [[87.62, 43.83],[76.85, 43.25],[60.00, 47.00],[51.20, 43.65],[49.86, 40.38],[45.00, 41.50],[42.00, 41.50],[35.00, 40.00],[28.50, 41.10]],
    notes: 'China → Europe bypassing Russia. Bottlenecked by Caspian ferry capacity + Azerbaijani port infrastructure. EU funding $10B+ to scale.' },

  // ── North American Class I ──
  { name: 'BNSF Transcon', countries: ['US'], status: 'operating',
    length_km: 3540, annual_teu: '~4.5M TEU intermodal',
    operator: 'BNSF Railway',
    geometry: [[-118.27, 33.74],[-117.00, 34.50],[-112.07, 33.45],[-106.00, 35.00],[-101.85, 35.20],[-94.58, 39.10],[-90.05, 35.15],[-87.65, 41.85]],
    notes: 'LA/Long Beach → Chicago via Albuquerque + Kansas City. Carries ~40% of US west-coast container imports inland.' },
  { name: 'Union Pacific Sunset Route', countries: ['US'], status: 'operating',
    length_km: 3700, annual_teu: '~3M TEU intermodal',
    operator: 'Union Pacific',
    geometry: [[-118.27, 33.74],[-117.20, 32.72],[-110.93, 32.22],[-106.50, 31.80],[-98.50, 29.42],[-95.37, 29.76],[-93.40, 30.20],[-90.07, 29.95],[-86.78, 33.52]],
    notes: 'LA → New Orleans → SE US. UP\'s main southern transcon, parallel to BNSF but routed through southwest.' },
  { name: 'CSX I-95 Corridor', countries: ['US'], status: 'operating',
    length_km: 1900, annual_teu: '~2M TEU intermodal',
    operator: 'CSX Transportation',
    geometry: [[-74.04, 40.71],[-77.00, 39.00],[-77.04, 38.90],[-81.10, 32.08],[-81.66, 30.33],[-80.19, 25.76]],
    notes: 'NY/NJ → FL via Mid-Atlantic. Backbone of East Coast intermodal.' },
  { name: 'Canadian Pacific (CP) Calgary–Vancouver', countries: ['CA'], status: 'operating',
    length_km: 1130, annual_teu: '~1.5M TEU intermodal',
    operator: 'CPKC (post-2023 merger)',
    geometry: [[-114.07, 51.05],[-117.50, 50.50],[-119.50, 50.80],[-122.00, 50.50],[-123.10, 49.28]],
    notes: 'CPKC formed Apr 2023 from CP + Kansas City Southern merger — first single-line rail from Canada through US to Mexico.' },
  { name: 'CN Halifax–Chicago', countries: ['CA','US'], status: 'operating',
    length_km: 2600, annual_teu: '~1.5M TEU',
    operator: 'Canadian National',
    geometry: [[-63.57, 44.65],[-71.00, 46.00],[-75.70, 45.42],[-79.40, 43.65],[-82.50, 42.30],[-87.65, 41.85]],
    notes: 'Halifax port to Chicago via Montreal + Toronto. Halifax is one of two North American Atlantic ports able to handle ultra-large container ships.' },

  // ── India + South Asia ──
  { name: 'Indian Dedicated Freight Corridors (DFC)', countries: ['IN'], status: 'operating',
    length_km: 3400, annual_teu: 'designed for 200 trains/day',
    operator: 'DFCCIL',
    geometry: [[77.10, 28.70],[78.04, 27.18],[80.92, 26.85],[83.00, 25.30],[84.85, 22.57],[88.36, 22.57]],
    notes: 'Eastern + Western DFC. Will free passenger lines for India\'s booming intermodal traffic. Eastern (Ludhiana-Dankuni) finished 2023; Western (Dadri-JNPT) ramping up.' },

  // ── Africa ──
  { name: 'Lobito Corridor', countries: ['AO','CD','ZM'], status: 'operating',
    length_km: 1300, annual_teu: '~1.5 Mt copper/cobalt cargo',
    operator: 'Lobito Atlantic Railway (TFL)',
    geometry: [[13.27, -12.65],[16.00, -12.30],[20.50, -11.50],[25.50, -10.96],[28.30, -12.97]],
    notes: 'DRC/Zambia copperbelt → Atlantic via Angola — bypassing Indian Ocean routes through DRC. Major US-EU strategic infrastructure investment ($1.6B G7 commitments 2024).' },
  { name: 'Tanzania-Zambia (TAZARA)', countries: ['TZ','ZM'], status: 'reduced',
    length_km: 1860, annual_teu: '~0.5 Mt cargo/yr (down from 1.2 Mt design)',
    operator: 'TAZARA Authority',
    geometry: [[39.21, -6.78],[36.00, -8.00],[34.00, -10.00],[33.00, -11.00],[31.20, -13.50],[28.30, -12.97]],
    notes: 'Built by China 1970s as alternative to apartheid SA + colonial Mozambique routes. Now seeing China-funded $1.4B rehabilitation deal 2024 to compete with Lobito.' },

  // ── Planned / under-construction ──
  { name: 'China-Laos-Thailand Railway', countries: ['CN','LA','TH'], status: 'operating',
    length_km: 1035, annual_teu: '~4 Mt cargo / yr (Yunnan–Vientiane segment)',
    operator: 'Laos-China Railway Company',
    geometry: [[102.71, 25.04],[101.50, 22.50],[102.00, 19.50],[102.61, 17.96]],
    notes: 'Kunming → Vientiane opened Dec 2021. Thai extension to Bangkok progressing slowly. Belt-and-Road flagship in SE Asia.' },
  { name: 'BRI: Hungary–Belgrade Railway', countries: ['HU','RS'], status: 'reduced',
    length_km: 350, annual_teu: 'rail-passenger primarily',
    operator: 'China + Hungarian + Serbian state',
    geometry: [[19.04, 47.50],[19.50, 45.50],[20.00, 44.00],[20.46, 44.81]],
    notes: 'EU\'s only BRI rail project. Serbian section completed 2022; Hungarian half delayed by EU procurement scrutiny.' },
];

export async function GET() {
  const total_km = CORRIDORS.reduce((a, c) => a + c.length_km, 0);
  return NextResponse.json({
    corridors: CORRIDORS, total: CORRIDORS.length, total_km,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
