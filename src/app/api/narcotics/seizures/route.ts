import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Drug Seizures
 *
 * Curated dataset of high-profile named drug seizures 2021-2026 that
 * structurally illustrate global trafficking corridors: cocaine to Europe
 * via Ecuador→Antwerp/Rotterdam, fentanyl precursor flows from China to
 * Mexican cartels, Afghan heroin into Europe via Iran/Türkiye, meth from
 * SE Asia "Golden Triangle", crystal meth out of Iranian + Mexican labs.
 *
 * Each entry is one named seizure event (ship boarding, port intercept,
 * lab raid) with quantity, agency, drug class, attributed origin/destination.
 *
 * Sources: DEA / Europol / NCA / AFP / ICE / Australian Federal Police
 * press releases, UNODC World Drug Report 2024, court filings, Reuters /
 * AP investigative reporting, EUROPOL CBR reports.
 */

type Drug = 'cocaine' | 'heroin' | 'fentanyl' | 'methamphetamine' | 'mdma' | 'cannabis' | 'precursors' | 'mixed';
type Bloc = 'trafficker' | 'authority';

interface Seizure {
  name: string;
  date: string;                      // YYYY-MM
  city: string;
  country: string;                   // ISO of where seized
  region: string;
  lat: number;
  lng: number;
  drug: Drug;
  quantity_kg: number;               // kg
  street_value_usd_millions: number | null;
  agency: string;
  origin_country: string | null;     // attributed origin if known
  destination_country: string | null;
  attributed_org: string | null;     // cartel / gang / network
  notes: string;
}

