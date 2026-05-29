import { NextResponse } from 'next/server';

/**
 * OSIRIS — State-attributed Influence Operations
 *
 * Curated dataset of long-running, named information operations with public
 * nation-state attribution. Sources: EUvsDisinfo (EU EEAS StratCom Task
 * Force), Atlantic Council Digital Forensic Research Lab (DFRLab), Stanford
 * Internet Observatory archives, Meta Adversarial Threat Reports, Microsoft
 * Threat Analysis Center, Mandiant, Graphika, ASPI ICPC, ODIHR.
 *
 * Each entry represents a named, distinct operation — not every individual
 * fake account or single-post incident. ~40 entries cover the canonical
 * named ops actively monitored by Western threat-intel community 2014-2026.
 *
 *   operator    nation hosting the operation
 *   operator_bloc  coarse alignment for marker colour
 *   targets[]   country ISOs primarily targeted (arc-line endpoints)
 *   platforms   short comma-joined list of channels used
 *   era         active years (e.g. "2014-present")
 *   confidence  attribution confidence — high | medium | low
 *   scale       coarse-grained — small (<1k assets) / medium (1k-100k) / large (100k+)
 *   sources     short attribution citation
 */

type Bloc = 'Russia' | 'China' | 'Iran' | 'NK' | 'Israel' | 'Turkey' | 'Saudi' | 'UAE' | 'India' | 'US' | 'UK' | 'Other';
type Confidence = 'high' | 'medium' | 'low';
type Scale = 'small' | 'medium' | 'large';

interface Op {
  name: string;
  operator: string;            // ISO of host country
  operator_bloc: Bloc;
  operator_lat: number;
  operator_lng: number;
  targets: string[];           // ISO codes targeted
  era: string;
  active: boolean;
  platforms: string;
  confidence: Confidence;
  scale: Scale;
  description: string;
  sources: string;
}

// Country centroids reused for arc endpoints (shared lookup at the bottom).
const C = {
  RU: { lat: 55.75, lng: 37.62 },   // Moscow
  CN: { lat: 39.91, lng: 116.40 },  // Beijing
  IR: { lat: 35.69, lng: 51.39 },   // Tehran
  KP: { lat: 39.02, lng: 125.75 },  // Pyongyang
  IL: { lat: 31.78, lng: 35.22 },   // Jerusalem
  TR: { lat: 39.93, lng: 32.86 },   // Ankara
  SA: { lat: 24.71, lng: 46.67 },   // Riyadh
  AE: { lat: 24.47, lng: 54.37 },   // Abu Dhabi
  IN: { lat: 28.61, lng: 77.21 },   // Delhi
  US: { lat: 38.90, lng: -77.04 },  // DC
  GB: { lat: 51.51, lng: -0.13 },   // London
  BY: { lat: 53.90, lng: 27.57 },   // Minsk

  // Target ISOs — country centroids
  UA: { lat: 49.00, lng: 31.00 }, PL: { lat: 52.00, lng: 19.00 }, DE: { lat: 51.00, lng: 10.00 },
  FR: { lat: 46.00, lng: 2.00 },  IT: { lat: 42.50, lng: 12.50 }, ES: { lat: 40.00, lng: -3.00 },
  NL: { lat: 52.30, lng: 5.30 },  SE: { lat: 60.50, lng: 16.00 }, FI: { lat: 64.00, lng: 26.00 },
  EE: { lat: 58.60, lng: 25.00 }, LV: { lat: 56.90, lng: 24.60 }, LT: { lat: 55.20, lng: 23.90 },
  MD: { lat: 47.00, lng: 28.50 }, GE: { lat: 42.32, lng: 43.36 }, AM: { lat: 40.07, lng: 45.04 },
  AZ: { lat: 40.14, lng: 47.58 }, KZ: { lat: 48.02, lng: 66.92 }, TW: { lat: 23.70, lng: 121.00 },
  HK: { lat: 22.30, lng: 114.17 },KR: { lat: 36.50, lng: 127.80 }, JP: { lat: 36.20, lng: 138.25 },
  CA: { lat: 56.13, lng: -106.35 },AU: { lat: -25.27, lng: 133.78 },NZ: { lat: -40.90, lng: 174.89 },
  MX: { lat: 23.63, lng: -102.55 },BR: { lat: -14.24, lng: -51.93 },AR: { lat: -38.42, lng: -63.62 },
  CO: { lat: 4.57, lng: -74.30 },  VE: { lat: 6.42, lng: -66.59 }, CL: { lat: -35.68, lng: -71.54 },
  ZA: { lat: -30.56, lng: 22.94 }, NG: { lat: 9.08, lng: 8.68 },   ML: { lat: 17.57, lng: -3.99 },
  BF: { lat: 12.24, lng: -1.56 },  TD: { lat: 15.45, lng: 18.73 }, CF: { lat: 6.61, lng: 20.94 },
  LB: { lat: 33.85, lng: 35.86 }, SY: { lat: 34.80, lng: 38.99 }, IQ: { lat: 33.22, lng: 43.68 },
  YE: { lat: 15.55, lng: 48.52 }, BH: { lat: 26.07, lng: 50.55 }, QA: { lat: 25.35, lng: 51.18 },
  EG: { lat: 26.82, lng: 30.80 }, MA: { lat: 31.79, lng: -7.09 }, DZ: { lat: 28.03, lng: 1.66 },
  EU: { lat: 50.85, lng: 4.35 },  // Brussels as EU institutions anchor
};

