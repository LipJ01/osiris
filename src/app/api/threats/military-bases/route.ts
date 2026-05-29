import { NextResponse } from 'next/server';

/**
 * OSIRIS — Major Military Bases
 *
 * Curated dataset of strategically significant overseas + flagship domestic
 * bases for the principal military powers. Weighted toward forward-deployed
 * footprint (where projection actually happens), not every garrison.
 *
 * Sources: SIPRI overseas-bases tracker, DoD Base Structure Reports, IISS
 * Military Balance, RUSI / NIDS / RIAC analyses, public statements 2023-2024.
 *
 *   operator   nation that operates the base (may differ from host country)
 *   bloc       coarse alignment for marker colour
 *   type       army | navy | air | marine | joint | space | sigint | special-forces
 *   personnel  approx headcount (rough; many are classified)
 *   status     active | reduced | contested | recent-departure | new
 */

type BaseType = 'army' | 'navy' | 'air' | 'marine' | 'joint' | 'space' | 'sigint' | 'special-forces';
type BaseStatus = 'active' | 'reduced' | 'contested' | 'recent-departure' | 'new';
type Bloc = 'US' | 'NATO' | 'UK' | 'France' | 'Russia' | 'China' | 'India' | 'Iran' | 'Israel' | 'Other';

interface Base {
  name: string;
  city: string;
  host: string;            // ISO of host country
  operator: string;        // ISO of operating country (often differs)
  bloc: Bloc;
  region: string;
  lat: number;
  lng: number;
  type: BaseType;
  personnel: number;       // approx
  status: BaseStatus;
  function: string;        // what it actually does
  notes: string;
}

