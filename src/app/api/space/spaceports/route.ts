import { NextResponse } from 'next/server';

/**
 * OSIRIS — Spaceports
 *
 * Curated dataset of operational and notable dormant/planned orbital launch
 * sites worldwide. Cadence figures are 2024 calendar-year orbital attempts
 * (TLEs + government press releases); inclination + lift class summarised
 * from rocket manuals.
 *
 *   bloc       coarse operator alignment for marker colour
 *   class      heavy | medium | small | suborbital — primary rocket class supported
 *   cadence    orbital launches in last 12 months
 *   status     active | dormant | construction | planned | leased
 *   rockets    short comma-joined list of rocket families currently flying from here
 */

type SpaceportClass = 'heavy' | 'medium' | 'small' | 'suborbital';
type SpaceportStatus = 'active' | 'dormant' | 'construction' | 'planned' | 'leased';
type Bloc = 'US' | 'China' | 'Russia' | 'ESA' | 'Japan' | 'India' | 'Israel' | 'Iran' | 'NK' | 'UK' | 'Other';

interface Spaceport {
  name: string;
  city: string;
  country: string;
  bloc: Bloc;
  region: string;
  lat: number;
  lng: number;
  class: SpaceportClass;
  status: SpaceportStatus;
  first_launch: number;     // year of first orbital attempt
  cadence_2024: number;     // 2024 orbital launches
  rockets: string;
  operator: string;
  notes: string;
}