const OPS: Op[] = [
  // ── Russia ──
  { name: 'Internet Research Agency (IRA)', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 59.94, operator_lng: 30.32,  // St Petersburg (HQ)
    targets: ['US','GB','DE','FR','UA'], era: '2013-present', active: true,
    platforms: 'Twitter, Facebook, Instagram, YouTube, Reddit, Telegram',
    confidence: 'high', scale: 'large',
    description: 'St-Petersburg-based troll factory ("Trolls from Olgino"). Sanctioned by US Treasury 2018 over election interference. Owner Prigozhin died 2023; ops continued under MoD direction.',
    sources: 'US DOJ indictments 2018/2020, Mueller Report Vol I, Meta CIB takedowns' },
  { name: 'Doppelganger', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    targets: ['DE','FR','IT','US','UA','PL','GB'], era: '2022-present', active: true,
    platforms: 'Fake news sites mimicking real outlets (Le Monde, Welt, Bild, Fox News)',
    confidence: 'high', scale: 'large',
    description: 'Pro-Russian network operating cloned look-alike domains of major Western news outlets. Amplified on X/Telegram. Continues despite multiple Meta + ESET takedowns.',
    sources: 'EUvsDisinfo, EU DisinfoLab, Meta Quarterly Adversarial Threat Reports 2022-2024' },
  { name: 'Reliable Recent News (RRN)', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    targets: ['UA','DE','FR','PL','EU'], era: '2022-present', active: true,
    platforms: 'News-style websites, X amplification',
    confidence: 'high', scale: 'medium',
    description: 'Parallel network to Doppelganger; identified by Viginum (French gov\'t) as Russian state-linked. Pushes fake "exclusive" content into European discourse.',
    sources: 'Viginum (France), EUvsDisinfo' },
  { name: 'Secondary Infektion', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    targets: ['GB','US','UA','DE','PL','SE','TR'], era: '2014-present', active: true,
    platforms: '300+ obscure forums + blogs, Reddit, Medium',
    confidence: 'high', scale: 'large',
    description: 'Long-running forgery-and-leak operation. Plants fake leaked documents on small platforms then amplifies. Notable 2019 UK-US trade-deal forgery before UK election.',
    sources: 'Graphika 2020 report "Secondary Infektion", EU DisinfoLab' },
  { name: 'Storm-1516', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    targets: ['US','UA','FR','DE','EU'], era: '2023-present', active: true,
    platforms: 'Fake news videos, deepfakes, X, Telegram',
    confidence: 'high', scale: 'medium',
    description: 'Microsoft-tracked op pushing fabricated stories ahead of 2024 US election + Paris Olympics + Ukraine war narratives. Frequent fake-eyewitness video format.',
    sources: 'Microsoft Threat Analysis Center, ODNI Election Threat Updates 2024' },
  { name: 'Voice of Europe', operator: 'CZ', operator_bloc: 'Russia',  // Czech-hosted, Russian-backed
    operator_lat: 50.08, operator_lng: 14.42,
    targets: ['EU','DE','FR','PL','BE'], era: '2023-2024', active: false,
    platforms: 'News website + payments to sitting MEPs',
    confidence: 'high', scale: 'medium',
    description: 'Prague-based pro-Russian outlet exposed Mar 2024 paying MEPs for pro-Russia messaging. Belgian + Czech investigations triggered EU Parliament probe.',
    sources: 'Belgian VRT, Czech BIS intelligence service, European Parliament' },
  { name: 'Ghostwriter / UNC1151', operator: 'BY', operator_bloc: 'Russia',
    operator_lat: C.BY.lat, operator_lng: C.BY.lng,
    targets: ['LT','LV','EE','PL','DE','UA'], era: '2017-present', active: true,
    platforms: 'Compromised email accounts, defaced news sites, fake leaks',
    confidence: 'high', scale: 'medium',
    description: 'Belarusian-attributed cyber-influence hybrid op. Targets Baltic + Polish narratives + NATO troop presence. Mandiant labels UNC1151.',
    sources: 'Mandiant UNC1151 reports, EU Council attribution Sept 2021' },
  { name: 'Africa Initiative (Wagner spin-off)', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: C.RU.lat, operator_lng: C.RU.lng,
    targets: ['ML','BF','TD','CF','NG'], era: '2018-present', active: true,
    platforms: 'Telegram, local radio acquisitions, French-language sites',
    confidence: 'high', scale: 'medium',
    description: 'Russian IO posture in Sahel + West Africa, originally via Wagner / Prigozhin, now Africa Corps. Pushes anti-French + anti-UN narratives during coups.',
    sources: 'DFRLab, ACLED, France-Diplomatie statements' },

  // ── China ──
  { name: 'Spamouflage Dragon (DRAGONBRIDGE)', operator: 'CN', operator_bloc: 'China',
    operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    targets: ['US','TW','HK','GB','AU','CA'], era: '2017-present', active: true,
    platforms: 'YouTube, X, Facebook, TikTok, Reddit',
    confidence: 'high', scale: 'large',
    description: 'China\'s largest IO. Mandiant-named "Dragonbridge" — pushes pro-CCP narratives, attacks Western critics, mass account creation. Persistent despite quarterly takedowns.',
    sources: 'Mandiant, Graphika, Meta Threat Reports 2019-2025' },
  { name: 'PAPERWALL', operator: 'CN', operator_bloc: 'China',
    operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    targets: ['US','GB','FR','DE','IT','CA','AU'], era: '2020-present', active: true,
    platforms: '120+ fake local-news websites masquerading as Western local press',
    confidence: 'high', scale: 'medium',
    description: 'Citizen Lab exposé Feb 2024. Operated by Shenzhen Haimaiyunxiang Media — runs fake local-news sites in 30+ countries pushing pro-Beijing + anti-dissident content.',
    sources: 'Citizen Lab "PAPERWALL" Feb 2024' },
  { name: 'HaiEnergy / Storm-1376', operator: 'CN', operator_bloc: 'China',
    operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    targets: ['US','TW','KR','JP'], era: '2022-present', active: true,
    platforms: 'AI-generated images + audio, X, TikTok, Facebook',
    confidence: 'high', scale: 'medium',
    description: 'Microsoft-tracked. First major Chinese IO using generative-AI imagery — pushed fake "leaked" Maui-wildfire conspiracy 2023, Korean election 2024.',
    sources: 'Microsoft Threat Analysis Center, ODNI 2024' },
  { name: 'Wolf Warrior Embassy Network', operator: 'CN', operator_bloc: 'China',
    operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    targets: ['AU','GB','FR','CA','LT','SE'], era: '2019-present', active: true,
    platforms: 'X, embassy spokespeople (overt + covert amplification)',
    confidence: 'high', scale: 'medium',
    description: 'Coordinated combative messaging from Chinese ambassadors + foreign-ministry spokespeople. Lijian Zhao era peaked 2020-2022; quieter under Wang Wenbin successor but still operational.',
    sources: 'ASPI ICPC, Atlantic Council DFRLab, multiple national MFAs' },
  { name: 'Operation Honey Badger', operator: 'CN', operator_bloc: 'China',
    operator_lat: C.CN.lat, operator_lng: C.CN.lng,
    targets: ['MX','VE','CO','AR','BR'], era: '2020-present', active: true,
    platforms: 'X, fake Spanish/Portuguese-language outlets',
    confidence: 'medium', scale: 'small',
    description: 'Latin America-focused Chinese influence, riding on Belt-and-Road investment narrative. Tracked by Recorded Future + Stanford SIO.',
    sources: 'Recorded Future, Stanford Internet Observatory' },

  // ── Iran ──
  { name: 'Endless Mayfly', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    targets: ['IL','SA','US','GB'], era: '2016-2019', active: false,
    platforms: 'Lookalike news domains, X amplification',
    confidence: 'high', scale: 'medium',
    description: 'Citizen Lab 2019 exposé. Iran-attributed fake-news network mimicking Reuters, Bloomberg, others. Largely dismantled 2019-2020 but methodology survives in successors.',
    sources: 'Citizen Lab "Endless Mayfly" May 2019' },
  { name: 'International Union of Virtual Media (IUVM)', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    targets: ['US','SA','IL','GB','FR'], era: '2014-present', active: true,
    platforms: '70+ websites, X, YouTube, Facebook, Telegram',
    confidence: 'high', scale: 'large',
    description: 'Network of pseudo-news websites in 20+ languages amplifying IRGC narratives. Multi-platform takedowns 2018, 2020, 2024 but core network persists.',
    sources: 'FireEye/Mandiant, Meta Quarterly Reports, EU DisinfoLab' },
  { name: 'Storm-2035 (US election ops)', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    targets: ['US'], era: '2020-2024', active: true,
    platforms: 'Fake US partisan news sites + AI personas',
    confidence: 'high', scale: 'medium',
    description: 'Microsoft-named. Targeted both US partisan ends in 2024 election — "Nio Thinker" (left) + "Savannah Time" (right) fake outlets. Tied to IRGC.',
    sources: 'Microsoft Threat Analysis Center 2024' },
  { name: 'Liminal Panda', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    targets: ['IL','SA','AE','BH'], era: '2019-present', active: true,
    platforms: 'X, Telegram, fake activist accounts',
    confidence: 'medium', scale: 'medium',
    description: 'Iran-attributed cyber-influence targeting Gulf rivals + Israel. Particularly active during regional escalation episodes.',
    sources: 'CrowdStrike, Recorded Future' },
  { name: 'October 7 aftermath IO', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: C.IR.lat, operator_lng: C.IR.lng,
    targets: ['IL','US','GB','FR','DE'], era: '2023-present', active: true,
    platforms: 'X, TikTok, Telegram, Instagram',
    confidence: 'high', scale: 'large',
    description: 'Surge of coordinated Iran-attributed amplification of anti-Israel narratives post-Oct 7 2023. Includes manufactured Gaza-civilian content + crisis-actor allegations.',
    sources: 'ISD Global, Stanford SIO, Meta Q4-2023 + 2024 ATRs' },

  // ── North Korea ──
  { name: 'Kimsuky-adjacent IO', operator: 'KP', operator_bloc: 'NK',
    operator_lat: C.KP.lat, operator_lng: C.KP.lng,
    targets: ['KR','JP','US'], era: '2017-present', active: true,
    platforms: 'Spearphishing + fake personas on X/LinkedIn, mostly intel collection',
    confidence: 'high', scale: 'small',
    description: 'North Korean IO is mostly cyber-collection (Kimsuky/Lazarus) but increasingly poses as Western academics + analysts to shape Korea-policy narratives in DC + Seoul.',
    sources: 'Mandiant, AhnLab, KISA' },

  // ── Israel ──
  { name: 'STOIC / Tel Aviv 2024', operator: 'IL', operator_bloc: 'Israel',
    operator_lat: C.IL.lat, operator_lng: C.IL.lng,
    targets: ['US','CA','GB','FR'], era: '2024', active: false,
    platforms: 'X, ChatGPT-generated comments, fake activist sites',
    confidence: 'high', scale: 'medium',
    description: 'Meta + OpenAI removed in May 2024 an Israeli commercial influence-for-hire op (STOIC) targeting US lawmakers + universities with pro-Israel framing post-Oct 7.',
    sources: 'Meta May 2024 ATR, OpenAI threat report May 2024' },

  // ── Other / Commercial ──
  { name: 'Team Jorge (PSY-Group successor)', operator: 'IL', operator_bloc: 'Israel',
    operator_lat: C.IL.lat, operator_lng: C.IL.lng,
    targets: ['MX','CO','VE','NG','KE','EU'], era: '2015-present', active: true,
    platforms: 'AIMS bot network, fake personas, election ops-for-hire',
    confidence: 'high', scale: 'medium',
    description: 'Forbidden Stories / The Guardian Feb 2023 exposé. Israeli private-sector election-manipulation outfit hired across 30+ elections. Tal Hanan lead.',
    sources: 'Forbidden Stories "Story Killers" Feb 2023, Le Monde, El Pais' },
  { name: 'AK Trolls', operator: 'TR', operator_bloc: 'Turkey',
    operator_lat: C.TR.lat, operator_lng: C.TR.lng,
    targets: ['TR','SY','GR','AM','EU'], era: '2013-present', active: true,
    platforms: 'X, TikTok, Facebook',
    confidence: 'high', scale: 'large',
    description: 'AKP-aligned partisan amplification network. Combines paid trolls + bot networks; active during elections + Kurdish-conflict episodes + Greek/Armenian-tensions cycles.',
    sources: 'Stanford SIO, DFRLab, Reporters Without Borders' },
  { name: 'Saudi twitter farms (Qahtani-era)', operator: 'SA', operator_bloc: 'Saudi',
    operator_lat: C.SA.lat, operator_lng: C.SA.lng,
    targets: ['SA','QA','IR','YE','TR'], era: '2017-present', active: true,
    platforms: 'X, Snapchat, infiltrated journalists',
    confidence: 'high', scale: 'large',
    description: 'Royal-court-coordinated trolling against Khashoggi + critics + Qatar (during the 2017-21 blockade) + Yemen war narrative. Saud al-Qahtani sanctioned 2019.',
    sources: 'Stanford SIO, NYT, Citizen Lab' },
  { name: 'Indian "TekFog" allegations', operator: 'IN', operator_bloc: 'India',
    operator_lat: C.IN.lat, operator_lng: C.IN.lng,
    targets: ['IN'], era: '2014-present', active: true,
    platforms: 'WhatsApp groups, X, Sharechat, Facebook',
    confidence: 'medium', scale: 'large',
    description: 'BJP IT cell-attributed app reported by The Wire 2022. Contested and the original whistle-blower has since recanted; the broader phenomenon of partisan IO networks in Indian elections remains well-documented.',
    sources: 'The Wire 2022 (contested), Wall Street Journal, DFRLab' },
  { name: 'Project Raven (UAE)', operator: 'AE', operator_bloc: 'UAE',
    operator_lat: C.AE.lat, operator_lng: C.AE.lng,
    targets: ['QA','IR','YE','TR'], era: '2016-2020', active: false,
    platforms: 'Surveillance + targeted personas, less mass-IO',
    confidence: 'high', scale: 'small',
    description: 'Reuters 2019 exposé. UAE state-employed ex-NSA contractors conducted surveillance + targeted IO against Gulf rivals. Mostly cyber but with IO elements.',
    sources: 'Reuters Lori Stroud reporting 2019' },

  // ── US/UK (overt / acknowledged historical) ──
  { name: 'JTRIG (GCHQ)', operator: 'GB', operator_bloc: 'UK',
    operator_lat: 51.90, operator_lng: -2.12,  // GCHQ Cheltenham
    targets: ['IR','GB','RU'], era: '2010-2014 known', active: false,
    platforms: 'Multiple covert online ops disclosed in Snowden documents',
    confidence: 'high', scale: 'medium',
    description: 'GCHQ Joint Threat Research Intelligence Group. Snowden 2014 disclosures detailed JTRIG\'s online deception + amplification ops. Current capabilities undisclosed but presumed evolved.',
    sources: 'Snowden documents 2014, The Intercept' },
  { name: 'CENTCOM Sock-puppet Network', operator: 'US', operator_bloc: 'US',
    operator_lat: 27.85, operator_lng: -82.50,  // MacDill AFB, Tampa
    targets: ['IR','RU','CN','AF','PK'], era: '2017-2022', active: false,
    platforms: 'X, Facebook, Instagram (Persian/Arabic/Russian language)',
    confidence: 'high', scale: 'medium',
    description: 'Graphika + Stanford 2022 exposé revealed a US military covert online IO program targeting Middle East + Central Asia. DoD initiated review; Pentagon Aug 2022 pause-and-review.',
    sources: 'Graphika "Unheard Voice" Aug 2022, Stanford Internet Observatory' },
];

