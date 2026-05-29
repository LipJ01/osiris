import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Forest Biomes
 *
 * Curated dataset of the world's most significant forest ecosystems —
 * weighted toward intact frontier forests, biodiversity hotspots, and
 * the regions losing the most cover annually. Numbers reference Global
 * Forest Watch + Hansen Lab tree-cover data (2024), WRI carbon density
 * estimates, and FAO Forest Resources Assessment 2020.
 *
 *   area_kha            thousands of hectares of forest cover
 *   annual_loss_kha     average ha/yr lost over last 5 yrs (Hansen)
 *   carbon_gt           above-ground carbon stored, gigatonnes
 *   status              intact | degraded | critical | recovering
 *   threats             short list of dominant drivers of loss
 */

type ForestStatus = 'intact' | 'degraded' | 'critical' | 'recovering';

interface Forest {
  name: string;
  country: string;      // dominant country (or "multi")
  region: string;
  lat: number;
  lng: number;
  area_kha: number;
  annual_loss_kha: number;
  loss_pct_yr: number;  // % of cover lost per year (annual_loss / area * 100)
  carbon_gt: number;
  status: ForestStatus;
  threats: string[];
  notes: string;
}

// Marker location is a representative centroid for the biome — biomes can
// span millions of km², the dot is just an anchor for the popup.
const FORESTS: Forest[] = [
  // ── Tropical Rainforests (the big three) ──
  { name: 'Amazon Rainforest', country: 'BR/PE/CO/VE', region: 'South America',
    lat: -3.50, lng: -62.50, area_kha: 550000, annual_loss_kha: 1800, loss_pct_yr: 0.33,
    carbon_gt: 86, status: 'critical',
    threats: ['cattle ranching', 'soy expansion', 'illegal mining', 'roads'],
    notes: 'Largest rainforest on Earth. Brazilian Amazon loss fell 50% in 2023 under Lula but Bolivian/Peruvian/Colombian fronts accelerating.' },
  { name: 'Congo Basin', country: 'CD/CG/CM/GA', region: 'Africa',
    lat: 0.50, lng: 22.00, area_kha: 300000, annual_loss_kha: 1230, loss_pct_yr: 0.41,
    carbon_gt: 60, status: 'degraded',
    threats: ['slash-and-burn agriculture', 'industrial logging', 'charcoal'],
    notes: 'Second-largest rainforest. DRC alone holds 60% of the basin; world\'s only net-carbon-sink large rainforest.' },
  { name: 'Sundaland Rainforest', country: 'ID/MY', region: 'Asia-Pacific',
    lat: 1.50, lng: 113.00, area_kha: 105000, annual_loss_kha: 480, loss_pct_yr: 0.46,
    carbon_gt: 24, status: 'critical',
    threats: ['palm oil', 'pulp & paper', 'peatland fires'],
    notes: 'Borneo + Sumatra. Lost 50% of cover since 1973. Orangutan, Sumatran tiger habitat.' },
  { name: 'New Guinea Rainforest', country: 'PG/ID', region: 'Asia-Pacific',
    lat: -5.00, lng: 142.00, area_kha: 78000, annual_loss_kha: 60, loss_pct_yr: 0.08,
    carbon_gt: 13, status: 'intact',
    threats: ['logging concessions', 'palm oil expansion'],
    notes: 'Third-largest contiguous rainforest. Most intact lowland tropical forest on Earth.' },

  // ── Boreal / Taiga ──
  { name: 'Russian Boreal (Taiga)', country: 'RU', region: 'Russia & Caspian',
    lat: 62.00, lng: 100.00, area_kha: 760000, annual_loss_kha: 4500, loss_pct_yr: 0.59,
    carbon_gt: 110, status: 'degraded',
    threats: ['wildfires (climate-driven)', 'illegal logging', 'permafrost thaw'],
    notes: 'Largest contiguous forest on Earth. Wildfire loss now exceeds Amazon deforestation in some years.' },
  { name: 'Canadian Boreal', country: 'CA', region: 'North America',
    lat: 55.00, lng: -100.00, area_kha: 290000, annual_loss_kha: 1100, loss_pct_yr: 0.38,
    carbon_gt: 70, status: 'degraded',
    threats: ['oil sands expansion', 'wildfires', 'mountain pine beetle'],
    notes: '2023 wildfire season burned 18.5 Mha — twice the previous record.' },
  { name: 'Scandinavian Boreal', country: 'SE/FI/NO', region: 'Europe',
    lat: 65.00, lng: 19.00, area_kha: 53000, annual_loss_kha: 250, loss_pct_yr: 0.47,
    carbon_gt: 5, status: 'degraded',
    threats: ['rotational clear-cut forestry', 'biofuel demand'],
    notes: 'Heavily managed plantations dominate — only ~5% remains old-growth.' },

  // ── Temperate Rainforests ──
  { name: 'Pacific Coastal Rainforest (Tongass + GBR)', country: 'US/CA', region: 'North America',
    lat: 57.00, lng: -134.00, area_kha: 14000, annual_loss_kha: 15, loss_pct_yr: 0.11,
    carbon_gt: 8, status: 'intact',
    threats: ['logging (recently restricted)', 'salmon-stream impacts'],
    notes: 'Largest intact temperate rainforest. Tongass (Alaska) Roadless Rule restored 2023.' },
  { name: 'Valdivian Temperate Rainforest', country: 'CL/AR', region: 'South America',
    lat: -42.00, lng: -73.00, area_kha: 12500, annual_loss_kha: 14, loss_pct_yr: 0.11,
    carbon_gt: 4, status: 'degraded',
    threats: ['eucalyptus plantations', 'fires', 'introduced species'],
    notes: 'Only major temperate rainforest in the southern hemisphere. Alerce (Patagonian cypress) trees >3,000 years old.' },
  { name: 'Daintree Rainforest', country: 'AU', region: 'Asia-Pacific',
    lat: -16.17, lng: 145.42, area_kha: 1200, annual_loss_kha: 0.5, loss_pct_yr: 0.04,
    carbon_gt: 0.3, status: 'intact',
    threats: ['tourism pressure', 'cyclones'],
    notes: 'Oldest continuously surviving tropical rainforest on Earth (~135 My).' },

  // ── Critically Threatened ──
  { name: 'Atlantic Forest (Mata Atlântica)', country: 'BR', region: 'South America',
    lat: -22.00, lng: -45.00, area_kha: 16000, annual_loss_kha: 60, loss_pct_yr: 0.38,
    carbon_gt: 2.8, status: 'critical',
    threats: ['urban sprawl (90M people live in original range)', 'sugarcane', 'fragmentation'],
    notes: 'Lost 88% of original cover. Among the most biodiverse and most-threatened forests globally.' },
  { name: 'Madagascar Forests', country: 'MG', region: 'Africa',
    lat: -18.50, lng: 47.00, area_kha: 12000, annual_loss_kha: 180, loss_pct_yr: 1.50,
    carbon_gt: 1.5, status: 'critical',
    threats: ['slash-and-burn (tavy)', 'charcoal', 'mining'],
    notes: 'Lost 44% of forest cover since 1953. ~80% of species endemic — extinction cascade in progress.' },
  { name: 'Guinean Forests of West Africa', country: 'multi', region: 'Africa',
    lat: 7.00, lng: -8.00, area_kha: 14000, annual_loss_kha: 200, loss_pct_yr: 1.43,
    carbon_gt: 2.2, status: 'critical',
    threats: ['cocoa expansion (Côte d\'Ivoire)', 'mining', 'subsistence agriculture'],
    notes: 'Côte d\'Ivoire alone lost 80% of forest 1960-2010. Western chimpanzee critically endangered.' },
  { name: 'Cerrado (Brazil)', country: 'BR', region: 'South America',
    lat: -13.00, lng: -48.00, area_kha: 65000, annual_loss_kha: 1110, loss_pct_yr: 1.71,
    carbon_gt: 7, status: 'critical',
    threats: ['soybean expansion (MATOPIBA frontier)', 'cattle ranching'],
    notes: 'Brazilian savanna. Now losing forest faster than Amazon under Lula — soy industry has shifted south.' },
  { name: 'Caatinga (Brazil)', country: 'BR', region: 'South America',
    lat: -8.50, lng: -40.00, area_kha: 49000, annual_loss_kha: 280, loss_pct_yr: 0.57,
    carbon_gt: 2, status: 'degraded',
    threats: ['firewood harvest', 'goat grazing', 'climate desertification'],
    notes: 'Semi-arid xerophytic forest. Only major dry forest entirely within Brazil.' },

  // ── Asian Frontier Forests ──
  { name: 'Eastern Himalayas', country: 'multi', region: 'Asia-Pacific',
    lat: 27.50, lng: 92.00, area_kha: 18000, annual_loss_kha: 70, loss_pct_yr: 0.39,
    carbon_gt: 4, status: 'degraded',
    threats: ['shifting cultivation', 'roads', 'hydropower'],
    notes: 'India/Bhutan/Myanmar — temperate to subtropical. Houses one-eyed snub-nosed monkey, red panda.' },
  { name: 'Mekong / Indo-Burma Forests', country: 'multi', region: 'Asia-Pacific',
    lat: 17.00, lng: 105.00, area_kha: 30000, annual_loss_kha: 350, loss_pct_yr: 1.17,
    carbon_gt: 5, status: 'critical',
    threats: ['rubber plantations', 'cassava', 'illegal wildlife trade'],
    notes: 'Cambodia, Laos, Vietnam, eastern Myanmar. Rapid conversion to monoculture cash crops.' },
  { name: 'Western Ghats', country: 'IN', region: 'Asia-Pacific',
    lat: 12.50, lng: 76.00, area_kha: 6000, annual_loss_kha: 20, loss_pct_yr: 0.33,
    carbon_gt: 1.0, status: 'degraded',
    threats: ['tea/coffee plantations', 'roads', 'fragmentation'],
    notes: 'UNESCO World Heritage. Older than the Himalayas. ~30% of India\'s plant species endemic here.' },
  { name: 'Russian Far East / Sikhote-Alin', country: 'RU', region: 'Russia & Caspian',
    lat: 47.00, lng: 137.00, area_kha: 18000, annual_loss_kha: 90, loss_pct_yr: 0.50,
    carbon_gt: 3, status: 'degraded',
    threats: ['illegal logging for Chinese market', 'wildfires', 'mining'],
    notes: 'Only place where Amur tiger and Far Eastern leopard co-exist.' },

  // ── African Frontier ──
  { name: 'Eastern Arc Mountains', country: 'TZ/KE', region: 'Africa',
    lat: -7.00, lng: 36.50, area_kha: 540, annual_loss_kha: 3, loss_pct_yr: 0.56,
    carbon_gt: 0.1, status: 'degraded',
    threats: ['agricultural encroachment', 'firewood', 'gold mining'],
    notes: '"Galápagos of Africa" — ancient sky-island forests with extreme endemism, in 13 fragmented blocks.' },
  { name: 'Albertine Rift Forests', country: 'multi', region: 'Africa',
    lat: -1.50, lng: 29.50, area_kha: 4500, annual_loss_kha: 35, loss_pct_yr: 0.78,
    carbon_gt: 1.0, status: 'critical',
    threats: ['agricultural pressure', 'civil conflict', 'charcoal'],
    notes: 'DRC/Uganda/Rwanda/Burundi border. Last mountain gorillas (Virunga, Bwindi).' },
  { name: 'Miombo Woodlands', country: 'multi', region: 'Africa',
    lat: -12.00, lng: 28.00, area_kha: 270000, annual_loss_kha: 750, loss_pct_yr: 0.28,
    carbon_gt: 18, status: 'degraded',
    threats: ['charcoal production', 'subsistence agriculture', 'tobacco curing'],
    notes: 'Largest dry tropical woodland on Earth. Stretches across 11 southern African countries.' },

  // ── Europe ──
  { name: 'Białowieża Forest', country: 'PL/BY', region: 'Europe',
    lat: 52.70, lng: 23.85, area_kha: 150, annual_loss_kha: 0.4, loss_pct_yr: 0.27,
    carbon_gt: 0.05, status: 'degraded',
    threats: ['bark-beetle salvage logging', 'border fence (since 2022)'],
    notes: 'Last primeval forest of European lowland; European bison stronghold.' },
  { name: 'Hyrcanian Forests', country: 'IR/AZ', region: 'Middle East',
    lat: 36.80, lng: 51.50, area_kha: 1900, annual_loss_kha: 8, loss_pct_yr: 0.42,
    carbon_gt: 0.4, status: 'degraded',
    threats: ['firewood', 'overgrazing', 'urbanisation along Caspian'],
    notes: 'Caspian Sea coast — ancient (25-50 My) broadleaf forest, glacial refuge.' },
  { name: 'Caledonian Forest', country: 'GB', region: 'Europe',
    lat: 57.10, lng: -4.70, area_kha: 18, annual_loss_kha: -0.5, loss_pct_yr: -2.78,
    carbon_gt: 0.01, status: 'recovering',
    threats: ['deer overgrazing (suppresses regeneration)', 'historic exploitation'],
    notes: 'Scotland\'s relict pine forest. ~1% of original extent but actively being restored (Trees for Life, Rewilding).' },

  // ── Recovering Stories ──
  { name: 'Costa Rica Lowland Forests', country: 'CR', region: 'North America',
    lat: 10.50, lng: -84.00, area_kha: 3000, annual_loss_kha: -10, loss_pct_yr: -0.33,
    carbon_gt: 0.8, status: 'recovering',
    threats: ['historic pasture conversion', 'tourism pressure'],
    notes: 'Doubled forest cover since 1985 via PES schemes — global poster child for reforestation.' },
  { name: 'New England Forest (US Northeast)', country: 'US', region: 'North America',
    lat: 44.00, lng: -71.50, area_kha: 13000, annual_loss_kha: 30, loss_pct_yr: 0.23,
    carbon_gt: 2.0, status: 'recovering',
    threats: ['suburban development', 'invasive pests (woolly adelgid)'],
    notes: 'Cleared 70% by 1850, rewilded back to 80% cover — largest accidental reforestation in modern history.' },

  // ── Specialised / Iconic ──
  { name: 'Mangrove Forests (Sundarbans)', country: 'BD/IN', region: 'Asia-Pacific',
    lat: 21.95, lng: 89.18, area_kha: 1000, annual_loss_kha: 5, loss_pct_yr: 0.50,
    carbon_gt: 0.6, status: 'degraded',
    threats: ['sea-level rise', 'shrimp aquaculture', 'cyclones'],
    notes: 'Largest contiguous mangrove forest. Bengal tiger habitat. Carbon density 5× upland forests.' },
  { name: 'Sequoia & Redwood (CA Sierra/Coast)', country: 'US', region: 'North America',
    lat: 40.50, lng: -124.00, area_kha: 280, annual_loss_kha: 1, loss_pct_yr: 0.36,
    carbon_gt: 0.4, status: 'degraded',
    threats: ['wildfires (Castle Fire 2020 killed 10% of all giant sequoias)', 'drought'],
    notes: 'World\'s tallest (Sequoia sempervirens) and most-massive (Sequoiadendron giganteum) trees.' },
  { name: 'Yakushima Cedar Forest', country: 'JP', region: 'Asia-Pacific',
    lat: 30.36, lng: 130.51, area_kha: 50, annual_loss_kha: 0.1, loss_pct_yr: 0.20,
    carbon_gt: 0.02, status: 'intact',
    threats: ['deer overgrazing', 'tourism on trails'],
    notes: 'UNESCO. Yaku-sugi cedars >2,000 years old; some claimed >7,000.' },
];

export async function GET() {
  const maxArea = FORESTS.reduce((m, f) => Math.max(m, f.area_kha), 0) || 1;
  const forests = FORESTS.map(f => ({
    ...f,
    intensity: Math.min(1, Math.sqrt(f.area_kha / maxArea)),  // sqrt so smaller forests still get a visible marker
  }));

  const totalArea = FORESTS.reduce((a, f) => a + f.area_kha, 0);
  const totalLoss = FORESTS.reduce((a, f) => a + Math.max(0, f.annual_loss_kha), 0);
  const totalCarbon = FORESTS.reduce((a, f) => a + f.carbon_gt, 0);
  const byStatus: Record<string, number> = {};
  for (const f of FORESTS) byStatus[f.status] = (byStatus[f.status] || 0) + 1;

  return NextResponse.json({
    forests,
    total: FORESTS.length,
    total_area_kha: totalArea,
    total_annual_loss_kha: totalLoss,
    total_carbon_gt: totalCarbon,
    by_status: byStatus,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
