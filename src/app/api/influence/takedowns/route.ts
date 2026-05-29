import { NextResponse } from 'next/server';

/**
 * OSIRIS — Platform Takedowns (Coordinated Inauthentic Behavior)
 *
 * Curated time-series of major IO takedown actions reported by Meta, X,
 * Google/YouTube, TikTok, and OpenAI in their public threat / transparency
 * reports 2022-2025.
 *
 * Each entry is one takedown action — date + platform + operator country +
 * target(s) + assets removed. Aggregated per operator country at the marker
 * layer; popup lists individual events with source citation.
 *
 * Asset counts come from the public reports verbatim. "Linked campaign"
 * cross-references the named ops in /api/influence/campaigns where possible.
 */

type Platform = 'Meta' | 'X' | 'YouTube' | 'TikTok' | 'OpenAI' | 'Microsoft';
type Bloc = 'Russia' | 'China' | 'Iran' | 'NK' | 'Israel' | 'Turkey' | 'Saudi' | 'UAE' | 'India' | 'US' | 'Other';

interface Event {
  date: string;            // ISO YYYY-MM
  platform: Platform;
  operator: string;        // ISO
  operator_bloc: Bloc;
  operator_lat: number;
  operator_lng: number;
  targets: string[];       // ISO
  assets: number;          // aggregate accounts/pages/groups removed
  campaign: string | null; // link to named campaign if applicable
  description: string;
  source_url: string;
}

