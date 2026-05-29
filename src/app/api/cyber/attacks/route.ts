import { NextResponse } from 'next/server';

/**
 * OSIRIS — Named Cyberattacks
 *
 * Curated dataset of major attributed cyber incidents since 2010. Sources:
 * MITRE ATT&CK group profiles, CISA advisories, Mandiant / CrowdStrike /
 * Microsoft MSTIC / Recorded Future / Symantec named reports, US DOJ
 * indictments, ODNI public attribution statements, CFR Cyber Operations
 * Tracker, ENISA Threat Landscape.
 *
 * Each entry represents one named, attributed incident — not every CVE
 * exploited in the wild. ~40 incidents cover the canonical attribution
 * lines (Russia, China, NK, Iran, Israel/US, criminal RU-aligned).
 *
 *   operator_bloc    coarse attribution alignment for marker colour
 *   threat_actor     named APT / group (Sandworm, Cozy Bear, Lazarus, etc.)
 *   target_country   primary impacted country ISO
 *   target_sector    sector hit (gov, energy, finance, …)
 *   technique        primary access vector
 *   impact_score     0-100 informal severity score (financial + strategic)
 *   confidence       attribution confidence
 */

type Bloc = 'Russia' | 'China' | 'NK' | 'Iran' | 'Israel' | 'US' | 'Criminal' | 'Hacktivist' | 'Other';
type Confidence = 'high' | 'medium' | 'low';
type Sector = 'gov' | 'military' | 'critical-infra' | 'energy' | 'finance' | 'healthcare' | 'tech' | 'telecom' | 'media' | 'transport' | 'retail' | 'crypto' | 'industrial';

interface Attack {
  name: string;
  date: string;                  // YYYY-MM
  threat_actor: string;
  operator: string | null;       // ISO of attributed nation (or null for criminal)
  operator_bloc: Bloc;
  operator_lat: number;
  operator_lng: number;
  target_country: string;        // ISO of primary target
  target_lat: number;
  target_lng: number;
  target_label: string;          // city or org for marker name
  target_sector: Sector;
  technique: string;
  impact_score: number;          // 0-100
  impact_summary: string;
  confidence: Confidence;
  notes: string;
}

// Country centroids reused across the dataset
const C = {
  RU: { lat: 55.75, lng: 37.62 }, CN: { lat: 39.91, lng: 116.40 },
  KP: { lat: 39.02, lng: 125.75 },IR: { lat: 35.69, lng: 51.39 },
  IL: { lat: 31.78, lng: 35.22 }, US: { lat: 38.90, lng: -77.04 },
  GB: { lat: 51.51, lng: -0.13 }, UA: { lat: 50.45, lng: 30.52 },
  DE: { lat: 51.00, lng: 10.00 }, FR: { lat: 48.86, lng: 2.35 },
  KR: { lat: 37.57, lng: 126.98 },JP: { lat: 35.69, lng: 139.69 },
  BD: { lat: 23.81, lng: 90.41 }, SA: { lat: 24.71, lng: 46.67 },
  AL: { lat: 41.33, lng: 19.82 }, CR: { lat: 9.93, lng: -84.08 },
  AU: { lat: -33.87, lng: 151.21 }, CA: { lat: 45.42, lng: -75.70 },
  GLOB: { lat: -10, lng: -25 },  // null-Atlantic for global-spread events
};

