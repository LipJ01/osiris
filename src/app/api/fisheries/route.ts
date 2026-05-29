import { NextResponse } from 'next/server';

/**
 * OSIRIS — Fish Stock Health
 *
 * Curated dataset of major commercial fisheries with their current stock
 * status (overfished / fully-fished / healthy / recovering / collapsed) per
 * the latest FAO SOFIA reports + NOAA Stock SMART + ICES advisories.
 *
 * Status taxonomy:
 *   collapsed   — biomass <10% of historical, fishery closed or near-closed
 *   overfished  — below B_MSY, F > F_MSY, rebuilding plan often in place
 *   recovering  — currently below target but trending up
 *   fully       — fished at or near MSY, no slack remaining
 *   healthy     — biomass above B_MSY, sustainable harvest
 *
 * Static dataset — zero external calls.
 */

type StockStatus = 'collapsed' | 'overfished' | 'recovering' | 'fully' | 'healthy';

interface Stock {
  name: string;          // human-readable fishery name
  species: string;       // common name
  scientific: string;    // latin
  lat: number;
  lng: number;
  fao_area: string;      // FAO Major Fishing Area number + name
  status: StockStatus;
  biomass_pct: number | null;  // % of B_MSY (100 = at MSY)
  notes: string;         // short context line
  source: string;        // attribution
  year: number;          // assessment year
}