const EVENTS: Event[] = [
  // 2025
  { date: '2025-Q1', platform: 'Meta', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['UA','DE','FR','PL'], assets: 2390,
    campaign: 'Doppelganger', description: 'Doppelganger network removal: Facebook accounts + Pages + Instagram accounts linked to fake European media clones.',
    source_url: 'https://about.fb.com/news/2025/05/adversarial-threat-report-q1-2025/' },
  { date: '2025-Q1', platform: 'Meta', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','TW','GB'], assets: 815,
    campaign: 'Spamouflage Dragon', description: 'Spamouflage cluster targeting US 2024 election aftermath narratives + Taiwan.',
    source_url: 'https://about.fb.com/news/2025/05/adversarial-threat-report-q1-2025/' },
  { date: '2025-Q1', platform: 'OpenAI', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: 35.69, operator_lng: 51.39,
    targets: ['IL','US'], assets: 90,
    campaign: 'Storm-2035', description: 'OpenAI banned ChatGPT accounts being used to generate Iranian IO content on Gaza + US politics.',
    source_url: 'https://openai.com/global-affairs/disrupting-malicious-uses-of-ai/' },
  { date: '2024-Q4', platform: 'Meta', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['DE','FR','IT','UA','EU'], assets: 1450,
    campaign: 'Doppelganger', description: 'Persistent removal of Doppelganger Facebook accounts amplifying anti-Ukraine framing in EU.',
    source_url: 'https://about.fb.com/news/2025/02/adversarial-threat-report-q4-2024/' },
  { date: '2024-Q4', platform: 'Meta', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['IN','TW','GB','US'], assets: 95,
    campaign: 'Spamouflage Dragon',
    description: 'Spamouflage cluster targeting Indian elections + Taiwan + Western critics.',
    source_url: 'https://about.fb.com/news/2025/02/adversarial-threat-report-q4-2024/' },
  { date: '2024-Q4', platform: 'OpenAI', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','TW'], assets: 60,
    campaign: 'HaiEnergy / Storm-1376',
    description: 'OpenAI disrupted Chinese-language ChatGPT use generating multilingual disinformation comments.',
    source_url: 'https://openai.com/global-affairs/disrupting-malicious-uses-of-ai/' },
  { date: '2024-Q3', platform: 'Meta', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: 35.69, operator_lng: 51.39,
    targets: ['IL','US','GB'], assets: 510,
    campaign: 'October 7 aftermath IO',
    description: 'Removed Facebook + Instagram accounts amplifying Iranian narratives on Gaza + US 2024 election.',
    source_url: 'https://about.fb.com/news/2024/11/adversarial-threat-report-q3-2024/' },
  { date: '2024-Q2', platform: 'Meta', operator: 'IL', operator_bloc: 'Israel',
    operator_lat: 31.78, operator_lng: 35.22,
    targets: ['US','CA','GB'], assets: 510,
    campaign: 'STOIC / Tel Aviv 2024',
    description: 'Removed Israeli commercial influence-for-hire network (STOIC) targeting US legislators + university protests with pro-Israel framing.',
    source_url: 'https://about.fb.com/news/2024/05/adversarial-threat-report-q1-2024/' },
  { date: '2024-Q2', platform: 'OpenAI', operator: 'IL', operator_bloc: 'Israel',
    operator_lat: 31.78, operator_lng: 35.22,
    targets: ['US','CA','GB'], assets: 5,
    campaign: 'STOIC / Tel Aviv 2024',
    description: 'OpenAI disrupted same STOIC network using ChatGPT to generate fake comments + articles in English.',
    source_url: 'https://openai.com/global-affairs/disrupting-malicious-uses-of-ai/' },
  { date: '2024-Q2', platform: 'Meta', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['UA','DE','PL','FR'], assets: 240,
    campaign: 'Doppelganger', description: 'Rolling Doppelganger removals; Meta notes the operation continues despite repeated takedowns.',
    source_url: 'https://about.fb.com/news/2024/05/adversarial-threat-report-q1-2024/' },
  { date: '2024-Q1', platform: 'Meta', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','GB','FR'], assets: 4789,
    campaign: 'PAPERWALL',
    description: 'Removed largest single Chinese IO cluster to date — fake local-news + influencer assets exposed by Citizen Lab.',
    source_url: 'https://about.fb.com/news/2024/02/adversarial-threat-report-q4-2023/' },
  { date: '2024-Q1', platform: 'Meta', operator: 'TR', operator_bloc: 'Turkey',
    operator_lat: 39.93, operator_lng: 32.86,
    targets: ['TR','EU','AM'], assets: 250,
    campaign: 'AK Trolls',
    description: 'AKP-aligned partisan amplification accounts removed ahead of Turkish local elections.',
    source_url: 'https://about.fb.com/news/2024/02/adversarial-threat-report-q4-2023/' },
  { date: '2023-Q4', platform: 'Meta', operator: 'IR', operator_bloc: 'Iran',
    operator_lat: 35.69, operator_lng: 51.39,
    targets: ['IL','US','EU'], assets: 850,
    campaign: 'October 7 aftermath IO',
    description: 'Post-Oct-7 surge: removed Iranian Facebook + Instagram accounts pushing anti-Israel + pro-Hamas content.',
    source_url: 'https://about.fb.com/news/2024/02/adversarial-threat-report-q4-2023/' },
  { date: '2023-Q3', platform: 'Meta', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','GB','AU','TW'], assets: 7704,
    campaign: 'Spamouflage Dragon',
    description: 'Single largest Spamouflage takedown ever — 7,704 Facebook accounts + 954 Pages + 15 Groups.',
    source_url: 'https://about.fb.com/news/2023/08/raising-online-defenses-through-transparency-and-collaboration/' },
  { date: '2023-Q3', platform: 'Meta', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['DE','UA','FR','IT'], assets: 1090,
    campaign: 'Doppelganger',
    description: 'Cumulative Doppelganger removal across Meta\'s ATR Q2 2023 reporting period.',
    source_url: 'https://about.fb.com/news/2023/08/raising-online-defenses-through-transparency-and-collaboration/' },
  { date: '2023-Q3', platform: 'Meta', operator: 'US', operator_bloc: 'US',
    operator_lat: 27.85, operator_lng: -82.50,  // MacDill AFB
    targets: ['IR','RU','CN','AF'], assets: 39,
    campaign: 'CENTCOM Sock-puppet Network',
    description: 'Removed accounts linked to a US covert online IO program (Graphika "Unheard Voice" exposé).',
    source_url: 'https://about.fb.com/news/2022/11/metas-adversarial-threat-report-q3-2022/' },
  { date: '2022-Q4', platform: 'Meta', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','GB','TW'], assets: 800,
    campaign: 'Spamouflage Dragon',
    description: 'First major US-targeting Chinese cluster: Spamouflage operators focusing on US 2022 midterms.',
    source_url: 'https://about.fb.com/news/2022/09/removing-coordinated-inauthentic-behavior-from-china-and-russia/' },
  { date: '2022-Q3', platform: 'Meta', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['DE','FR','IT','UA','GB'], assets: 1633,
    campaign: 'Doppelganger',
    description: 'First major Doppelganger takedown after the Aug 2022 EU DisinfoLab exposé.',
    source_url: 'https://about.fb.com/news/2022/09/removing-coordinated-inauthentic-behavior-from-china-and-russia/' },
  { date: '2022-Q3', platform: 'YouTube', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['UA','DE','EU'], assets: 9000,
    campaign: 'Internet Research Agency (IRA)',
    description: 'YouTube blocked 9000+ Russian channels after invasion. Reported in Google quarterly threat update.',
    source_url: 'https://blog.google/threat-analysis-group/tag-bulletin-q2-2022/' },
  { date: '2022-Q1', platform: 'Meta', operator: 'BY', operator_bloc: 'Russia',
    operator_lat: 53.90, operator_lng: 27.57,
    targets: ['LT','LV','PL','UA'], assets: 40,
    campaign: 'Ghostwriter / UNC1151',
    description: 'Ghostwriter / UNC1151 accounts targeting Baltic + Polish elites with anti-Ukraine messaging.',
    source_url: 'https://about.fb.com/news/2022/04/metas-adversarial-threat-report-q1-2022/' },
  { date: '2023-Q2', platform: 'X', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','TW','HK'], assets: 32000,
    campaign: 'Spamouflage Dragon',
    description: 'X (Twitter) batch removal of Chinese state-linked accounts (last public transparency batch before X discontinued the disclosure series).',
    source_url: 'https://transparency.twitter.com/en/reports/information-operations.html' },
  { date: '2024-Q3', platform: 'YouTube', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['US','TW'], assets: 5600,
    campaign: 'Spamouflage Dragon',
    description: 'YouTube terminated 5600+ channels coordinated with Spamouflage across Q3 2024.',
    source_url: 'https://blog.google/threat-analysis-group/tag-bulletin-q3-2024/' },
  { date: '2024-Q4', platform: 'TikTok', operator: 'CN', operator_bloc: 'China',
    operator_lat: 39.91, operator_lng: 116.40,
    targets: ['RO','MD','EU'], assets: 27000,
    campaign: null,
    description: 'TikTok removed 27,000+ accounts behind a coordinated Romanian election influence campaign — election was later annulled.',
    source_url: 'https://newsroom.tiktok.com/en-us/' },
  { date: '2024-Q4', platform: 'Meta', operator: 'MD', operator_bloc: 'Russia',
    operator_lat: 47.00, operator_lng: 28.50,
    targets: ['MD','RO'], assets: 1200,
    campaign: null,
    description: 'Moldova-hosted, Russian-linked accounts targeting Moldovan + Romanian elections.',
    source_url: 'https://about.fb.com/news/2025/02/adversarial-threat-report-q4-2024/' },
  { date: '2025-Q1', platform: 'TikTok', operator: 'RU', operator_bloc: 'Russia',
    operator_lat: 55.75, operator_lng: 37.62,
    targets: ['UA','PL','DE'], assets: 4800,
    campaign: 'Storm-1516',
    description: 'TikTok removed network of accounts pushing fabricated Ukraine-war footage + anti-Zelensky claims.',
    source_url: 'https://newsroom.tiktok.com/en-us/' },
];