const ATTACKS: Attack[] = [
  // ══════════════════════════════════════════════════════
  // Russia (Sandworm, Cozy Bear, Fancy Bear, criminal-adjacent)
  // ══════════════════════════════════════════════════════
  { name: 'NotPetya',                                date: '2017-06', threat_actor: 'Sandworm (GRU Unit 74455)',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'UA', target_lat: C.UA.lat, target_lng: C.UA.lng, target_label: 'Ukraine + global spillover',
    target_sector: 'gov', technique: 'M.E.Doc supply-chain wiper',
    impact_score: 98, impact_summary: '~$10B global damages (Maersk, Merck, FedEx, Mondelez). Most destructive cyberattack in history.',
    confidence: 'high', notes: 'US/UK/AU formal attribution Feb 2018. Disguised as ransomware; actual purpose was destruction.' },
  { name: 'Ukrainian Power Grid I',                  date: '2015-12', threat_actor: 'Sandworm',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'UA', target_lat: 48.92, target_lng: 24.71, target_label: 'Ivano-Frankivsk',
    target_sector: 'energy', technique: 'BlackEnergy + KillDisk against SCADA',
    impact_score: 85, impact_summary: '~225K customers lost power for 1-6 hrs across 3 oblasts. First public cyberattack to cause grid outage.',
    confidence: 'high', notes: 'First confirmed cyberattack causing power outage. SANS ICS report 2016.' },
  { name: 'Ukrainian Power Grid II',                 date: '2016-12', threat_actor: 'Sandworm',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'UA', target_lat: 50.45, target_lng: 30.52, target_label: 'Kyiv (Pivnichna substation)',
    target_sector: 'energy', technique: 'Industroyer / CRASHOVERRIDE ICS malware',
    impact_score: 80, impact_summary: '~1hr outage to a 200 MW substation; first malware purpose-built for grid disruption.',
    confidence: 'high', notes: 'ESET / Dragos attribution. Industroyer is the framework reused in subsequent attacks.' },
  { name: 'TV5Monde',                                 date: '2015-04', threat_actor: 'Fancy Bear (APT28)',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'FR', target_lat: 48.83, target_lng: 2.33, target_label: 'TV5Monde Paris',
    target_sector: 'media', technique: 'Spear-phish → wiper malware',
    impact_score: 70, impact_summary: '12 channels blacked out simultaneously; ~$20M damage. Disguised as "Cyber Caliphate" false-flag.',
    confidence: 'high', notes: 'French ANSSI attribution. Originally claimed by fake ISIS-aligned group as misdirection.' },
  { name: 'DNC Hack & DCLeaks',                       date: '2016-06', threat_actor: 'Cozy Bear + Fancy Bear',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: 38.90, target_lng: -77.04, target_label: 'DNC headquarters',
    target_sector: 'gov', technique: 'Spear-phish (Podesta) + persistent access',
    impact_score: 92, impact_summary: 'Stolen emails leaked via WikiLeaks/DCLeaks/Guccifer 2.0 during 2016 US election. Mueller indictment named 12 GRU officers.',
    confidence: 'high', notes: 'US DOJ indictment Jul 2018; intelligence-community assessment Jan 2017.' },
  { name: 'SolarWinds (SUNBURST)',                    date: '2020-12', threat_actor: 'Cozy Bear (SVR)',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: C.US.lat, target_lng: C.US.lng, target_label: 'US federal + Fortune 500',
    target_sector: 'gov', technique: 'Supply-chain compromise of Orion update mechanism',
    impact_score: 99, impact_summary: '~18K orgs received trojanised updates; ~100 actually exploited (Treasury, State, DHS, MS, Cisco, Mandiant). Highest-impact cyber-espionage op of the decade.',
    confidence: 'high', notes: 'US joint statement Jan 2021. Triggered EO 14028 on federal cybersecurity.' },
  { name: 'Microsoft Midnight Blizzard',              date: '2024-01', threat_actor: 'Cozy Bear (SVR)',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: 47.64, target_lng: -122.13, target_label: 'Microsoft Redmond',
    target_sector: 'tech', technique: 'Password-spray on legacy test tenant → OAuth abuse',
    impact_score: 78, impact_summary: 'Compromised corporate email accounts including senior leadership + cybersecurity team. Source code repo access; concerning for downstream customer impact.',
    confidence: 'high', notes: 'Microsoft 8-K filing Jan 2024 + March update. CISA emergency directive followed.' },
  { name: 'Colonial Pipeline',                        date: '2021-05', threat_actor: 'DarkSide (RU-aligned)',
    operator: 'RU', operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: 35.79, target_lng: -78.78, target_label: 'Colonial Pipeline HQ',
    target_sector: 'energy', technique: 'Stolen VPN credential + Conti-family ransomware',
    impact_score: 88, impact_summary: '5500-mile pipeline shut down for 6 days; East Coast fuel shortages + price spikes. ~$4.4M ransom paid, partially recovered by FBI.',
    confidence: 'high', notes: 'DarkSide announced "shutdown" days later, members joined other crews. Triggered TSA Security Directives.' },
  { name: 'Viasat KA-SAT (AcidRain)',                 date: '2022-02', threat_actor: 'Sandworm',
    operator: 'RU', operator_bloc: 'Russia', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'UA', target_lat: C.UA.lat, target_lng: C.UA.lng, target_label: 'Ukraine + EU collateral',
    target_sector: 'telecom', technique: 'AcidRain wiper deployed to KA-SAT modems',
    impact_score: 84, impact_summary: 'Bricked ~5,800 German Enercon wind turbines as collateral. Coincided with invasion start.',
    confidence: 'high', notes: 'EU + UK + US joint attribution May 2022. SentinelLabs initial detection.' },
  { name: 'Kaseya VSA',                               date: '2021-07', threat_actor: 'REvil',
    operator: 'RU', operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: 27.95, target_lng: -82.46, target_label: 'Kaseya Miami → ~1500 MSPs',
    target_sector: 'tech', technique: 'Zero-day in VSA + supply-chain ransomware deployment',
    impact_score: 86, impact_summary: 'Ransomware deployed to 800-1500 downstream businesses via MSPs. Coop Sweden closed 800 stores.',
    confidence: 'high', notes: 'REvil disappeared Jul 13 days after attack; Russian FSB arrested 14 members Jan 2022.' },
  { name: 'CL0P MOVEit',                              date: '2023-05', threat_actor: 'CL0P (RU-aligned)',
    operator: 'RU', operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: C.US.lat, target_lng: C.US.lng, target_label: '2700+ orgs globally',
    target_sector: 'tech', technique: 'MOVEit Transfer zero-day (CVE-2023-34362) mass exploitation',
    impact_score: 90, impact_summary: '2700+ organisations + ~94M individuals impacted. BBC, BA, Shell, US gov, NY DOE all named.',
    confidence: 'high', notes: 'Largest ransomware-style data-theft event of 2023. Estimated $12B+ in remediation costs.' },
  { name: 'Costa Rica state-of-emergency',            date: '2022-04', threat_actor: 'Conti',
    operator: 'RU', operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'CR', target_lat: C.CR.lat, target_lng: C.CR.lng, target_label: 'Costa Rica government',
    target_sector: 'gov', technique: 'Initial access via stolen VPN creds + ransomware deployment',
    impact_score: 82, impact_summary: 'Pres. Chaves declared national emergency. Finance + customs systems down for weeks. Conti demanded $20M; CR refused.',
    confidence: 'high', notes: 'First time a state declared emergency over cyberattack. Conti dissolved shortly after.' },
  { name: 'NHS Synnovis blood testing',               date: '2024-06', threat_actor: 'Qilin (RU-aligned)',
    operator: 'RU', operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'GB', target_lat: 51.51, target_lng: -0.10, target_label: 'NHS London (Synnovis)',
    target_sector: 'healthcare', technique: 'Ransomware deployment to pathology services provider',
    impact_score: 75, impact_summary: '10,000+ outpatient appointments + 1,700 surgeries cancelled. 400GB exfiltrated and leaked.',
    confidence: 'high', notes: 'Hit Kings + Guys & St Thomas trusts. Months of blood-testing capacity loss.' },

  // ══════════════════════════════════════════════════════
  // China (APT1/10/40/41, Hafnium, Volt/Salt Typhoon)
  // ══════════════════════════════════════════════════════
  { name: 'OPM data breach',                          date: '2015-06', threat_actor: 'APT1 (PLA Unit 61398)',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: 38.89, target_lng: -77.03, target_label: 'OPM (US fed personnel)',
    target_sector: 'gov', technique: 'Stolen creds → long-dwell persistence',
    impact_score: 92, impact_summary: '21.5M federal personnel records stolen incl. SF-86 forms with full background-investigation details. Crown-jewel intel for CN counter-intel.',
    confidence: 'high', notes: 'US Senate report. Likely most damaging foreign-intel collection of US gov data ever.' },
  { name: 'Microsoft Exchange ProxyLogon',            date: '2021-03', threat_actor: 'Hafnium',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: C.GLOB.lat, target_lng: C.GLOB.lng, target_label: 'Global (250K+ servers)',
    target_sector: 'tech', technique: 'Chained on-prem Exchange zero-days (CVE-2021-26855 et al.)',
    impact_score: 94, impact_summary: '~250K Exchange servers globally backdoored before patch could roll. Subsequent ransomware wave compounded damage.',
    confidence: 'high', notes: 'US/UK/EU/NATO joint attribution Jul 2021 — first joint NATO statement explicitly blaming China.' },
  { name: 'Equifax',                                  date: '2017-09', threat_actor: 'PLA 54th Research Inst',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: 33.78, target_lng: -84.39, target_label: 'Equifax Atlanta',
    target_sector: 'finance', technique: 'Apache Struts CVE-2017-5638',
    impact_score: 90, impact_summary: '147M Americans + 15M Brits + 19K Canadians. ~$1.4B Equifax remediation cost. DOJ 2020 indicted 4 PLA officers.',
    confidence: 'high', notes: 'US DOJ indictment Feb 2020 of 4 PLA 54th Research Institute officers.' },
  { name: 'Marriott / Starwood',                      date: '2018-11', threat_actor: 'APT10',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: 39.10, target_lng: -77.20, target_label: 'Marriott / Starwood',
    target_sector: 'retail', technique: 'Long-dwell access to Starwood reservation DB',
    impact_score: 80, impact_summary: '500M guest records incl. passport numbers. ICO fined Marriott £18.4M.',
    confidence: 'high', notes: 'US officials attributed in 2018-2019; intel value for travel-pattern analysis of US persons.' },
  { name: 'Volt Typhoon',                             date: '2023-05', threat_actor: 'Volt Typhoon',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: C.US.lat, target_lng: C.US.lng, target_label: 'US critical infrastructure',
    target_sector: 'critical-infra', technique: '"Living-off-the-land" persistence on routers + critical-infra networks',
    impact_score: 96, impact_summary: 'Pre-positioning for destructive ops during contingency (Taiwan). FBI/CISA disclosed Jan 2024. DOJ takedown of botnet Jan 2024.',
    confidence: 'high', notes: 'Microsoft + CISA disclosure May 2023. Considered the most strategically important CN cyber posture known to date.' },
  { name: 'Salt Typhoon (US telcos)',                 date: '2024-09', threat_actor: 'Salt Typhoon',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: 32.78, target_lng: -96.80, target_label: 'AT&T / Verizon / Lumen',
    target_sector: 'telecom', technique: 'Long-dwell on US telecom backbone routers + lawful-intercept systems',
    impact_score: 95, impact_summary: 'Compromised CALEA lawful-intercept platforms; reportedly read text of presidential-campaign comms. WSJ + WP reporting Oct 2024.',
    confidence: 'high', notes: 'CISA/FBI joint advisory Dec 2024 advised encrypted-messaging use. Ongoing eviction.' },
  { name: 'Microsoft Storm-0558',                     date: '2023-07', threat_actor: 'Storm-0558',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'US', target_lat: 38.89, target_lng: -77.04, target_label: 'US State Dept + Commerce',
    target_sector: 'gov', technique: 'Forged Azure AD tokens via stolen MSA signing key',
    impact_score: 88, impact_summary: 'Read mailboxes of US Ambassador to China + senior State/Commerce officials. CSRB report scathed Microsoft.',
    confidence: 'high', notes: 'CSRB Apr 2024 report listed Microsoft\'s cascading failures as "preventable".' },
  { name: 'UK Electoral Commission',                  date: '2021-08', threat_actor: 'APT31',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'GB', target_lat: 51.51, target_lng: -0.13, target_label: 'UK Electoral Commission',
    target_sector: 'gov', technique: 'Long-dwell access, undetected ~14 months',
    impact_score: 72, impact_summary: '~40M UK voters\' data accessed. Disclosed Aug 2023. UK govt attributed to China Mar 2024.',
    confidence: 'high', notes: 'UK formal attribution Mar 2024; targeted MPs critical of China also indicted.' },
  { name: 'UK Ministry of Defence payroll',           date: '2024-05', threat_actor: 'attributed PRC',
    operator: 'CN', operator_bloc: 'China', operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    target_country: 'GB', target_lat: 51.50, target_lng: -0.13, target_label: 'UK MoD (SSCL contractor)',
    target_sector: 'military', technique: 'Compromise of SSCL HR/payroll contractor',
    impact_score: 70, impact_summary: '270K serving + recent armed-forces personnel records. UK named China in Parliament May 2024; Beijing denied.',
    confidence: 'medium', notes: 'Shapps statement May 2024.' },

  // ══════════════════════════════════════════════════════
  // North Korea (Lazarus, BlueNoroff, Andariel)
  // ══════════════════════════════════════════════════════
  { name: 'Sony Pictures',                            date: '2014-11', threat_actor: 'Lazarus',
    operator: 'KP', operator_bloc: 'NK', operator_lat: C.KP.lat, operator_lng: C.KP.lng,
    target_country: 'US', target_lat: 34.03, target_lng: -118.39, target_label: 'Sony Pictures Culver City',
    target_sector: 'media', technique: 'Spear-phish → wiper + data theft',
    impact_score: 78, impact_summary: 'Unreleased films, scripts, internal emails leaked. ~$100M+ damage. Triggered FBI public attribution + US sanctions.',
    confidence: 'high', notes: 'Retaliation for "The Interview" film. First public NK cyber attribution by FBI.' },
  { name: 'Bangladesh Bank SWIFT heist',              date: '2016-02', threat_actor: 'Lazarus',
    operator: 'KP', operator_bloc: 'NK', operator_lat: C.KP.lat, operator_lng: C.KP.lng,
    target_country: 'BD', target_lat: C.BD.lat, target_lng: C.BD.lng, target_label: 'Bangladesh Bank',
    target_sector: 'finance', technique: 'SWIFT credential abuse for fraudulent fund transfers',
    impact_score: 80, impact_summary: '$81M stolen via NY Fed → Philippines casinos. Attempted $951M; typo halted larger transfers.',
    confidence: 'high', notes: 'BAE Systems + Kaspersky attribution. NK\'s pivot to cyber-enabled revenue generation.' },
  { name: 'WannaCry',                                 date: '2017-05', threat_actor: 'Lazarus',
    operator: 'KP', operator_bloc: 'NK', operator_lat: C.KP.lat, operator_lng: C.KP.lng,
    target_country: 'GB', target_lat: C.GLOB.lat + 5, target_lng: C.GLOB.lng - 5, target_label: 'Global (NHS UK most-cited)',
    target_sector: 'healthcare', technique: 'EternalBlue SMB exploit + ransomware worm',
    impact_score: 93, impact_summary: '200K systems in 150 countries. UK NHS most-publicised: 19K appointments cancelled, ~£92M cost. ~$4B global estimate.',
    confidence: 'high', notes: 'US/UK/AU/CA/JP joint attribution Dec 2017. Kill-switch domain registered by MalwareTech.' },
  { name: 'Ronin Bridge / Axie Infinity',             date: '2022-03', threat_actor: 'Lazarus',
    operator: 'KP', operator_bloc: 'NK', operator_lat: C.KP.lat, operator_lng: C.KP.lng,
    target_country: 'US', target_lat: 1.35, target_lng: 103.82, target_label: 'Ronin Network (Sky Mavis)',
    target_sector: 'crypto', technique: 'Spear-phish → validator-node compromise',
    impact_score: 82, impact_summary: '$625M ETH/USDC drained — largest crypto heist ever at the time. Treasury OFAC named the wallet Apr 2022.',
    confidence: 'high', notes: 'Funded NK weapons programs per UN Panel of Experts.' },
  { name: 'Atomic Wallet',                            date: '2023-06', threat_actor: 'Lazarus',
    operator: 'KP', operator_bloc: 'NK', operator_lat: C.KP.lat, operator_lng: C.KP.lng,
    target_country: 'US', target_lat: 56.95, target_lng: 24.10, target_label: 'Atomic Wallet (Estonia)',
    target_sector: 'crypto', technique: 'Wallet-app backdoor → mass private-key theft',
    impact_score: 64, impact_summary: '$100M+ from 5500+ wallets. Elliptic + Chainalysis attribution.',
    confidence: 'high', notes: '2023 was NK\'s record cyber-revenue year — $1B+ stolen across multiple campaigns.' },

  // ══════════════════════════════════════════════════════
  // Iran (Shamoon, APT33/34/35, OilRig, CyberAv3ngers)
  // ══════════════════════════════════════════════════════
  { name: 'Shamoon / Saudi Aramco',                   date: '2012-08', threat_actor: 'APT33 (Refined Kitten)',
    operator: 'IR', operator_bloc: 'Iran', operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    target_country: 'SA', target_lat: 26.42, target_lng: 50.10, target_label: 'Saudi Aramco Dhahran',
    target_sector: 'energy', technique: 'Disttrack/Shamoon wiper deployment via insider',
    impact_score: 85, impact_summary: '30K+ workstations wiped at world\'s largest oil company. Aramco bought every hard drive on the global market.',
    confidence: 'high', notes: 'Retaliation for Stuxnet. Reappeared 2016 (Shamoon 2), 2018 (Shamoon 3).' },
  { name: 'Triton / TRISIS Saudi petrochem',          date: '2017-08', threat_actor: 'Xenotime',
    operator: 'IR', operator_bloc: 'Iran', operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    target_country: 'SA', target_lat: 26.93, target_lng: 49.50, target_label: 'Saudi petrochemical plant',
    target_sector: 'industrial', technique: 'Triconex Safety Instrumented System compromise',
    impact_score: 91, impact_summary: 'First malware targeting safety-shutdown systems. Plant tripped on failed payload — could have caused mass-casualty incident.',
    confidence: 'high', notes: 'FireEye/Dragos attribution. Xenotime now tracked targeting US/Australian utilities.' },
  { name: 'Albania disrupted',                        date: '2022-07', threat_actor: 'Homeland Justice (MOIS)',
    operator: 'IR', operator_bloc: 'Iran', operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    target_country: 'AL', target_lat: C.AL.lat, target_lng: C.AL.lng, target_label: 'Albanian government',
    target_sector: 'gov', technique: 'Ransomware + wiper combo on gov systems',
    impact_score: 84, impact_summary: 'Albania severed diplomatic ties with Iran Sept 2022 — first state-to-state cyber-driven rupture. Targeted because Albania hosts MEK exiles.',
    confidence: 'high', notes: 'Mandiant + FBI attribution. Multiple follow-up waves into 2024.' },
  { name: 'Israeli water systems',                    date: '2020-04', threat_actor: 'IRGC-attributed',
    operator: 'IR', operator_bloc: 'Iran', operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    target_country: 'IL', target_lat: C.IL.lat, target_lng: C.IL.lng, target_label: 'Israeli water utilities',
    target_sector: 'critical-infra', technique: 'PLC compromise targeting chlorine dosing',
    impact_score: 80, impact_summary: 'Attempt to manipulate chlorine levels at water pumping stations. Quickly detected. Israel reportedly responded with attack on Shahid Rajaee port.',
    confidence: 'high', notes: 'Per Iran Watch + Israeli officials. Started the open Iran-Israel cyber tit-for-tat era.' },
  { name: 'Israeli gas stations (Pay2Key II)',        date: '2021-10', threat_actor: 'IRGC',
    operator: 'IR', operator_bloc: 'Iran', operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    target_country: 'IL', target_lat: 32.07, target_lng: 34.78, target_label: 'Israel-wide gas stations',
    target_sector: 'critical-infra', technique: 'Compromise of fuel-payment processing',
    impact_score: 65, impact_summary: 'Halted fuel sales across Israel for ~24h. Display screens hacked to show Khamenei statement.',
    confidence: 'high', notes: 'Followed Israeli alleged hit on Iranian railway booking system.' },
  { name: 'CyberAv3ngers Aliquippa',                  date: '2023-11', threat_actor: 'CyberAv3ngers (IRGC)',
    operator: 'IR', operator_bloc: 'Iran', operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    target_country: 'US', target_lat: 40.61, target_lng: -80.26, target_label: 'Municipal Water Authority of Aliquippa, PA',
    target_sector: 'critical-infra', technique: 'Default-credential exploit on Unitronics PLCs',
    impact_score: 60, impact_summary: 'Defaced HMI screens at small US water utility with anti-Israel imagery. Manual operations continued. Triggered CISA-wide Unitronics advisory.',
    confidence: 'high', notes: 'First IRGC-attributed cyberattack inside US during Gaza war.' },

  // ══════════════════════════════════════════════════════
  // Criminal / ransomware (often RU-aligned but distinct)
  // ══════════════════════════════════════════════════════
  { name: 'MGM + Caesars',                            date: '2023-09', threat_actor: 'Scattered Spider + ALPHV',
    operator: null, operator_bloc: 'Criminal', operator_lat: 51.51, operator_lng: -0.13, // Scattered Spider includes UK members
    target_country: 'US', target_lat: 36.12, target_lng: -115.17, target_label: 'MGM + Caesars Las Vegas',
    target_sector: 'retail', technique: 'Vishing IT helpdesk → social-engineering MFA reset',
    impact_score: 82, impact_summary: 'MGM ~$100M loss + 10-day Vegas casino outage; Caesars paid ~$15M ransom. Pivotal moment for casino-industry security.',
    confidence: 'high', notes: 'Scattered Spider members include 17-22 yo English-speaking ransomware affiliates.' },
  { name: 'Change Healthcare',                        date: '2024-02', threat_actor: 'ALPHV/BlackCat',
    operator: null, operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: 36.16, target_lng: -86.78, target_label: 'Change Healthcare Nashville',
    target_sector: 'healthcare', technique: 'Stolen Citrix VPN creds (no MFA) → ransomware',
    impact_score: 93, impact_summary: 'Worst healthcare cyberattack ever. US pharmacy claim processing froze for weeks; UnitedHealth paid $22M ransom. 100M+ records.',
    confidence: 'high', notes: 'ALPHV admins exit-scammed the affiliate; data later re-extorted by RansomHub.' },
  { name: 'Snowflake breach chain',                   date: '2024-05', threat_actor: 'UNC5537',
    operator: null, operator_bloc: 'Criminal', operator_lat: 51.51, operator_lng: -0.13,
    target_country: 'US', target_lat: 37.39, target_lng: -122.08, target_label: 'AT&T + Ticketmaster + Santander + many',
    target_sector: 'tech', technique: 'Infostealer-harvested creds (no MFA on Snowflake instances)',
    impact_score: 88, impact_summary: '160+ Snowflake customers compromised. AT&T paid $370K ransom; Ticketmaster 560M users; Santander 30M.',
    confidence: 'high', notes: 'Mandiant attribution. Highlighted SaaS provider responsibility-sharing failures.' },
  { name: 'CDK Global auto dealers',                  date: '2024-06', threat_actor: 'BlackSuit',
    operator: null, operator_bloc: 'Criminal', operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    target_country: 'US', target_lat: 42.12, target_lng: -88.03, target_label: 'CDK Global → 15K US dealerships',
    target_sector: 'tech', technique: 'Ransomware on dealer management system SaaS',
    impact_score: 78, impact_summary: '15K US auto dealerships unable to process sales/service for 2+ weeks. CDK reportedly paid ~$25M.',
    confidence: 'medium', notes: 'BlackSuit is rebranded Royal/Conti lineage.' },
  { name: 'Uber',                                     date: '2022-09', threat_actor: 'Lapsus$',
    operator: null, operator_bloc: 'Criminal', operator_lat: 51.51, operator_lng: -0.13,
    target_country: 'US', target_lat: 37.77, target_lng: -122.42, target_label: 'Uber San Francisco',
    target_sector: 'tech', technique: 'MFA-bombing of contractor + lateral movement',
    impact_score: 60, impact_summary: '18-year-old member of Lapsus$ posted screenshots of internal AWS + GSuite consoles. Slack channels owned for hours.',
    confidence: 'high', notes: 'Lapsus$ leader Arion Kurtaj convicted UK 2023.' },

  // ══════════════════════════════════════════════════════
  // Israel / US joint (overt or strongly attributed)
  // ══════════════════════════════════════════════════════
  { name: 'Stuxnet',                                  date: '2010-06', threat_actor: 'Equation Group',
    operator: 'US', operator_bloc: 'US', operator_lat: 39.10, operator_lng: -76.77,
    target_country: 'IR', target_lat: 33.72, target_lng: 51.73, target_label: 'Iran Natanz enrichment facility',
    target_sector: 'industrial', technique: 'Zero-days + signed driver + Siemens PLC compromise',
    impact_score: 99, impact_summary: 'Destroyed ~1000 IR-1 centrifuges over 18 months. Set Iranian enrichment program back ~2 years. First publicly known cyberweapon.',
    confidence: 'high', notes: 'NYT (Sanger) + Snowden disclosures confirm US-Israeli joint development ("Olympic Games").' },
  { name: 'Predatory Sparrow railway',                date: '2021-07', threat_actor: 'Predatory Sparrow',
    operator: 'IL', operator_bloc: 'Israel', operator_lat: C.IL.lat, operator_lng: C.IL.lng,
    target_country: 'IR', target_lat: 35.69, target_lng: 51.39, target_label: 'Iranian Railways',
    target_sector: 'transport', technique: 'IT compromise + wiper-like board overwrite',
    impact_score: 65, impact_summary: 'Train schedule boards across Iran displayed Khamenei phone number; ~96% of operations disrupted briefly.',
    confidence: 'medium', notes: 'Check Point analysis. Israel never confirms, but capability + targeting consistent with Unit 8200.' },
  { name: 'Predatory Sparrow gas stations',           date: '2023-12', threat_actor: 'Predatory Sparrow',
    operator: 'IL', operator_bloc: 'Israel', operator_lat: C.IL.lat, operator_lng: C.IL.lng,
    target_country: 'IR', target_lat: 35.69, target_lng: 51.39, target_label: 'Iran-wide gas station network',
    target_sector: 'critical-infra', technique: 'Compromise of fuel-subsidy payment system',
    impact_score: 70, impact_summary: '~70% of Iranian gas stations went offline. Hours-long queues. Repeat of the 2021 Israeli op.',
    confidence: 'medium', notes: 'Coincided with Israel-Hamas war Gaza escalation.' },
];