export async function GET() {
  // Annotate each op with arc endpoints — for the map line-rendering layer.
  const operations = OPS.map(op => {
    const arcs = op.targets
      .map(iso => ({ iso, ...(C as any)[iso] }))
      .filter(t => Number.isFinite(t.lat))
      .map(t => ({ iso: t.iso, lat: t.lat, lng: t.lng }));
    return { ...op, arcs };
  });

  // Group ops per operator country for the marker layer (one dot per operator)
  // so the map doesn't stack ~10 Russian markers on Moscow.
  const byOperator = new Map<string, any>();
  for (const op of operations) {
    const key = `${op.operator}|${op.operator_lat.toFixed(2)}|${op.operator_lng.toFixed(2)}`;
    if (!byOperator.has(key)) {
      byOperator.set(key, {
        operator: op.operator, operator_bloc: op.operator_bloc,
        lat: op.operator_lat, lng: op.operator_lng,
        ops: [], active_count: 0, total_count: 0,
        all_targets: new Set<string>(),
      });
    }
    const grp = byOperator.get(key);
    grp.ops.push(op);
    grp.total_count++;
    if (op.active) grp.active_count++;
    op.targets.forEach((t: string) => grp.all_targets.add(t));
  }
  const operators = [...byOperator.values()].map(g => ({
    ...g,
    all_targets: [...g.all_targets],
  }));

  const byBloc: Record<string, number> = {};
  for (const op of OPS) byBloc[op.operator_bloc] = (byBloc[op.operator_bloc] || 0) + 1;

  return NextResponse.json({
    operations,
    operators,
    total: OPS.length,
    by_bloc: byBloc,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