type Bucket = {
  operator: string;
  operator_bloc: Bloc;
  lat: number;
  lng: number;
  total_assets: number;
  event_count: number;
  recent_date: string;
  recent_days_ago: number;
  by_platform: Record<string, number>;
  by_target: Record<string, number>;
  events: Event[];
};

export async function GET() {
  const now = Date.now();
  const dayMs = 86400000;
  // Aggregate per operator country
  const byOperator = new Map<string, Bucket>();
  for (const ev of EVENTS) {
    const key = `${ev.operator}|${ev.operator_lat.toFixed(2)}|${ev.operator_lng.toFixed(2)}`;
    if (!byOperator.has(key)) {
      byOperator.set(key, {
        operator: ev.operator, operator_bloc: ev.operator_bloc,
        lat: ev.operator_lat, lng: ev.operator_lng,
        total_assets: 0, event_count: 0,
        recent_date: ev.date, recent_days_ago: 99999,
        by_platform: {}, by_target: {}, events: [],
      });
    }
    const b = byOperator.get(key)!;
    b.total_assets += ev.assets;
    b.event_count++;
    b.events.push(ev);
    b.by_platform[ev.platform] = (b.by_platform[ev.platform] || 0) + ev.assets;
    for (const t of ev.targets) b.by_target[t] = (b.by_target[t] || 0) + 1;
    // Convert "2024-Q4" to approximate date (mid-quarter)
    const m = ev.date.match(/^(\d{4})-Q([1-4])$/);
    if (m) {
      const y = parseInt(m[1]); const q = parseInt(m[2]);
      const dt = new Date(Date.UTC(y, (q - 1) * 3 + 1, 15)).getTime();
      const days = Math.floor((now - dt) / dayMs);
      if (days < b.recent_days_ago) {
        b.recent_days_ago = days;
        b.recent_date = ev.date;
      }
    }
    b.events.sort((a, c) => c.date.localeCompare(a.date));
  }
  const buckets = [...byOperator.values()].sort((a, b) => b.total_assets - a.total_assets);

  const totalEvents = EVENTS.length;
  const totalAssets = EVENTS.reduce((a, e) => a + e.assets, 0);
  const byBloc: Record<string, number> = {};
  for (const e of EVENTS) byBloc[e.operator_bloc] = (byBloc[e.operator_bloc] || 0) + 1;

  return NextResponse.json({
    operators: buckets,
    total_events: totalEvents,
    total_assets: totalAssets,
    by_bloc: byBloc,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