const SPACEPORTS: Spaceport[] = [
  // ── United States ──
  { name: 'Cape Canaveral / KSC', city: 'Cape Canaveral, FL', country: 'US', bloc: 'US', region: 'North America',
    lat: 28.524, lng: -80.643, class: 'heavy', status: 'active', first_launch: 1958,
    cadence_2024: 93, rockets: 'Falcon 9, Falcon Heavy, Vulcan, Atlas V, New Glenn',
    operator: 'USSF + NASA + commercial', notes: 'Busiest spaceport on Earth — ~half of all global orbital launches in 2024 originated here.' },
  { name: 'Vandenberg Space Force Base', city: 'Lompoc, CA', country: 'US', bloc: 'US', region: 'North America',
    lat: 34.742, lng: -120.572, class: 'heavy', status: 'active', first_launch: 1959,
    cadence_2024: 51, rockets: 'Falcon 9, Vulcan, Minotaur, Firefly Alpha',
    operator: 'USSF', notes: 'Polar + sun-synchronous orbits; SpaceX Starlink + USSF + NRO payloads.' },
  { name: 'Starbase (Boca Chica)', city: 'Boca Chica, TX', country: 'US', bloc: 'US', region: 'North America',
    lat: 25.997, lng: -97.156, class: 'heavy', status: 'active', first_launch: 2023,
    cadence_2024: 4, rockets: 'Starship / Super Heavy',
    operator: 'SpaceX', notes: 'World\'s only operational fully-reusable super-heavy launch site. Daily test cadence ramping.' },
  { name: 'Wallops Flight Facility', city: 'Wallops Island, VA', country: 'US', bloc: 'US', region: 'North America',
    lat: 37.940, lng: -75.466, class: 'medium', status: 'active', first_launch: 1961,
    cadence_2024: 4, rockets: 'Antares, Rocket Lab Electron (LC-2), Minotaur',
    operator: 'NASA + commercial', notes: 'Mid-Atlantic\'s only orbital site; ISS cargo via Antares.' },
  { name: 'Pacific Spaceport Complex', city: 'Kodiak, AK', country: 'US', bloc: 'US', region: 'North America',
    lat: 57.435, lng: -152.337, class: 'small', status: 'active', first_launch: 1998,
    cadence_2024: 2, rockets: 'ABL RS1, Astra Rocket, Minotaur',
    operator: 'Alaska Aerospace Corp', notes: 'High-latitude polar launches without flying over populated areas.' },
  { name: 'Spaceport America', city: 'Truth or Consequences, NM', country: 'US', bloc: 'US', region: 'North America',
    lat: 32.990, lng: -106.975, class: 'suborbital', status: 'active', first_launch: 2018,
    cadence_2024: 2, rockets: 'Virgin Galactic VSS Unity (suborbital)',
    operator: 'New Mexico Spaceport Authority', notes: 'World\'s first purpose-built commercial spaceport. Tourism flights for Virgin Galactic.' },

  // ── China ──
  { name: 'Wenchang Space Launch Site', city: 'Hainan', country: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 19.614, lng: 110.952, class: 'heavy', status: 'active', first_launch: 2016,
    cadence_2024: 12, rockets: 'Long March 5, LM-7, LM-8',
    operator: 'CASC', notes: 'Coastal site for heavy + crewed lunar — closest to equator gives best LEO efficiency for China.' },
  { name: 'Xichang Satellite Launch Center', city: 'Sichuan', country: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 28.245, lng: 102.027, class: 'heavy', status: 'active', first_launch: 1984,
    cadence_2024: 15, rockets: 'Long March 2C/3B, Long March 6/11',
    operator: 'CASC + PLA SSF', notes: 'GEO + lunar + BeiDou launches; spent stages routinely drop on inland villages.' },
  { name: 'Jiuquan Satellite Launch Center', city: 'Inner Mongolia', country: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 40.958, lng: 100.291, class: 'heavy', status: 'active', first_launch: 1970,
    cadence_2024: 18, rockets: 'Long March 2F (Shenzhou), LM-11, Kuaizhou, Zhuque',
    operator: 'CASC + PLA SSF + commercial', notes: 'Only Chinese site for crewed missions (Shenzhou). Also hosts commercial Landspace, iSpace, Galactic Energy.' },
  { name: 'Taiyuan Satellite Launch Center', city: 'Shanxi', country: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 38.849, lng: 111.608, class: 'medium', status: 'active', first_launch: 1968,
    cadence_2024: 16, rockets: 'Long March 2D/4B/4C/6A',
    operator: 'CASC', notes: 'Primary Chinese SSO + polar site. Most LEO Earth-observation launches.' },
  { name: 'Haiyang Sea Launch Platform', city: 'Yellow Sea', country: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 36.770, lng: 121.166, class: 'medium', status: 'active', first_launch: 2019,
    cadence_2024: 6, rockets: 'Long March 11 (solid), Smart Dragon',
    operator: 'CAS-RoCKET + Shandong Ocean Engineering', notes: 'World\'s first operational ship-based orbital launch service. Avoids overland fallout debris.' },

  // ── Russia ──
  { name: 'Baikonur Cosmodrome', city: 'Baikonur', country: 'KZ', bloc: 'Russia', region: 'Russia & Caspian',
    lat: 45.965, lng: 63.305, class: 'heavy', status: 'leased', first_launch: 1957,
    cadence_2024: 7, rockets: 'Soyuz-2, Proton-M',
    operator: 'Roscosmos (leased from Kazakhstan)', notes: 'Sputnik launched from here in 1957. Lease through 2050 at $115M/yr; Russia migrating to Vostochny.' },
  { name: 'Vostochny Cosmodrome', city: 'Tsiolkovsky', country: 'RU', bloc: 'Russia', region: 'Russia & Caspian',
    lat: 51.884, lng: 128.333, class: 'heavy', status: 'active', first_launch: 2016,
    cadence_2024: 5, rockets: 'Soyuz-2, Angara-A5 (planned)',
    operator: 'Roscosmos', notes: 'Built to replace Baikonur on Russian soil. Major construction graft scandals; Angara cadence way below plan.' },
  { name: 'Plesetsk Cosmodrome', city: 'Mirny', country: 'RU', bloc: 'Russia', region: 'Russia & Caspian',
    lat: 62.957, lng: 40.578, class: 'heavy', status: 'active', first_launch: 1966,
    cadence_2024: 5, rockets: 'Soyuz-2, Angara-A5',
    operator: 'Russian Aerospace Forces', notes: 'Northernmost orbital launch site. Military-only since ~2010; Glonass + Tundra-orbit warning satellites.' },

  // ── ESA / Europe ──
  { name: 'Centre Spatial Guyanais', city: 'Kourou', country: 'GF', bloc: 'ESA', region: 'South America',
    lat: 5.236, lng: -52.768, class: 'heavy', status: 'active', first_launch: 1970,
    cadence_2024: 6, rockets: 'Ariane 6, Vega C',
    operator: 'CNES + Arianespace', notes: 'Best-located heavy-lift site on Earth (5°N gives ~17% mass boost to GEO). Ariane 6 maiden flight Jul 2024.' },
  { name: 'SaxaVord Spaceport', city: 'Unst, Shetland', country: 'GB', bloc: 'UK', region: 'Europe',
    lat: 60.825, lng: -0.829, class: 'small', status: 'construction', first_launch: 0,
    cadence_2024: 0, rockets: 'RFA One (anomaly Aug 2024), Skyrora XL',
    operator: 'SaxaVord Spaceport Ltd', notes: 'First vertical-launch site in mainland Europe; RFA One static fire failed August 2024, reset of programme.' },
  { name: 'Andøya Space', city: 'Andøya, Nordland', country: 'NO', bloc: 'Other', region: 'Europe',
    lat: 69.295, lng: 16.020, class: 'small', status: 'active', first_launch: 1962,
    cadence_2024: 1, rockets: 'Isar Spectrum (from 2025), sounding rockets',
    operator: 'Andøya Space Center', notes: 'Long-running sounding-rocket site; first orbital attempt Mar 2025 (Isar Aerospace Spectrum, failure 30s in).' },
  { name: 'Esrange Space Center', city: 'Kiruna', country: 'SE', bloc: 'Other', region: 'Europe',
    lat: 67.892, lng: 21.106, class: 'suborbital', status: 'active', first_launch: 1966,
    cadence_2024: 0, rockets: 'Themis (planned), MAPHEUS, REXUS',
    operator: 'Swedish Space Corp', notes: 'Largest civilian sounding-rocket base in Europe; preparing for first orbital attempts mid-decade.' },

  // ── Japan ──
  { name: 'Tanegashima Space Center', city: 'Tanegashima', country: 'JP', bloc: 'Japan', region: 'Asia-Pacific',
    lat: 30.376, lng: 130.961, class: 'heavy', status: 'active', first_launch: 1975,
    cadence_2024: 3, rockets: 'H3, H-IIA (retiring 2025)',
    operator: 'JAXA + Mitsubishi Heavy', notes: 'H3 returned to flight Feb 2024 after the maiden-flight failure; H-IIA retiring with last Information Gathering Satellite.' },
  { name: 'Uchinoura Space Center', city: 'Kimotsuki', country: 'JP', bloc: 'Japan', region: 'Asia-Pacific',
    lat: 31.252, lng: 131.082, class: 'small', status: 'active', first_launch: 1970,
    cadence_2024: 1, rockets: 'Epsilon S, sounding rockets',
    operator: 'JAXA', notes: 'Japan\'s historic solid-fuel rocket site; Epsilon-S launch pad failure Nov 2024.' },
  { name: 'Kii Spaceport', city: 'Kushimoto, Wakayama', country: 'JP', bloc: 'Japan', region: 'Asia-Pacific',
    lat: 33.473, lng: 135.781, class: 'small', status: 'active', first_launch: 2024,
    cadence_2024: 1, rockets: 'KAIROS (Space One)',
    operator: 'Space One', notes: 'Japan\'s first private orbital spaceport. KAIROS Flight 1 failed Mar 2024, Flight 2 failed Dec 2024.' },

  // ── India ──
  { name: 'Satish Dhawan Space Centre', city: 'Sriharikota', country: 'IN', bloc: 'India', region: 'Asia-Pacific',
    lat: 13.733, lng: 80.235, class: 'heavy', status: 'active', first_launch: 1979,
    cadence_2024: 5, rockets: 'PSLV, GSLV, LVM3, SSLV',
    operator: 'ISRO', notes: 'India\'s sole orbital site. Chandrayaan-3 lunar lander launched here. Gaganyaan crewed flights targeting 2025-2026.' },
  { name: 'Kulasekarapattinam', city: 'Tamil Nadu', country: 'IN', bloc: 'India', region: 'Asia-Pacific',
    lat: 8.387, lng: 78.119, class: 'small', status: 'construction', first_launch: 0,
    cadence_2024: 0, rockets: 'SSLV (small-sat)',
    operator: 'ISRO', notes: 'New southern site for SSLV — equator-proximate, smaller-payload focus. Phase 1 inauguration Feb 2024.' },

  // ── New Zealand / Pacific ──
  { name: 'Rocket Lab LC-1 (Mahia)', city: 'Mahia Peninsula', country: 'NZ', bloc: 'Other', region: 'Asia-Pacific',
    lat: -39.262, lng: 177.865, class: 'small', status: 'active', first_launch: 2017,
    cadence_2024: 13, rockets: 'Electron, Neutron (planned)',
    operator: 'Rocket Lab', notes: 'World\'s first private orbital launch facility. ~70% of Electron launches happen here.' },
  { name: 'Arnhem Space Centre', city: 'Nhulunbuy, NT', country: 'AU', bloc: 'Other', region: 'Asia-Pacific',
    lat: -12.378, lng: 136.832, class: 'small', status: 'construction', first_launch: 0,
    cadence_2024: 0, rockets: 'NASA Black Brant (suborbital so far)',
    operator: 'Equatorial Launch Australia', notes: 'First Australian commercial spaceport. NASA used it for Black Brant suborbital science 2022; orbital pads in build-out.' },

  // ── South Korea ──
  { name: 'Naro Space Center', city: 'Goheung', country: 'KR', bloc: 'Other', region: 'Asia-Pacific',
    lat: 34.431, lng: 127.535, class: 'medium', status: 'active', first_launch: 2009,
    cadence_2024: 0, rockets: 'KSLV-II Nuri',
    operator: 'KARI', notes: 'Korea\'s only orbital site. Nuri 3rd success May 2023; next launch slated 2025.' },

  // ── Brazil ──
  { name: 'Alcântara Launch Center', city: 'Alcântara, MA', country: 'BR', bloc: 'Other', region: 'South America',
    lat: -2.317, lng: -44.396, class: 'small', status: 'active', first_launch: 1990,
    cadence_2024: 1, rockets: 'VLM-1 (in development), partnerships pending',
    operator: 'Brazilian Air Force + AEB', notes: 'Equator-proximate (2°S) — strongest LEO mass boost of any active site. US Technology Safeguards agreement enables Western launches.' },

  // ── Iran ──
  { name: 'Imam Khomeini Spaceport', city: 'Semnan', country: 'IR', bloc: 'Iran', region: 'Middle East',
    lat: 35.235, lng: 53.951, class: 'small', status: 'active', first_launch: 2009,
    cadence_2024: 3, rockets: 'Simorgh, Qased',
    operator: 'Iranian Space Agency + IRGC', notes: 'Civilian face of Iranian space; Simorgh has poor track record. Triple launch Jan 2024.' },
  { name: 'Shahroud Missile Test Site', city: 'Shahroud', country: 'IR', bloc: 'Iran', region: 'Middle East',
    lat: 36.201, lng: 55.339, class: 'small', status: 'active', first_launch: 2020,
    cadence_2024: 1, rockets: 'Qased, Ghaem-100',
    operator: 'IRGC Space Command', notes: 'IRGC-controlled — dual-use ballistic missile testing + small satellite launch.' },

  // ── North Korea ──
  { name: 'Sohae Satellite Launching Station', city: 'Tongchang-ri', country: 'KP', bloc: 'NK', region: 'Asia-Pacific',
    lat: 39.660, lng: 124.705, class: 'medium', status: 'active', first_launch: 2012,
    cadence_2024: 1, rockets: 'Chollima-1, Unha',
    operator: 'NADA / KCNA-named', notes: 'Malligyong-1 reconnaissance satellite reached orbit Nov 2023. Subsequent attempts 2024 failed.' },

  // ── Israel ──
  { name: 'Palmachim Air Base', city: 'Rishon LeZion', country: 'IL', bloc: 'Israel', region: 'Middle East',
    lat: 31.898, lng: 34.690, class: 'small', status: 'active', first_launch: 1988,
    cadence_2024: 0, rockets: 'Shavit',
    operator: 'IAI + Israeli Space Agency', notes: 'Only westward orbital launch site on Earth (over the Mediterranean to avoid overflying Arab states).' },
];

export async function GET() {
  const maxCadence = SPACEPORTS.reduce((m, s) => Math.max(m, s.cadence_2024), 0) || 1;
  const ports = SPACEPORTS.map(s => ({
    ...s,
    // sqrt scale so small but iconic sites stay visible
    intensity: Math.min(1, Math.sqrt(Math.max(s.cadence_2024, 0.5) / maxCadence)),
  }));
  const byBloc: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  let totalLaunches = 0;
  for (const s of SPACEPORTS) {
    byBloc[s.bloc] = (byBloc[s.bloc] || 0) + 1;
    byClass[s.class] = (byClass[s.class] || 0) + 1;
    totalLaunches += s.cadence_2024;
  }
  return NextResponse.json({
    spaceports: ports,
    total: SPACEPORTS.length,
    total_launches_2024: totalLaunches,
    by_bloc: byBloc,
    by_class: byClass,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