const BASES: Base[] = [
  // ══════════════════════════════════════════════════════
  // US — forward-deployed posture (~25 of ~750 overseas)
  // ══════════════════════════════════════════════════════

  // Europe
  { name: 'Ramstein AB',           city: 'Ramstein',         host: 'DE', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 49.437, lng: 7.600,  type: 'air',    personnel: 16000, status: 'active',
    function: 'HQ US Air Forces in Europe + Africom airlift hub',
    notes: 'Coordinates almost all US military aviation activity over Europe, Africa, and CENTCOM rear.' },
  { name: 'Aviano AB',             city: 'Aviano',           host: 'IT', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 46.032, lng: 12.596, type: 'air',    personnel: 4500,  status: 'active',
    function: 'F-16 wing covering southern Europe + Med',
    notes: '31st Fighter Wing — only US fighter squadron south of the Alps.' },
  { name: 'NSA Naples',            city: 'Naples',           host: 'IT', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 40.880, lng: 14.213, type: 'navy',   personnel: 9000,  status: 'active',
    function: 'HQ US 6th Fleet, Allied Joint Force Command Naples',
    notes: 'Commands all US naval operations in Mediterranean + parts of Africa/Black Sea.' },
  { name: 'NSA Souda Bay',         city: 'Crete',            host: 'GR', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 35.546, lng: 24.149, type: 'navy',   personnel: 1500,  status: 'active',
    function: 'Forward base for 6th Fleet ops in eastern Med',
    notes: 'Best deep-water harbour in the eastern Med; major refuelling + intel stop.' },
  { name: 'Incirlik AB',           city: 'Adana',            host: 'TR', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 37.002, lng: 35.426, type: 'air',    personnel: 2500,  status: 'reduced',
    function: 'Forward air ops + nuclear weapons storage',
    notes: 'Stores ~50 B61 nukes. Strained access since 2016 coup attempt; future increasingly uncertain.' },
  { name: 'RAF Lakenheath',        city: 'Suffolk',          host: 'GB', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 52.409, lng: 0.561,  type: 'air',    personnel: 8500,  status: 'active',
    function: 'Largest US fighter wing in Europe; F-35A + F-15E',
    notes: 'Nuclear-capable F-35As deployed 2024 — first US nukes back in UK since 2008.' },
  { name: 'RAF Mildenhall',        city: 'Suffolk',          host: 'GB', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 52.362, lng: 0.486,  type: 'air',    personnel: 3000,  status: 'active',
    function: 'Tanker + special-ops aviation hub',
    notes: '100th ARW — only USAF refuelling wing in Europe.' },
  { name: 'RAF Menwith Hill',      city: 'North Yorkshire',  host: 'GB', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 54.011, lng: -1.689, type: 'sigint', personnel: 2000,  status: 'active',
    function: 'Largest NSA SIGINT station outside US',
    notes: 'Echelon-era satellite intercept site; key node for transatlantic comms collection.' },
  { name: 'NSF Deveselu',          city: 'Deveselu',         host: 'RO', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 44.116, lng: 24.466, type: 'air',    personnel: 250,   status: 'active',
    function: 'Aegis Ashore ballistic missile defence site',
    notes: 'SM-3 interceptors; Russia cites this as casus belli for missile counter-deployments.' },
  { name: 'Camp Bondsteel',        city: 'Ferizaj',          host: 'XK', operator: 'US', bloc: 'US', region: 'Europe',
    lat: 42.359, lng: 21.207, type: 'army',   personnel: 700,   status: 'active',
    function: 'KFOR contribution + Balkans contingency',
    notes: 'Largest US base built since Vietnam. Persistent NATO presence since 1999.' },

  // Indo-Pacific
  { name: 'Yokosuka NB',           city: 'Yokosuka',         host: 'JP', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 35.290, lng: 139.665, type: 'navy',  personnel: 25000, status: 'active',
    function: 'HQ US 7th Fleet — only US carrier permanently homeported overseas',
    notes: 'USS George Washington carrier strike group; central node of Pacific posture.' },
  { name: 'Sasebo NB',             city: 'Sasebo',           host: 'JP', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 33.165, lng: 129.711, type: 'navy',  personnel: 7000,  status: 'active',
    function: 'Amphibious ready group — wasp-class LHD homeport',
    notes: 'Closest US naval base to Korean peninsula + Taiwan Strait.' },
  { name: 'MCAS Iwakuni',          city: 'Iwakuni',          host: 'JP', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 34.144, lng: 132.236, type: 'marine', personnel: 9000, status: 'active',
    function: 'Largest US Marine air station in Asia; F-35B + carrier air wing',
    notes: 'Forward base for Marine Aircraft Group 12; F/A-18 + F-35 rotations.' },
  { name: 'Kadena AB',             city: 'Okinawa',          host: 'JP', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 26.355, lng: 127.768, type: 'air',   personnel: 18000, status: 'active',
    function: 'Largest USAF combat air wing in PACOM',
    notes: '18th Wing; major sustainment for China contingency. F-15s being phased out for F-22/F-35 rotations.' },
  { name: 'Camp Humphreys',        city: 'Pyeongtaek',       host: 'KR', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 36.965, lng: 127.034, type: 'army',  personnel: 30000, status: 'active',
    function: 'HQ US Forces Korea + 8th Army',
    notes: 'Largest US overseas base by area + population. Consolidation of legacy ROK posts completed 2018.' },
  { name: 'Osan AB',               city: 'Pyeongtaek',       host: 'KR', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 37.090, lng: 127.029, type: 'air',   personnel: 8000,  status: 'active',
    function: 'HQ 7th Air Force; tactical air for Korean peninsula',
    notes: 'Closest USAF base to DMZ (~50 km).' },
  { name: 'Andersen AFB',          city: 'Guam',             host: 'GU', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 13.583, lng: 144.929, type: 'air',   personnel: 4500,  status: 'active',
    function: 'Bomber + ISR forward staging for Indo-Pacific',
    notes: 'B-1/B-2/B-52 rotations; first US territory hit in any Chinese opening salvo.' },
  { name: 'NB Guam',               city: 'Apra Harbor',      host: 'GU', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 13.444, lng: 144.652, type: 'navy',  personnel: 6300,  status: 'active',
    function: 'Submarine + surface ship forward homeport',
    notes: 'Homeport for 4 SSNs; positioned to be hit on day-one of any China conflict, hence hardening underway.' },
  { name: 'Diego Garcia',          city: 'Chagos Archipelago', host: 'IO', operator: 'US/GB', bloc: 'US', region: 'Asia-Pacific',
    lat: -7.313, lng: 72.412, type: 'joint',  personnel: 1700,  status: 'active',
    function: 'Indian Ocean strategic projection — bombers, subs, support',
    notes: 'B-2 forward operating site, only US base in Indian Ocean. UK transfer of Chagos to Mauritius agreed 2024 with 99-yr base lease retained.' },
  { name: 'Joint Base Pearl Harbor-Hickam', city: 'Honolulu', host: 'US', operator: 'US', bloc: 'US', region: 'Asia-Pacific',
    lat: 21.348, lng: -157.972, type: 'joint', personnel: 35000, status: 'active',
    function: 'HQ INDOPACOM + Pacific Fleet',
    notes: 'The geographic + command centre of the entire Indo-Pacific posture.' },

  // CENTCOM
  { name: 'Al Udeid AB',           city: 'Doha',             host: 'QA', operator: 'US', bloc: 'US', region: 'Middle East',
    lat: 25.117, lng: 51.315, type: 'air',    personnel: 11000, status: 'active',
    function: 'Forward HQ US Central Command + 379th AEW',
    notes: 'Combined air ops centre for CENTCOM + AFRICOM. Largest US base in Middle East.' },
  { name: 'NSA Bahrain',           city: 'Manama',           host: 'BH', operator: 'US', bloc: 'US', region: 'Middle East',
    lat: 26.205, lng: 50.611, type: 'navy',   personnel: 9000,  status: 'active',
    function: 'HQ US 5th Fleet + Combined Maritime Forces',
    notes: 'Persian Gulf maritime ops; coordinates Hormuz transits.' },
  { name: 'Al Dhafra AB',          city: 'Abu Dhabi',        host: 'AE', operator: 'US', bloc: 'US', region: 'Middle East',
    lat: 24.249, lng: 54.547, type: 'air',    personnel: 3500,  status: 'active',
    function: 'F-22/F-35 + KC-135 + Global Hawk hub',
    notes: 'Premier ISR + air refuelling node for Gulf + East Africa ops.' },
  { name: 'Ali Al Salem AB',       city: 'Al Jahra',         host: 'KW', operator: 'US', bloc: 'US', region: 'Middle East',
    lat: 29.347, lng: 47.521, type: 'air',    personnel: 2000,  status: 'active',
    function: 'A-10 + F-16 ops, transit hub for OIR rear',
    notes: 'Maintained continuously since Desert Storm.' },
  { name: 'Al Asad AB',            city: 'Anbar',            host: 'IQ', operator: 'US', bloc: 'US', region: 'Middle East',
    lat: 33.785, lng: 42.441, type: 'air',    personnel: 2500,  status: 'reduced',
    function: 'OIR residual presence, advise-and-assist',
    notes: 'Repeatedly struck by Iranian-aligned militias 2020-2024; drawdown agreed Sept 2024.' },
  { name: 'Al-Tanf Garrison',      city: 'Homs Governorate', host: 'SY', operator: 'US', bloc: 'US', region: 'Middle East',
    lat: 33.500, lng: 38.683, type: 'special-forces', personnel: 200, status: 'active',
    function: 'Train Maghaweir al-Thawra; block Iran ground line of comms',
    notes: 'Sits astride the Baghdad-Damascus highway — the "Iran land bridge" interdiction point.' },

  // Africa
  { name: 'Camp Lemonnier',        city: 'Djibouti City',    host: 'DJ', operator: 'US', bloc: 'US', region: 'Africa',
    lat: 11.547, lng: 43.158, type: 'joint',  personnel: 4000,  status: 'active',
    function: 'Only US base in Africa — counter-terror + Horn of Africa ops',
    notes: 'CJTF-HOA HQ. Drones for Yemen/Somalia ops. Co-located with major Chinese base.' },

  // Americas
  { name: 'NS Guantanamo Bay',     city: 'Guantánamo',       host: 'CU', operator: 'US', bloc: 'US', region: 'North America',
    lat: 19.910, lng: -75.155, type: 'navy',  personnel: 6000,  status: 'reduced',
    function: 'Caribbean naval presence + detention facility (residual)',
    notes: 'Oldest overseas US base (1903). Cuba does not cash the lease cheques.' },
  { name: 'Pituffik Space Base',   city: 'Thule',            host: 'GL', operator: 'US', bloc: 'US', region: 'Arctic',
    lat: 76.531, lng: -68.703, type: 'space', personnel: 600,   status: 'active',
    function: 'Ballistic missile early warning radar + space surveillance',
    notes: 'Northernmost US base. Critical for over-the-pole ICBM detection. Renamed from Thule in 2023.' },

  // ══════════════════════════════════════════════════════
  // Russia — shrinking but still global
  // ══════════════════════════════════════════════════════
  { name: 'Khmeimim AB',           city: 'Latakia',          host: 'SY', operator: 'RU', bloc: 'Russia', region: 'Middle East',
    lat: 35.401, lng: 35.948, type: 'air',    personnel: 4000,  status: 'reduced',
    function: 'Russia\'s only Mediterranean air base; Syria + Africa logistics',
    notes: 'Future uncertain after Assad fall Dec 2024; Russian drawdown underway in 2025.' },
  { name: 'Tartus Naval Facility', city: 'Tartus',           host: 'SY', operator: 'RU', bloc: 'Russia', region: 'Middle East',
    lat: 34.886, lng: 35.875, type: 'navy',   personnel: 1700,  status: 'reduced',
    function: 'Only Russian Med naval base; sub support',
    notes: 'Same Assad-fall context — Russia actively evacuating equipment 2025.' },
  { name: 'Sevastopol Naval Base', city: 'Sevastopol',       host: 'UA', operator: 'RU', bloc: 'Russia', region: 'Europe',
    lat: 44.617, lng: 33.530, type: 'navy',   personnel: 25000, status: 'contested',
    function: 'HQ Russian Black Sea Fleet (occupied since 2014)',
    notes: 'Repeatedly struck by Ukrainian USVs + missiles since 2022; flagship Moskva sunk Apr 2022.' },
  { name: '102nd Military Base',   city: 'Gyumri',           host: 'AM', operator: 'RU', bloc: 'Russia', region: 'Russia & Caspian',
    lat: 40.789, lng: 43.851, type: 'army',   personnel: 5000,  status: 'reduced',
    function: 'Russian motor-rifle brigade; CSTO commitment',
    notes: 'Armenia froze CSTO participation 2024 → future increasingly uncertain.' },
  { name: '201st Military Base',   city: 'Dushanbe',         host: 'TJ', operator: 'RU', bloc: 'Russia', region: 'Russia & Caspian',
    lat: 38.557, lng: 68.766, type: 'army',   personnel: 7500,  status: 'active',
    function: 'Largest Russian base abroad — Afghan border buffer',
    notes: 'Lease extended through 2042.' },
  { name: 'Kant AB',               city: 'Kant',             host: 'KG', operator: 'RU', bloc: 'Russia', region: 'Russia & Caspian',
    lat: 42.853, lng: 74.846, type: 'air',    personnel: 500,   status: 'active',
    function: 'CSTO collective-security air component',
    notes: '999th Air Base. Sole Russian forward air base in Central Asia.' },
  { name: 'PSC Africa Corps hubs', city: 'Bangui',           host: 'CF', operator: 'RU', bloc: 'Russia', region: 'Africa',
    lat: 4.401, lng: 18.560, type: 'special-forces', personnel: 1500, status: 'active',
    function: 'Successor footprint to Wagner — CAR + Mali + Burkina + Niger',
    notes: 'Russian MoD took over Wagner Africa networks after Prigozhin death Aug 2023.' },

  // ══════════════════════════════════════════════════════
  // China — expanding overseas posture
  // ══════════════════════════════════════════════════════
  { name: 'PLA Support Base Djibouti', city: 'Doraleh',       host: 'DJ', operator: 'CN', bloc: 'China', region: 'Africa',
    lat: 11.591, lng: 43.075, type: 'navy',   personnel: 2000,  status: 'active',
    function: 'First Chinese overseas base — anti-piracy + Indian Ocean reach',
    notes: '~10 km from Camp Lemonnier. Pier capable of berthing aircraft carriers since 2021 expansion.' },
  { name: 'Ream Naval Base',       city: 'Sihanoukville',    host: 'KH', operator: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 10.530, lng: 103.609, type: 'navy',  personnel: 500,   status: 'new',
    function: 'Alleged Chinese-only Cambodian naval facility',
    notes: 'Cambodia denies "Chinese base" framing; Chinese-funded pier opened 2025.' },
  { name: 'PLA Garrison Hong Kong',city: 'Hong Kong',        host: 'CN', operator: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 22.302, lng: 114.169, type: 'joint', personnel: 8000,  status: 'active',
    function: 'PLA presence in HKSAR since 1997',
    notes: 'Strength surged after 2019 protests; SAR no longer has "soft" garrison treatment.' },
  { name: 'Mischief Reef Garrison',city: 'Spratly Islands',  host: 'CN', operator: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 9.917, lng: 115.533, type: 'joint',  personnel: 1500,  status: 'contested',
    function: 'Reclaimed-island airfield + military outpost in disputed SCS',
    notes: 'Built on reef previously underwater. Philippines + Vietnam + Malaysia all dispute Chinese claim.' },
  { name: 'Fiery Cross Reef',      city: 'Spratly Islands',  host: 'CN', operator: 'CN', bloc: 'China', region: 'Asia-Pacific',
    lat: 9.547, lng: 112.892, type: 'air',    personnel: 2000,  status: 'contested',
    function: '3km runway + radar + missile-capable artificial island',
    notes: 'Largest of the "Big Three" Chinese reclamations.' },

  // ══════════════════════════════════════════════════════
  // United Kingdom — global lite
  // ══════════════════════════════════════════════════════
  { name: 'RAF Akrotiri',          city: 'Limassol',         host: 'CY', operator: 'GB', bloc: 'UK', region: 'Europe',
    lat: 34.591, lng: 32.989, type: 'air',    personnel: 2500,  status: 'active',
    function: 'Largest UK base overseas; Med + Levant ops',
    notes: 'Base of operations for UK strikes in Iraq/Syria/Yemen + Cyprus ELINT.' },
  { name: 'BFSAI Mount Pleasant',  city: 'East Falkland',    host: 'FK', operator: 'GB', bloc: 'UK', region: 'South America',
    lat: -51.823, lng: -58.448, type: 'joint',personnel: 1200,  status: 'active',
    function: 'UK garrison since 1982 — South Atlantic deterrent',
    notes: 'Typhoon FGR4 fighters + Type 23 frigate rotations. Closest UK military assets to Antarctica.' },
  { name: 'UK Naval Support Facility Bahrain', city: 'Mina Salman', host: 'BH', operator: 'GB', bloc: 'UK', region: 'Middle East',
    lat: 26.207, lng: 50.609, type: 'navy',   personnel: 500,   status: 'active',
    function: 'First permanent UK Gulf base since 1971 (opened 2018)',
    notes: 'Hosts UK MCMVs + Type 23 forward-deployed; supports Combined Task Force ops.' },
  { name: 'British Forces Brunei', city: 'Seria',            host: 'BN', operator: 'GB', bloc: 'UK', region: 'Asia-Pacific',
    lat: 4.609, lng: 114.323, type: 'army',   personnel: 1000,  status: 'active',
    function: 'Jungle warfare training + Gurkha battalion',
    notes: 'Sole permanent UK army presence in Indo-Pacific.' },
  { name: 'British Forces Gibraltar', city: 'Gibraltar',     host: 'GI', operator: 'GB', bloc: 'UK', region: 'Europe',
    lat: 36.140, lng: -5.353, type: 'joint',  personnel: 1100,  status: 'active',
    function: 'Strait of Gibraltar chokepoint + sub support',
    notes: 'Anchor of UK Mediterranean presence; nuclear-sub berthing facilities.' },

  // ══════════════════════════════════════════════════════
  // France — African retreat, Pacific persistence
  // ══════════════════════════════════════════════════════
  { name: 'Base Aérienne 188',     city: 'Djibouti City',    host: 'DJ', operator: 'FR', bloc: 'France', region: 'Africa',
    lat: 11.547, lng: 43.158, type: 'air',    personnel: 1500,  status: 'active',
    function: 'Largest French base overseas',
    notes: 'Mirage 2000s + ISR. Co-located airfield with Camp Lemonnier.' },
  { name: 'Camp De Gaulle',        city: "N'Djamena",        host: 'TD', operator: 'FR', bloc: 'France', region: 'Africa',
    lat: 12.130, lng: 15.034, type: 'army',   personnel: 1000,  status: 'recent-departure',
    function: 'Last French Sahel presence after Mali/Niger ejection',
    notes: 'Chad announced end of defence accords Dec 2024; French departure underway 2025.' },
  { name: 'Base Aérienne 367',     city: 'Cayenne',          host: 'GF', operator: 'FR', bloc: 'France', region: 'South America',
    lat: 4.823, lng: -52.367, type: 'air',    personnel: 1500,  status: 'active',
    function: 'Kourou spaceport defence + Amazon basin presence',
    notes: 'Protects Europe\'s primary launch site at Centre Spatial Guyanais.' },
  { name: 'FAPF Tahiti',           city: "Papeete",          host: 'PF', operator: 'FR', bloc: 'France', region: 'Asia-Pacific',
    lat: -17.554, lng: -149.612, type: 'joint', personnel: 1100, status: 'active',
    function: 'French Polynesia + EEZ surveillance — largest in Pacific',
    notes: 'Polices a Pacific EEZ second only to the US in size.' },

  // ══════════════════════════════════════════════════════
  // India
  // ══════════════════════════════════════════════════════
  { name: 'INS Kadamba (Karwar)',  city: 'Karwar',           host: 'IN', operator: 'IN', bloc: 'India', region: 'Asia-Pacific',
    lat: 14.821, lng: 74.087, type: 'navy',   personnel: 10000, status: 'active',
    function: 'India\'s largest naval base; Western Fleet aircraft carrier home',
    notes: 'Phase IIA expansion underway — will berth 50+ warships by 2026.' },
  { name: 'Andaman & Nicobar Cmd', city: 'Port Blair',       host: 'IN', operator: 'IN', bloc: 'India', region: 'Asia-Pacific',
    lat: 11.673, lng: 92.747, type: 'joint',  personnel: 8000,  status: 'active',
    function: 'India\'s only tri-service command — Malacca chokepoint watch',
    notes: 'Strategic to monitoring Chinese Indian Ocean naval entry.' },
  { name: 'IAF Farkhor',           city: 'Farkhor',          host: 'TJ', operator: 'IN', bloc: 'India', region: 'Russia & Caspian',
    lat: 37.504, lng: 69.398, type: 'air',    personnel: 150,   status: 'active',
    function: 'India\'s only overseas military base (with Tajikistan)',
    notes: 'Small footprint; gives India eyes on Afghanistan + Pakistan rear.' },
  { name: 'Agalega Base',          city: 'Agalega Island',   host: 'MU', operator: 'IN', bloc: 'India', region: 'Africa',
    lat: -10.398, lng: 56.611, type: 'joint', personnel: 200,   status: 'new',
    function: 'New Indian airstrip + jetty — Indian Ocean surveillance',
    notes: 'Inaugurated Feb 2024. Mauritius denies "Indian base" framing.' },

  // ══════════════════════════════════════════════════════
  // Iran — direct + proxy posture
  // ══════════════════════════════════════════════════════
  { name: 'Bandar Abbas Naval HQ', city: 'Bandar Abbas',     host: 'IR', operator: 'IR', bloc: 'Iran', region: 'Middle East',
    lat: 27.107, lng: 56.222, type: 'navy',   personnel: 12000, status: 'active',
    function: 'HQ Iranian Navy + IRGCN; Strait of Hormuz control',
    notes: 'Houses most Iranian frigates + submarines. IRGCN small-boat swarms run from here.' },
  { name: 'IRGC Aerospace Force HQ', city: 'Tehran',         host: 'IR', operator: 'IR', bloc: 'Iran', region: 'Middle East',
    lat: 35.689, lng: 51.389, type: 'air',    personnel: 15000, status: 'active',
    function: 'Iran\'s ballistic missile + drone command',
    notes: 'Conducted Apr 2024 + Oct 2024 strikes on Israel; manages proxy supply.' },

  // ══════════════════════════════════════════════════════
  // Israel
  // ══════════════════════════════════════════════════════
  { name: 'Tel Nof Airbase',       city: 'Rehovot',          host: 'IL', operator: 'IL', bloc: 'Israel', region: 'Middle East',
    lat: 31.840, lng: 34.823, type: 'air',    personnel: 5000,  status: 'active',
    function: 'F-15I Ra\'am long-range strike + S&R',
    notes: 'Most likely launch base for any Iran strike package.' },
  { name: 'Palmachim Airbase',     city: 'Rishon LeZion',    host: 'IL', operator: 'IL', bloc: 'Israel', region: 'Middle East',
    lat: 31.898, lng: 34.690, type: 'space',  personnel: 1500,  status: 'active',
    function: 'IDF satellite launch + UAV operations + Arrow ABM',
    notes: 'Sole Israeli space launch site (Shavit rocket).' },

  // ══════════════════════════════════════════════════════
  // Other notable
  // ══════════════════════════════════════════════════════
  { name: 'Turkish Forces Cyprus', city: 'Northern Nicosia', host: 'CY', operator: 'TR', bloc: 'Other', region: 'Europe',
    lat: 35.301, lng: 33.366, type: 'army',   personnel: 30000, status: 'contested',
    function: 'Largest foreign troop deployment in Europe',
    notes: 'Occupation force since 1974; only Turkey recognises Northern Cyprus.' },
  { name: 'NATO Allied Air Command',city: 'Ramstein',        host: 'DE', operator: 'NATO', bloc: 'NATO', region: 'Europe',
    lat: 49.443, lng: 7.598,  type: 'air',    personnel: 1200,  status: 'active',
    function: 'NATO air component command',
    notes: 'Coordinates NATO integrated air + missile defence + Air Policing missions.' },
  { name: 'NATO Allied Maritime Command', city: 'Northwood', host: 'GB', operator: 'NATO', bloc: 'NATO', region: 'Europe',
    lat: 51.604, lng: -0.422, type: 'navy',   personnel: 500,   status: 'active',
    function: 'NATO maritime forces HQ',
    notes: 'Operates Standing NATO Maritime Groups + Sea Guardian patrols.' },
  { name: 'JBSA-Lackland (Cyber/SIGINT)', city: 'San Antonio', host: 'US', operator: 'US', bloc: 'US', region: 'North America',
    lat: 29.385, lng: -98.581, type: 'sigint', personnel: 12000, status: 'active',
    function: 'HQ 16th Air Force — USAF cyber + SIGINT + ISR',
    notes: 'Lift-off site for most USAF basic training too.' },
];

export async function GET() {
  const maxPpl = BASES.reduce((m, b) => Math.max(m, b.personnel), 0) || 1;
  const bases = BASES.map(b => ({
    ...b,
    intensity: Math.min(1, Math.sqrt(b.personnel / maxPpl)),
  }));
  const byBloc: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalPpl = 0;
  for (const b of BASES) {
    byBloc[b.bloc] = (byBloc[b.bloc] || 0) + 1;
    byType[b.type] = (byType[b.type] || 0) + 1;
    totalPpl += b.personnel;
  }
  return NextResponse.json({
    bases,
    total: BASES.length,
    total_personnel: totalPpl,
    by_bloc: byBloc,
    by_type: byType,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