export async function GET() {
  // Group per target country for the marker layer — one dot per target country.
  // Place each country's marker at the centroid of its attacks (so the dot
  // sits near the actual incidents within that country, not always the
  // geographic capital).
  const byTarget = new Map<string, any>();
  for (const a of ATTACKS) {
    const key = a.target_country;
    if (!byTarget.has(key)) {
      byTarget.set(key, {
        target_country: a.target_country,
        target_label: a.target_country,   // refined below
        lat_sum: 0, lng_sum: 0,
        attacks: [], total_count: 0,
        bloc_count: {} as Record<string, number>,
        total_impact: 0,
        most_recent_date: a.date,
      });
    }
    const grp = byTarget.get(key);
    grp.attacks.push(a);
    grp.lat_sum += a.target_lat;
    grp.lng_sum += a.target_lng;
    grp.total_count++;
    grp.bloc_count[a.operator_bloc] = (grp.bloc_count[a.operator_bloc] || 0) + 1;
    grp.total_impact += a.impact_score;
    if (a.date > grp.most_recent_date) grp.most_recent_date = a.date;
  }
  // Marker centroid + better display label
  for (const g of byTarget.values()) {
    g.lat = g.lat_sum / g.total_count;
    g.lng = g.lng_sum / g.total_count;
    delete g.lat_sum; delete g.lng_sum;
    // If only one attack, use its specific label; otherwise show the country
    // ISO with attack count for marker clarity.
    if (g.total_count === 1) g.target_label = g.attacks[0].target_label;
    else g.target_label = `${g.target_country} (${g.total_count} incidents)`;
  }
  // Dominant attacker bloc per target → used for marker colour
  const targets = [...byTarget.values()].map(g => {
    const dominantBloc = Object.entries(g.bloc_count).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'Other';
    g.attacks.sort((a: any, b: any) => b.date.localeCompare(a.date));
    return { ...g, dominant_bloc: dominantBloc };
  }).sort((a, b) => b.total_count - a.total_count);

  // Arc features — one per attack with attributed operator
  const arcs = ATTACKS.filter(a => a.operator)
    .map(a => ({
      operator: a.operator, operator_bloc: a.operator_bloc,
      operator_lat: a.operator_lat, operator_lng: a.operator_lng,
      target_lat: a.target_lat, target_lng: a.target_lng,
      attack_name: a.name, threat_actor: a.threat_actor,
    }));

  const byBloc: Record<string, number> = {};
  for (const a of ATTACKS) byBloc[a.operator_bloc] = (byBloc[a.operator_bloc] || 0) + 1;

  return NextResponse.json({
    attacks: ATTACKS,
    targets,
    arcs,
    total: ATTACKS.length,
    by_bloc: byBloc,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
