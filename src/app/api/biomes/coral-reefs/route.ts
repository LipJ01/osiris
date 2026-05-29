import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Coral Reef Systems
 *
 * Curated dataset of the world's most significant coral reef regions —
 * weighted toward intact frontier reefs, biodiversity hotspots, and the
 * systems undergoing the most severe documented climate impacts.
 *
 * Sources: WCMC global coral atlas, NOAA Coral Reef Watch bleaching
 * advisories, AIMS LTMP (Great Barrier Reef), Reef Check surveys, IUCN
 * Reefs at Risk, peer-reviewed literature.
 *
 *   area_km2          rough reef cover area
 *   status            intact | degraded | critical | recovering
 *   last_bleaching    year of last major mass-bleaching event
 *   threats[]         dominant drivers
 */

type ReefStatus = 'intact' | 'degraded' | 'critical' | 'recovering';

interface Reef {
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  area_km2: number;
  status: ReefStatus;
  last_bleaching: number;       // year; 0 = no recorded major event
  bleaching_events_since_2000: number;
  threats: string[];
  notable_species: string;
  notes: string;
}

const REEFS: Reef[] = [
  // ── The mega-reefs ──
  { name: 'Great Barrier Reef', country: 'AU', region: 'Asia-Pacific',
    lat: -18.50, lng: 147.00, area_km2: 348700, status: 'critical', last_bleaching: 2024,
    bleaching_events_since_2000: 7,
    threats: ['ocean warming', 'cyclones', 'crown-of-thorns starfish', 'sediment runoff'],
    notable_species: '1500 fish species, 411 hard coral species, dugongs, green turtles',
    notes: 'Largest reef system on Earth. 5 mass-bleaching events 2016-2024 — unprecedented frequency. Northern third already lost most of its shallow-water corals.' },
  { name: 'Mesoamerican Barrier Reef', country: 'multi', region: 'North America',
    lat: 17.50, lng: -87.50, area_km2: 26000, status: 'degraded', last_bleaching: 2023,
    bleaching_events_since_2000: 5,
    threats: ['stony coral tissue loss disease (SCTLD)', 'ocean warming', 'hurricanes', 'runoff'],
    notable_species: 'whale shark, manatee, 65 coral species',
    notes: 'World\'s 2nd-largest reef. Spans Mexico-Belize-Guatemala-Honduras. SCTLD outbreak 2018+ has killed >40% of stony corals.' },
  { name: 'New Caledonia Barrier Reef', country: 'NC', region: 'Asia-Pacific',
    lat: -22.00, lng: 166.50, area_km2: 24000, status: 'intact', last_bleaching: 2016,
    bleaching_events_since_2000: 2,
    threats: ['nickel-mine runoff', 'occasional bleaching'],
    notable_species: 'dugongs, humphead wrasse, 9,372 marine species',
    notes: 'Longest continuous barrier reef in the world. UNESCO World Heritage. Less heat-stress-exposed than GBR.' },
  { name: 'Red Sea Reefs', country: 'multi', region: 'Middle East',
    lat: 22.00, lng: 38.00, area_km2: 17400, status: 'intact', last_bleaching: 2020,
    bleaching_events_since_2000: 1,
    threats: ['oil spills', 'coastal development', 'desalination brine'],
    notable_species: '300+ coral species, 1200 fish',
    notes: 'Northern Red Sea (Gulf of Aqaba) corals show extreme heat tolerance — a "super reef" of climate refuge potential.' },

  // ── Coral Triangle (the global epicentre of marine biodiversity) ──
  { name: 'Raja Ampat', country: 'ID', region: 'Asia-Pacific',
    lat: -0.50, lng: 130.50, area_km2: 4500, status: 'intact', last_bleaching: 2010,
    bleaching_events_since_2000: 1,
    threats: ['tourism pressure (rapidly growing)', 'fishing'],
    notable_species: '1,427 reef fish species (most diverse on Earth), 600 hard coral species',
    notes: 'Apex of the Coral Triangle. Highest reef-fish biodiversity ever recorded. Mostly intact.' },
  { name: 'Wakatobi', country: 'ID', region: 'Asia-Pacific',
    lat: -5.50, lng: 124.00, area_km2: 1390, status: 'degraded', last_bleaching: 2020,
    bleaching_events_since_2000: 3,
    threats: ['blast fishing (historical)', 'tourism'],
    notable_species: '850+ coral species, 942 fish',
    notes: 'Indonesia\'s 2nd-largest marine national park. Recovery underway after blast-fishing curbed.' },
  { name: 'Tubbataha Reef', country: 'PH', region: 'Asia-Pacific',
    lat: 8.85, lng: 119.92, area_km2: 970, status: 'intact', last_bleaching: 2020,
    bleaching_events_since_2000: 2,
    threats: ['warming', 'occasional poaching'],
    notable_species: '600 fish species, manta rays, 11 shark species',
    notes: 'UNESCO World Heritage atoll in the middle of Sulu Sea — only reachable by liveaboard. Among the most pristine reefs globally.' },
  { name: 'Apo Reef', country: 'PH', region: 'Asia-Pacific',
    lat: 12.66, lng: 120.43, area_km2: 340, status: 'recovering', last_bleaching: 2020,
    bleaching_events_since_2000: 3,
    threats: ['historical overfishing', 'COTS outbreaks'],
    notable_species: '500 fish, 285 coral species',
    notes: 'Philippines\' 2nd-largest contiguous reef. Recovering since 2007 fishery exclusion.' },
  { name: 'Bird\'s Head Seascape (Cenderawasih)', country: 'ID', region: 'Asia-Pacific',
    lat: -2.50, lng: 135.00, area_km2: 1480, status: 'intact', last_bleaching: 2010,
    bleaching_events_since_2000: 1,
    threats: ['minor coastal development'],
    notable_species: 'whale sharks aggregating at lift nets, 953 reef fish',
    notes: 'Northwest Papua reefs. Whale-shark interaction with bagans (lift nets) is unique tourism + conservation model.' },
  { name: 'Coral Sea Marine Park', country: 'AU', region: 'Asia-Pacific',
    lat: -17.00, lng: 152.00, area_km2: 35000, status: 'degraded', last_bleaching: 2024,
    bleaching_events_since_2000: 4,
    threats: ['warming', 'cyclone damage'],
    notable_species: 'Osprey Reef shark aggregations',
    notes: 'World\'s largest marine park (closed 2018 from commercial fishing). Adjacent to GBR; similar climate trajectory.' },

  // ── Indian Ocean ──
  { name: 'Maldives', country: 'MV', region: 'Asia-Pacific',
    lat: 3.20, lng: 73.00, area_km2: 8920, status: 'degraded', last_bleaching: 2024,
    bleaching_events_since_2000: 4,
    threats: ['sea-level rise', 'mass bleaching', 'tourism infrastructure', 'sand mining'],
    notable_species: '250 coral species, manta ray aggregations',
    notes: '1190 islands on 26 atolls. 1998 bleaching killed 90% of shallow corals; partial recovery interrupted by 2016 + 2020 events.' },
  { name: 'Chagos Archipelago', country: 'IO', region: 'Asia-Pacific',
    lat: -6.50, lng: 71.50, area_km2: 19000, status: 'recovering', last_bleaching: 2016,
    bleaching_events_since_2000: 3,
    threats: ['regional warming', 'distant pollution'],
    notable_species: 'green turtles, 300+ coral species',
    notes: 'World\'s largest no-take marine protected area. Resilient — 60% live coral recovery since 2016 bleaching.' },
  { name: 'Aldabra Atoll', country: 'SC', region: 'Africa',
    lat: -9.40, lng: 46.40, area_km2: 155, status: 'intact', last_bleaching: 2016,
    bleaching_events_since_2000: 2,
    threats: ['warming'],
    notable_species: 'giant tortoise habitat, 200 fish species',
    notes: 'UNESCO World Heritage. Seychelles\' raised-atoll reef. Limited human access has preserved exceptional condition.' },
  { name: 'Bazaruto Archipelago', country: 'MZ', region: 'Africa',
    lat: -21.65, lng: 35.45, area_km2: 1430, status: 'degraded', last_bleaching: 2016,
    bleaching_events_since_2000: 2,
    threats: ['gas exploration', 'overfishing'],
    notable_species: 'last viable East African dugong population',
    notes: 'Mozambique\'s flagship marine protected area. Dugong refuge.' },
  { name: 'Pemba Channel', country: 'TZ', region: 'Africa',
    lat: -5.20, lng: 39.80, area_km2: 870, status: 'degraded', last_bleaching: 2016,
    bleaching_events_since_2000: 3,
    threats: ['dynamite fishing (decreasing)', 'sedimentation'],
    notable_species: '350 fish species',
    notes: 'Pemba is steeper-walled than nearby Zanzibar reefs; better recovery rates.' },
  { name: 'Lakshadweep', country: 'IN', region: 'Asia-Pacific',
    lat: 10.50, lng: 72.50, area_km2: 4200, status: 'critical', last_bleaching: 2024,
    bleaching_events_since_2000: 4,
    threats: ['warming', 'tourism push'],
    notable_species: '600 fish species',
    notes: 'India\'s only coral atolls. 2024 bleaching killed ~85% of live coral in some sites — among worst documented anywhere.' },

  // ── Americas ──
  { name: 'Florida Reef', country: 'US', region: 'North America',
    lat: 25.00, lng: -80.50, area_km2: 1400, status: 'critical', last_bleaching: 2023,
    bleaching_events_since_2000: 6,
    threats: ['stony coral tissue loss disease', 'unprecedented 2023 heat stress (>38°C)', 'land-based pollution'],
    notable_species: 'staghorn coral (critically endangered)',
    notes: 'Lost >90% of stony coral since 1970s. 2023 marine heatwave caused near-complete bleaching in upper Keys; nursery emergency rescues ongoing.' },
  { name: 'Bahamas Banks', country: 'BS', region: 'North America',
    lat: 24.50, lng: -77.50, area_km2: 3150, status: 'degraded', last_bleaching: 2023,
    bleaching_events_since_2000: 4,
    threats: ['SCTLD', 'hurricanes', 'cruise tourism'],
    notable_species: 'andros barrier reef (3rd longest in world)',
    notes: 'Andros Reef is the world\'s 3rd-longest barrier reef. Sand bank shelters elsewhere give Bahamas resilience advantage.' },
  { name: 'Galápagos', country: 'EC', region: 'South America',
    lat: -0.50, lng: -91.00, area_km2: 200, status: 'recovering', last_bleaching: 2016,
    bleaching_events_since_2000: 3,
    threats: ['ENSO events', 'ocean acidification'],
    notable_species: 'iguana foraging on algae, 31 coral species',
    notes: '1982-83 + 1997-98 El Niños wiped out ~95% of coral. Slow recovery since. Marine reserve expanded 2022.' },
  { name: 'Cayman Islands', country: 'KY', region: 'North America',
    lat: 19.30, lng: -81.30, area_km2: 110, status: 'degraded', last_bleaching: 2023,
    bleaching_events_since_2000: 3,
    threats: ['SCTLD', 'lionfish invasion'],
    notable_species: 'Bloody Bay Wall — popular dive site',
    notes: 'Strict marine protection has kept Cayman reefs in better shape than most Caribbean neighbours.' },
  { name: 'Roatán / Bay Islands', country: 'HN', region: 'North America',
    lat: 16.36, lng: -86.50, area_km2: 730, status: 'critical', last_bleaching: 2023,
    bleaching_events_since_2000: 4,
    threats: ['SCTLD', 'tourism overdevelopment', 'sediment'],
    notable_species: 'whale shark aggregations at Utila',
    notes: 'Northern Mesoamerican Barrier Reef segment. Tourism pressure on a thin reef margin.' },
  { name: 'Cuban Reefs (Jardines de la Reina)', country: 'CU', region: 'North America',
    lat: 20.85, lng: -78.78, area_km2: 2170, status: 'recovering', last_bleaching: 2023,
    bleaching_events_since_2000: 3,
    threats: ['warming', 'limited Cuban access for monitoring'],
    notable_species: 'Caribbean reef sharks, goliath grouper',
    notes: 'Best-preserved Caribbean reef. Cuba\'s isolation + 1996 marine reserve declaration protected it from worst Caribbean declines.' },
  { name: 'Veracruz Reef System', country: 'MX', region: 'North America',
    lat: 19.20, lng: -96.10, area_km2: 525, status: 'critical', last_bleaching: 2023,
    bleaching_events_since_2000: 4,
    threats: ['port expansion', 'urban runoff', 'oil terminals'],
    notable_species: '350 fish species (Gulf of Mexico endemic)',
    notes: 'Gulf of Mexico\'s only major reef. Threatened by Veracruz port expansion + agriculture runoff from Coatzacoalcos.' },

  // ── Pacific (oceanic) ──
  { name: 'Hawaiian Reefs', country: 'US', region: 'North America',
    lat: 21.00, lng: -157.50, area_km2: 4100, status: 'degraded', last_bleaching: 2019,
    bleaching_events_since_2000: 3,
    threats: ['warming', 'sunscreen pollution', 'land-based runoff'],
    notable_species: 'monk seal, 25% endemic fish',
    notes: 'Main + NW Hawaiian Islands. Oxybenzone sunscreen ban (2018) was a global first.' },
  { name: 'Tuamotu Atolls', country: 'PF', region: 'Asia-Pacific',
    lat: -17.00, lng: -142.00, area_km2: 6900, status: 'intact', last_bleaching: 2020,
    bleaching_events_since_2000: 2,
    threats: ['cyclones', 'climate warming'],
    notable_species: 'grey reef shark aggregations at Fakarava',
    notes: 'World\'s largest atoll chain (77 atolls). Fakarava South Pass: 700 grey reef sharks aggregate there for spawning — unique density anywhere.' },
  { name: 'Ningaloo Reef', country: 'AU', region: 'Asia-Pacific',
    lat: -22.50, lng: 113.80, area_km2: 5000, status: 'recovering', last_bleaching: 2022,
    bleaching_events_since_2000: 3,
    threats: ['warming', 'gas exploration'],
    notable_species: 'whale shark seasonal aggregation (Mar-Aug)',
    notes: 'Western Australia\'s fringing reef. Recovered well after 2010-11 marine heatwave. World-renowned whale shark site.' },
  { name: 'Yonaguni / Ryukyu Reefs', country: 'JP', region: 'Asia-Pacific',
    lat: 24.45, lng: 123.00, area_km2: 1620, status: 'critical', last_bleaching: 2022,
    bleaching_events_since_2000: 3,
    threats: ['warming', 'crown-of-thorns', 'Acanthaster outbreaks'],
    notable_species: 'hammerhead schools (winter)',
    notes: 'Japan\'s southernmost reefs. 2022 bleaching killed ~60% of Sekisei Lagoon corals.' },

  // ── Other notable ──
  { name: 'Persian Gulf Reefs', country: 'multi', region: 'Middle East',
    lat: 26.00, lng: 52.00, area_km2: 3800, status: 'degraded', last_bleaching: 2022,
    bleaching_events_since_2000: 5,
    threats: ['extreme summer temps (35°C+)', 'oil pollution', 'desalination'],
    notable_species: 'most heat-tolerant corals on Earth',
    notes: 'Survives in water that would kill most reef-building corals (regularly 35°C). Genetic insights for assisted evolution research.' },
  { name: 'Andaman Sea Reefs', country: 'TH', region: 'Asia-Pacific',
    lat: 8.50, lng: 98.30, area_km2: 1700, status: 'degraded', last_bleaching: 2024,
    bleaching_events_since_2000: 4,
    threats: ['warming', 'tourism (Phi Phi)', 'sedimentation'],
    notable_species: '210 coral species',
    notes: 'Thai-side reefs (Similan, Surin, Phi Phi). 2010 closure of some sites for recovery was world\'s first national tourism-driven reef closure.' },
];

export async function GET() {
  const byStatus: Record<string, number> = {};
  let total_area = 0;
  for (const r of REEFS) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    total_area += r.area_km2;
  }
  const maxArea = REEFS.reduce((m, r) => Math.max(m, r.area_km2), 0) || 1;
  const reefs = REEFS.map(r => ({
    ...r,
    intensity: Math.min(1, Math.sqrt(r.area_km2 / maxArea)),
  }));
  return NextResponse.json({
    reefs,
    total: REEFS.length,
    total_area_km2: total_area,
    by_status: byStatus,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