const STOCKS: Stock[] = [
  // ── North Atlantic ──
  { name: 'Grand Banks Cod', species: 'Atlantic Cod', scientific: 'Gadus morhua', lat: 46.0, lng: -50.0,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'collapsed', biomass_pct: 8,
    notes: 'Collapsed 1992, moratorium ongoing. Northern stock still <10% of historical biomass.',
    source: 'DFO Canada / NAFO', year: 2024 },
  { name: 'Gulf of Maine Cod', species: 'Atlantic Cod', scientific: 'Gadus morhua', lat: 43.5, lng: -68.5,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'overfished', biomass_pct: 22,
    notes: 'Below rebuilding target since 2014, F > F_MSY, severe quota cuts in place.',
    source: 'NOAA Stock SMART', year: 2024 },
  { name: 'Georges Bank Haddock', species: 'Haddock', scientific: 'Melanogrammus aeglefinus', lat: 41.7, lng: -67.5,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'healthy', biomass_pct: 145,
    notes: 'Rebuilt from 1990s lows. Biomass well above B_MSY since 2013.',
    source: 'NOAA Stock SMART', year: 2024 },
  { name: 'Barents Sea Cod', species: 'Atlantic Cod', scientific: 'Gadus morhua', lat: 73.0, lng: 30.0,
    fao_area: 'FAO 27 — Atlantic Northeast', status: 'healthy', biomass_pct: 132,
    notes: 'Norway/Russia co-managed. Largest cod stock in the world, sustainably harvested.',
    source: 'ICES NEAFC', year: 2024 },
  { name: 'North Sea Cod', species: 'Atlantic Cod', scientific: 'Gadus morhua', lat: 56.0, lng: 3.5,
    fao_area: 'FAO 27 — Atlantic Northeast', status: 'overfished', biomass_pct: 38,
    notes: 'Below B_lim repeatedly since 2017. ICES advises zero catch in several years.',
    source: 'ICES', year: 2024 },
  { name: 'Icelandic Cod', species: 'Atlantic Cod', scientific: 'Gadus morhua', lat: 64.5, lng: -22.0,
    fao_area: 'FAO 27 — Atlantic Northeast', status: 'healthy', biomass_pct: 118,
    notes: 'Recovered from 1990s collapse via strict TAC + 20% HCR. Best-managed cod fishery globally.',
    source: 'Marine Research Institute Iceland', year: 2024 },
  { name: 'North-East Atlantic Mackerel', species: 'Atlantic Mackerel', scientific: 'Scomber scombrus', lat: 60.0, lng: -10.0,
    fao_area: 'FAO 27 — Atlantic Northeast', status: 'overfished', biomass_pct: 65,
    notes: 'Unilateral quotas by Iceland/Faroes/Norway/EU/UK exceed ICES advice by ~40%.',
    source: 'ICES', year: 2024 },
  { name: 'Norwegian Spring Herring', species: 'Atlantic Herring', scientific: 'Clupea harengus', lat: 67.0, lng: 5.0,
    fao_area: 'FAO 27 — Atlantic Northeast', status: 'fully', biomass_pct: 102,
    notes: 'At MSY. Quota disputes between EU/UK/Norway/Iceland threaten sustainability.',
    source: 'ICES', year: 2024 },
  { name: 'Bay of Biscay Anchovy', species: 'European Anchovy', scientific: 'Engraulis encrasicolus', lat: 45.0, lng: -3.0,
    fao_area: 'FAO 27 — Atlantic Northeast', status: 'recovering', biomass_pct: 78,
    notes: 'Closed 2005-2009, recovered after fishery moratorium. Currently rebuilding.',
    source: 'ICES', year: 2024 },

  // ── Mediterranean ──
  { name: 'Mediterranean Bluefin Tuna', species: 'Atlantic Bluefin', scientific: 'Thunnus thynnus', lat: 38.0, lng: 8.0,
    fao_area: 'FAO 37 — Mediterranean & Black Sea', status: 'recovering', biomass_pct: 92,
    notes: 'Iconic recovery story. From <15% B_MSY in 2007 to near-target by 2024 via ICCAT quota discipline.',
    source: 'ICCAT', year: 2024 },
  { name: 'Adriatic Sardine', species: 'European Pilchard', scientific: 'Sardina pilchardus', lat: 43.5, lng: 14.5,
    fao_area: 'FAO 37 — Mediterranean & Black Sea', status: 'overfished', biomass_pct: 41,
    notes: 'GFCM rebuilding plan in effect. Croatia/Italy contention.',
    source: 'GFCM', year: 2024 },
  { name: 'Western Med Hake', species: 'European Hake', scientific: 'Merluccius merluccius', lat: 40.0, lng: 5.0,
    fao_area: 'FAO 37 — Mediterranean & Black Sea', status: 'overfished', biomass_pct: 18,
    notes: 'F at 5-6× F_MSY for decades. One of the most overfished stocks in the world.',
    source: 'GFCM / STECF', year: 2024 },

  // ── US Pacific ──
  { name: 'Alaska Pollock', species: 'Walleye Pollock', scientific: 'Gadus chalcogrammus', lat: 58.0, lng: -170.0,
    fao_area: 'FAO 67 — Pacific Northeast', status: 'healthy', biomass_pct: 158,
    notes: 'Largest US fishery by volume. MSC-certified, model of science-based management.',
    source: 'NOAA / NPFMC', year: 2024 },
  { name: 'Bristol Bay Sockeye Salmon', species: 'Sockeye Salmon', scientific: 'Oncorhynchus nerka', lat: 58.5, lng: -158.5,
    fao_area: 'FAO 67 — Pacific Northeast', status: 'healthy', biomass_pct: 215,
    notes: 'Record runs 2021-2024 (60M+ fish). Escapement goals consistently met or exceeded.',
    source: 'ADF&G', year: 2024 },
  { name: 'Pacific Sardine', species: 'Pacific Sardine', scientific: 'Sardinops sagax', lat: 34.0, lng: -120.5,
    fao_area: 'FAO 77 — Pacific Eastern Central', status: 'collapsed', biomass_pct: 5,
    notes: 'Northern stock <10% of biomass cap since 2015. Commercial fishery closed annually since 2015.',
    source: 'PFMC', year: 2024 },
  { name: 'Dungeness Crab (PNW)', species: 'Dungeness Crab', scientific: 'Metacarcinus magister', lat: 45.0, lng: -124.0,
    fao_area: 'FAO 67 — Pacific Northeast', status: 'healthy', biomass_pct: 130,
    notes: 'Sex-size-season management sustains the stock; landings volatile with ocean conditions.',
    source: 'ODFW / WDFW', year: 2024 },
  { name: 'California Chinook Salmon', species: 'Chinook Salmon', scientific: 'Oncorhynchus tshawytscha', lat: 38.0, lng: -123.0,
    fao_area: 'FAO 77 — Pacific Eastern Central', status: 'collapsed', biomass_pct: 11,
    notes: 'Sacramento fall-run at record lows. Commercial + recreational fisheries closed 2023, 2024.',
    source: 'PFMC', year: 2024 },

  // ── US Atlantic ──
  { name: 'Atlantic Sea Scallops', species: 'Sea Scallop', scientific: 'Placopecten magellanicus', lat: 40.5, lng: -69.0,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'healthy', biomass_pct: 178,
    notes: 'Rotational area management produces one of the most valuable US fisheries (~$500M/yr).',
    source: 'NEFMC', year: 2024 },
  { name: 'New England Lobster', species: 'American Lobster', scientific: 'Homarus americanus', lat: 43.5, lng: -69.0,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'fully', biomass_pct: 95,
    notes: 'Gulf of Maine stock at MSY; Southern New England stock has collapsed since 2000.',
    source: 'ASMFC', year: 2024 },
  { name: 'Atlantic Menhaden', species: 'Atlantic Menhaden', scientific: 'Brevoortia tyrannus', lat: 37.0, lng: -75.5,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'fully', biomass_pct: 108,
    notes: 'Ecosystem-based reference points adopted 2020. Critical forage species for striped bass, ospreys.',
    source: 'ASMFC', year: 2024 },
  { name: 'Striped Bass', species: 'Striped Bass', scientific: 'Morone saxatilis', lat: 38.5, lng: -75.0,
    fao_area: 'FAO 21 — Atlantic Northwest', status: 'overfished', biomass_pct: 58,
    notes: 'Coastwide stock overfished since 2019, rebuilding plan targets 2029.',
    source: 'ASMFC', year: 2024 },

  // ── South Atlantic / South America ──
  { name: 'Patagonian Toothfish', species: 'Patagonian Toothfish', scientific: 'Dissostichus eleginoides', lat: -54.0, lng: -60.0,
    fao_area: 'FAO 41 — Atlantic Southwest', status: 'fully', biomass_pct: 100,
    notes: 'CCAMLR-managed in the Southern Ocean. Sold as "Chilean sea bass". IUU fishing pressure ongoing.',
    source: 'CCAMLR', year: 2024 },
  { name: 'Argentine Hake', species: 'Argentine Hake', scientific: 'Merluccius hubbsi', lat: -44.0, lng: -60.0,
    fao_area: 'FAO 41 — Atlantic Southwest', status: 'overfished', biomass_pct: 47,
    notes: 'Argentina/Uruguay shared stock. Heavy trawl pressure, juvenile bycatch.',
    source: 'INIDEP', year: 2024 },
  { name: 'Peruvian Anchoveta', species: 'Peruvian Anchoveta', scientific: 'Engraulis ringens', lat: -10.0, lng: -78.5,
    fao_area: 'FAO 87 — Pacific Southeast', status: 'fully', biomass_pct: 100,
    notes: 'Largest single-species fishery in the world (~5M t/yr). Closure-based management vs ENSO.',
    source: 'IMARPE', year: 2024 },
  { name: 'Chilean Jack Mackerel', species: 'Jack Mackerel', scientific: 'Trachurus murphyi', lat: -32.0, lng: -76.0,
    fao_area: 'FAO 87 — Pacific Southeast', status: 'recovering', biomass_pct: 82,
    notes: 'Crashed to ~10% in 2010, recovering under SPRFMO TACs.',
    source: 'SPRFMO', year: 2024 },

  // ── West Africa ──
  { name: 'West African Sardinella', species: 'Round Sardinella', scientific: 'Sardinella aurita', lat: 17.0, lng: -17.0,
    fao_area: 'FAO 34 — Atlantic Eastern Central', status: 'overfished', biomass_pct: 35,
    notes: 'Senegal/Mauritania/Morocco shared. Chinese/EU/Russian distant-water fleet pressure.',
    source: 'CECAF / FAO', year: 2024 },
  { name: 'Gulf of Guinea Tuna', species: 'Skipjack Tuna', scientific: 'Katsuwonus pelamis', lat: 0.0, lng: 0.0,
    fao_area: 'FAO 34 — Atlantic Eastern Central', status: 'fully', biomass_pct: 100,
    notes: 'ICCAT-managed. FAD-set purse seine dominant, juvenile catch concerns.',
    source: 'ICCAT', year: 2024 },

  // ── Indian Ocean ──
  { name: 'Indian Ocean Yellowfin Tuna', species: 'Yellowfin Tuna', scientific: 'Thunnus albacares', lat: -5.0, lng: 65.0,
    fao_area: 'FAO 51 — Indian Ocean Western', status: 'overfished', biomass_pct: 60,
    notes: 'IOTC scientists advised 30%+ catch cuts since 2015; member states have repeatedly failed to adopt.',
    source: 'IOTC', year: 2024 },
  { name: 'Maldives Skipjack Tuna', species: 'Skipjack Tuna', scientific: 'Katsuwonus pelamis', lat: 3.0, lng: 73.0,
    fao_area: 'FAO 51 — Indian Ocean Western', status: 'healthy', biomass_pct: 125,
    notes: 'Pole-and-line fishery, MSC-certified, one of the most sustainable tuna fisheries globally.',
    source: 'IOTC / MSC', year: 2024 },

  // ── Western Pacific ──
  { name: 'Western Pacific Skipjack', species: 'Skipjack Tuna', scientific: 'Katsuwonus pelamis', lat: 0.0, lng: 160.0,
    fao_area: 'FAO 71 — Pacific Western Central', status: 'healthy', biomass_pct: 145,
    notes: 'WCPFC-managed. World’s largest tuna fishery (~1.8M t/yr). PNA vessel-day scheme effective.',
    source: 'WCPFC', year: 2024 },
  { name: 'Pacific Bigeye Tuna', species: 'Bigeye Tuna', scientific: 'Thunnus obesus', lat: 5.0, lng: 170.0,
    fao_area: 'FAO 71 — Pacific Western Central', status: 'fully', biomass_pct: 100,
    notes: 'At reference point. FAD effort caps under negotiation.',
    source: 'WCPFC', year: 2024 },
  { name: 'Japanese Pacific Bluefin', species: 'Pacific Bluefin Tuna', scientific: 'Thunnus orientalis', lat: 35.0, lng: 140.0,
    fao_area: 'FAO 61 — Pacific Northwest', status: 'recovering', biomass_pct: 75,
    notes: 'Was at <4% in 2010; recovery driven by hard juvenile catch limits.',
    source: 'ISC / WCPFC', year: 2024 },
  { name: 'Sea of Okhotsk Pollock', species: 'Walleye Pollock', scientific: 'Gadus chalcogrammus', lat: 55.0, lng: 145.0,
    fao_area: 'FAO 61 — Pacific Northwest', status: 'healthy', biomass_pct: 140,
    notes: 'Russian-managed. Second-largest pollock stock after EBS.',
    source: 'VNIRO', year: 2024 },

  // ── Southern Ocean / Antarctic ──
  { name: 'Antarctic Krill', species: 'Antarctic Krill', scientific: 'Euphausia superba', lat: -62.0, lng: -50.0,
    fao_area: 'FAO 48 — Antarctic Atlantic', status: 'fully', biomass_pct: 100,
    notes: 'CCAMLR-managed. Climate-driven range contraction is the real risk, not fishing.',
    source: 'CCAMLR', year: 2024 },

  // ── Oceania ──
  { name: 'Orange Roughy (NZ)', species: 'Orange Roughy', scientific: 'Hoplostethus atlanticus', lat: -42.0, lng: 175.0,
    fao_area: 'FAO 81 — Pacific Southwest', status: 'recovering', biomass_pct: 70,
    notes: 'Deep-sea seamount stocks collapsed in 1990s; some now rebuilt under MSC certification.',
    source: 'NIWA / MPI NZ', year: 2024 },
  { name: 'South Pacific Albacore', species: 'Albacore Tuna', scientific: 'Thunnus alalunga', lat: -20.0, lng: -160.0,
    fao_area: 'FAO 77 — Pacific Eastern Central', status: 'healthy', biomass_pct: 130,
    notes: 'WCPFC-managed. Pacific Island nations rely on this stock for export revenue.',
    source: 'WCPFC', year: 2024 },
];

export async function GET() {
  // Quick aggregate summary for HUDs.
  const summary: Record<StockStatus, number> = {
    collapsed: 0, overfished: 0, recovering: 0, fully: 0, healthy: 0,
  };
  for (const s of STOCKS) summary[s.status]++;

  return NextResponse.json({
    stocks: STOCKS,
    total: STOCKS.length,
    summary,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