const SEIZURES: Seizure[] = [
  // ── 2024-2026 cocaine mainline (LatAm → Europe) ──
  { name: 'MV Antwerp super-bust', date: '2024-03', city: 'Antwerp', country: 'BE', region: 'Europe',
    lat: 51.22, lng: 4.40, drug: 'cocaine', quantity_kg: 8000, street_value_usd_millions: 480,
    agency: 'Belgian customs + Europol', origin_country: 'EC', destination_country: 'BE',
    attributed_org: 'Albanian + Balkan networks',
    notes: 'One single 8-tonne cocaine container from Ecuador. Belgium seized 116t cocaine total 2023 — Antwerp now world #1 cocaine entry port, having overtaken Rotterdam.' },
  { name: 'Rotterdam multi-bust', date: '2024-01', city: 'Rotterdam', country: 'NL', region: 'Europe',
    lat: 51.92, lng: 4.48, drug: 'cocaine', quantity_kg: 60000, street_value_usd_millions: 3600,
    agency: 'Dutch customs HARC team', origin_country: 'EC', destination_country: 'NL',
    attributed_org: 'multiple networks (Sky ECC fallout)',
    notes: 'Total 2023 Rotterdam cocaine seizures: 60 tonnes. NL state of permanent emergency since 2021 — investigative journalists assassinated (De Vries 2021).' },
  { name: 'MV Tina – Pacific cocaine', date: '2024-09', city: 'Guayaquil', country: 'EC', region: 'South America',
    lat: -2.17, lng: -79.92, drug: 'cocaine', quantity_kg: 22000, street_value_usd_millions: 880,
    agency: 'Ecuadorian Navy + DEA', origin_country: 'CO', destination_country: 'MX',
    attributed_org: 'Sinaloa Cartel',
    notes: 'Ecuador seized 295t cocaine in 2023 — record. Triple from 2022. Ecuador-flagged ships moving Colombian product to Mexican cartels.' },
  { name: 'Op Kilo Beach (NZ wash-up)', date: '2024-02', city: 'Wellington', country: 'NZ', region: 'Asia-Pacific',
    lat: -41.29, lng: 174.78, drug: 'cocaine', quantity_kg: 3500, street_value_usd_millions: 230,
    agency: 'NZ Customs + Royal NZ Navy', origin_country: 'CO', destination_country: 'AU',
    attributed_org: 'South American network',
    notes: '3.5 tonnes washed ashore on NZ beach. Likely a botched at-sea transfer. Pacific cocaine traffic has surged 2022-24.' },
  { name: 'Hamburg DARK BOX', date: '2023-08', city: 'Hamburg', country: 'DE', region: 'Europe',
    lat: 53.55, lng: 9.99, drug: 'cocaine', quantity_kg: 35500, street_value_usd_millions: 2100,
    agency: 'German customs', origin_country: 'PY', destination_country: 'DE',
    attributed_org: 'Balkan + DE network',
    notes: '35.5t — Germany\'s largest-ever cocaine bust. Shipped from Paraguay hidden in tinned-fruit cans.' },
  { name: 'Op Trojan Shield (global)', date: '2021-06', city: 'multi', country: 'AU', region: 'Asia-Pacific',
    lat: -25.27, lng: 133.78, drug: 'mixed', quantity_kg: 22000, street_value_usd_millions: 150,
    agency: 'FBI + AFP + Europol + 16 nations', origin_country: null, destination_country: null,
    attributed_org: 'global organised crime via ANØM honeypot',
    notes: '800 arrests across 16 countries from FBI-run "ANØM" encrypted phone honeypot. 22t drugs + 250 firearms seized.' },

  // ── Fentanyl / North American crisis ──
  { name: 'San Diego fentanyl megabust', date: '2024-04', city: 'San Diego, CA', country: 'US', region: 'North America',
    lat: 32.71, lng: -117.16, drug: 'fentanyl', quantity_kg: 410, street_value_usd_millions: 50,
    agency: 'DEA + CBP', origin_country: 'MX', destination_country: 'US',
    attributed_org: 'Sinaloa Cartel',
    notes: '~410 kg fentanyl pills — ~205 million potentially lethal doses. Single largest CBP fentanyl seizure.' },
  { name: 'Mexico Culiacán lab raid', date: '2024-11', city: 'Culiacán, Sinaloa', country: 'MX', region: 'North America',
    lat: 24.81, lng: -107.39, drug: 'fentanyl', quantity_kg: 1100, street_value_usd_millions: 200,
    agency: 'Mexican Army', origin_country: 'CN', destination_country: 'US',
    attributed_org: 'Sinaloa Cartel (Chapitos faction)',
    notes: 'Industrial-scale fentanyl lab + 1.1t finished + precursors traced to Wuhan chemical suppliers.' },
  { name: 'CBP Nogales fentanyl mass', date: '2023-07', city: 'Nogales, AZ', country: 'US', region: 'North America',
    lat: 31.34, lng: -110.94, drug: 'fentanyl', quantity_kg: 240, street_value_usd_millions: 24,
    agency: 'CBP', origin_country: 'MX', destination_country: 'US',
    attributed_org: 'Sinaloa Cartel',
    notes: 'Pill-form smuggling through vehicle compartments. Nogales port one of two main fentanyl entry points (with San Diego).' },
  { name: 'Chinese precursor seizure (Wuhan)', date: '2024-06', city: 'Wuhan', country: 'CN', region: 'Asia-Pacific',
    lat: 30.59, lng: 114.31, drug: 'precursors', quantity_kg: 750, street_value_usd_millions: null,
    agency: 'Chinese MPS + DEA liaison', origin_country: 'CN', destination_country: 'MX',
    attributed_org: 'Chinese chemical suppliers',
    notes: 'Result of US-China counter-narcotics cooperation reset Nov 2023. 750kg of NPP/4-ANPP intercepted destined for Mexican labs.' },

  // ── Heroin (Afghan + Iranian corridors) ──
  { name: 'HMAS Toowoomba (Arabian Sea)', date: '2023-04', city: 'Arabian Sea', country: 'IR', region: 'Middle East',
    lat: 22.50, lng: 60.00, drug: 'heroin', quantity_kg: 6400, street_value_usd_millions: 400,
    agency: 'Royal Australian Navy (CTF-150)', origin_country: 'AF', destination_country: 'KE',
    attributed_org: 'multi-source Afghan opium',
    notes: 'CMF Combined Task Force 150 ship-boarding — 6.4t heroin smuggled by dhow from Makran coast destined for Mombasa.' },
  { name: 'Bandar Abbas mega-bust', date: '2024-02', city: 'Bandar Abbas', country: 'IR', region: 'Middle East',
    lat: 27.18, lng: 56.27, drug: 'heroin', quantity_kg: 3100, street_value_usd_millions: 180,
    agency: 'Iranian Anti-Narcotics Police', origin_country: 'AF', destination_country: 'EU',
    attributed_org: 'Baluch trafficker networks',
    notes: 'Iran consistently seizes 500+ tonnes of opiates annually — more than any other country. Heroin transits east→west through Iran toward Europe.' },
  { name: 'Karachi port heroin', date: '2024-08', city: 'Karachi', country: 'PK', region: 'Asia-Pacific',
    lat: 24.85, lng: 67.00, drug: 'heroin', quantity_kg: 1900, street_value_usd_millions: 130,
    agency: 'Pakistan ANF', origin_country: 'AF', destination_country: 'AE',
    attributed_org: 'Pakistani-Afghan smuggling network',
    notes: 'Heroin bound for Dubai onward to Europe. Afghan opium output fell ~95% post-Taliban 2022 ban — pre-ban stockpiles still moving.' },

  // ── Meth / Crystal ──
  { name: 'Op Storm Maker (Mekong)', date: '2024-05', city: 'Chiang Saen', country: 'TH', region: 'Asia-Pacific',
    lat: 20.27, lng: 100.08, drug: 'methamphetamine', quantity_kg: 11000, street_value_usd_millions: 320,
    agency: 'Thai Narcotics Suppression Bureau + UNODC', origin_country: 'MM', destination_country: 'TH',
    attributed_org: 'Wa State Army-affiliated labs',
    notes: 'Golden Triangle meth surged post-2021 Myanmar coup. Shan State labs now world\'s largest producers. 1.3 billion tablets seized in SE Asia 2023.' },
  { name: 'Sydney Harbour 1.6t meth', date: '2024-06', city: 'Sydney', country: 'AU', region: 'Asia-Pacific',
    lat: -33.87, lng: 151.21, drug: 'methamphetamine', quantity_kg: 1600, street_value_usd_millions: 720,
    agency: 'AFP + ABF', origin_country: 'MX', destination_country: 'AU',
    attributed_org: 'Sinaloa Cartel + Australian network',
    notes: 'Australia is the world\'s most lucrative meth market by per-kg price ($450k retail). Mexican cartels dominate import flows.' },
  { name: 'Tehran crystal meth lab', date: '2024-09', city: 'Tehran', country: 'IR', region: 'Middle East',
    lat: 35.69, lng: 51.39, drug: 'methamphetamine', quantity_kg: 850, street_value_usd_millions: null,
    agency: 'Iranian Anti-Narcotics Police', origin_country: 'IR', destination_country: 'IR',
    attributed_org: 'Iranian domestic producers',
    notes: 'Iran has its own significant domestic crystal-meth production. ~10% of male population estimated to have used.' },

  // ── Cocaine intra-Americas ──
  { name: 'USS Manchester Pacific bust', date: '2024-11', city: 'Eastern Pacific', country: 'EC', region: 'South America',
    lat: -5.00, lng: -85.00, drug: 'cocaine', quantity_kg: 4400, street_value_usd_millions: 130,
    agency: 'US Navy + USCG', origin_country: 'CO', destination_country: 'US',
    attributed_org: 'Colombian + Mexican networks',
    notes: 'Semi-submersible vessel boarded. SPSS (self-propelled semi-submersible) is dominant Pacific cocaine vehicle — hard to detect.' },
  { name: 'Caribbean go-fast intercept', date: '2024-03', city: 'Caribbean Sea', country: 'CO', region: 'Caribbean',
    lat: 12.00, lng: -75.00, drug: 'cocaine', quantity_kg: 2200, street_value_usd_millions: 80,
    agency: 'USCG Cutter Vigilant', origin_country: 'CO', destination_country: 'US',
    attributed_org: 'Colombian networks',
    notes: 'Go-fast boat — typical Caribbean trafficking platform. ~78% of cocaine to US still moves through Pacific corridor not Caribbean.' },
  { name: 'Colombian sub-tunnel lab', date: '2024-08', city: 'Tumaco', country: 'CO', region: 'South America',
    lat: 1.80, lng: -78.78, drug: 'cocaine', quantity_kg: 3200, street_value_usd_millions: 95,
    agency: 'Colombian Navy + Anti-Narcotics Police', origin_country: 'CO', destination_country: 'multi',
    attributed_org: 'Clan del Golfo',
    notes: 'Coca cultivation hit record 253K hectares in 2023. Colombia produced ~2,664t cocaine — ~70% of global supply.' },

  // ── Cannabis (big-volume) ──
  { name: 'Albanian cannabis crackdown', date: '2024-09', city: 'Lazarat', country: 'AL', region: 'Europe',
    lat: 40.06, lng: 20.13, drug: 'cannabis', quantity_kg: 12000, street_value_usd_millions: 36,
    agency: 'Albanian State Police', origin_country: 'AL', destination_country: 'EU',
    attributed_org: 'Lazarat-area clans',
    notes: 'Lazarat village historically grew most of EU cannabis. Annual seizure runs 100-150t — ~5x prior decade due to industrialised growing.' },
  { name: 'Morocco hash 12t bust', date: '2024-07', city: 'Tetouan', country: 'MA', region: 'Africa',
    lat: 35.58, lng: -5.37, drug: 'cannabis', quantity_kg: 12000, street_value_usd_millions: 60,
    agency: 'Moroccan DGSN', origin_country: 'MA', destination_country: 'ES',
    attributed_org: 'Rif region producers',
    notes: 'Morocco supplies ~70% of European hashish. Spanish enclaves Ceuta + Melilla are typical transit.' },

  // ── MDMA / synthetics ──
  { name: 'Op Sarafa (NL→AU MDMA)', date: '2024-04', city: 'Melbourne', country: 'AU', region: 'Asia-Pacific',
    lat: -37.81, lng: 144.96, drug: 'mdma', quantity_kg: 850, street_value_usd_millions: 95,
    agency: 'AFP + ABF', origin_country: 'NL', destination_country: 'AU',
    attributed_org: 'Mocro Maffia + AU criminal networks',
    notes: 'Dutch synthetic-drug producers shipping in volume to AU. Dutch MDMA capacity estimated 1000+ kg/week production.' },

  // ── Operations / takedowns ──
  { name: 'Op EncroChat takedown', date: '2020-07', city: 'multi (HQ Paris)', country: 'FR', region: 'Europe',
    lat: 48.86, lng: 2.35, drug: 'mixed', quantity_kg: 0, street_value_usd_millions: 0,
    agency: 'Gendarmerie + Europol + NCA', origin_country: null, destination_country: null,
    attributed_org: 'pan-European drug networks',
    notes: 'French gendarmes cracked encrypted phone network used by 60K traffickers globally. Yielded 6500+ arrests, 900M EUR cash seized, hundreds of tonnes of drugs over 4 years.' },
  { name: 'Sky ECC takedown', date: '2021-03', city: 'Brussels', country: 'BE', region: 'Europe',
    lat: 50.85, lng: 4.35, drug: 'mixed', quantity_kg: 28000, street_value_usd_millions: 1100,
    agency: 'Belgian Federal Police + Europol', origin_country: null, destination_country: null,
    attributed_org: 'Belgian + Dutch crime networks',
    notes: '170K users on Sky ECC encrypted phones — 70% drug traffickers. Belgian + Dutch organised crime crippled; ongoing investigations through 2026.' },
  { name: 'Op Trojan Shield (US/AU)', date: '2021-06', city: 'multi', country: 'US', region: 'North America',
    lat: 39.83, lng: -98.58, drug: 'mixed', quantity_kg: 8000, street_value_usd_millions: 48,
    agency: 'FBI + AFP', origin_country: null, destination_country: null,
    attributed_org: 'global OC via ANØM honeypot',
    notes: '12K users on FBI-controlled ANØM phones thought it was encrypted; everything routed to a Quantico server. 800+ arrests across 16 countries.' },

  // ── Italian organised crime ──
  { name: 'Op Eureka (\'Ndrangheta)', date: '2023-05', city: 'Reggio Calabria', country: 'IT', region: 'Europe',
    lat: 38.11, lng: 15.65, drug: 'cocaine', quantity_kg: 23000, street_value_usd_millions: 1400,
    agency: 'Italian DIA + Europol + DEA', origin_country: 'CO', destination_country: 'EU',
    attributed_org: '\'Ndrangheta (Calabrian mafia)',
    notes: '108 arrests across 6 countries. \'Ndrangheta is now Europe\'s dominant cocaine importer — estimated turnover 50B EUR/yr.' },

  // ── Türkiye corridor ──
  { name: 'İstanbul Galleria heroin', date: '2024-05', city: 'Istanbul', country: 'TR', region: 'Middle East',
    lat: 41.01, lng: 28.97, drug: 'heroin', quantity_kg: 1450, street_value_usd_millions: 90,
    agency: 'Turkish Narcotics Police', origin_country: 'IR', destination_country: 'EU',
    attributed_org: 'Iranian-Turkish smuggling network',
    notes: 'Türkiye routinely seizes 15-20t heroin annually. Balkan Route (IR → TR → BG → EU) still dominant for European heroin.' },
  { name: 'Mersin port methamphetamine', date: '2023-12', city: 'Mersin', country: 'TR', region: 'Middle East',
    lat: 36.81, lng: 34.63, drug: 'methamphetamine', quantity_kg: 1100, street_value_usd_millions: 60,
    agency: 'Turkish Narcotics + customs', origin_country: 'IR', destination_country: 'EU',
    attributed_org: 'Iranian network',
    notes: 'Iranian-origin methamphetamine routed through Türkiye. New EU-bound flow vector since 2022.' },

  // ── Africa transit ──
  { name: 'Mombasa cocaine bust', date: '2024-01', city: 'Mombasa', country: 'KE', region: 'Africa',
    lat: -4.05, lng: 39.67, drug: 'cocaine', quantity_kg: 2100, street_value_usd_millions: 75,
    agency: 'Kenyan Anti-Narcotics Unit + UNODC', origin_country: 'BR', destination_country: 'EU',
    attributed_org: 'Brazilian + East African networks',
    notes: 'East African cocaine corridor (Brazil → Kenya/Mozambique → EU) growing rapidly since 2020.' },
  { name: 'Mozambique Channel heroin', date: '2024-03', city: 'Pemba', country: 'MZ', region: 'Africa',
    lat: -12.97, lng: 40.51, drug: 'heroin', quantity_kg: 1600, street_value_usd_millions: 100,
    agency: 'Mozambique Naval + UK ROYAL NAVY', origin_country: 'AF', destination_country: 'ZA',
    attributed_org: 'Indian Ocean dhow network',
    notes: 'East African coast heroin corridor — Afghan-origin opiates moved by dhow from Makran to Mozambique then south to SA + onward.' },

  // ── Catalysts / large recent ──
  { name: 'Op Familia (Sinaloa)', date: '2024-12', city: 'Sinaloa multi', country: 'MX', region: 'North America',
    lat: 25.00, lng: -107.50, drug: 'fentanyl', quantity_kg: 1400, street_value_usd_millions: 250,
    agency: 'Mexican Army (post-Chapitos detention)', origin_country: 'CN', destination_country: 'US',
    attributed_org: 'Sinaloa Cartel internal war',
    notes: 'After Ovidio Guzmán + El Mayo arrests 2024, Mexican military exploited cartel infighting to raid labs at industrial scale.' },
  { name: 'Norfolk container hub', date: '2024-10', city: 'Norfolk, VA', country: 'US', region: 'North America',
    lat: 36.85, lng: -76.29, drug: 'cocaine', quantity_kg: 5800, street_value_usd_millions: 290,
    agency: 'CBP + USCG', origin_country: 'CO', destination_country: 'US',
    attributed_org: 'Colombian + US East Coast distributors',
    notes: 'Atlantic-route cocaine bust. East Coast US container ports now seeing larger seizures as DEA shifts focus from purely southern border.' },
];

export async function GET() {
  const byDrug: Record<string, { count: number; total_kg: number }> = {};
  let totalKg = 0;
  let totalValue = 0;
  for (const s of SEIZURES) {
    if (!byDrug[s.drug]) byDrug[s.drug] = { count: 0, total_kg: 0 };
    byDrug[s.drug].count++;
    byDrug[s.drug].total_kg += s.quantity_kg;
    totalKg += s.quantity_kg;
    totalValue += s.street_value_usd_millions || 0;
  }
  // Bubble size: sqrt-scaled by kg with floor for small seizures so they're still visible
  const maxKg = SEIZURES.reduce((m, s) => Math.max(m, s.quantity_kg), 0) || 1;
  const seizures = SEIZURES.map(s => ({
    ...s,
    intensity: Math.min(1, Math.sqrt(Math.max(s.quantity_kg, 100) / maxKg)),
  }));
  return NextResponse.json({
    seizures, total: SEIZURES.length, total_kg: totalKg,
    total_value_usd_millions: totalValue, by_drug: byDrug,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' }});
}
