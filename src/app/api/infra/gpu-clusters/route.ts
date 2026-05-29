import { NextResponse } from 'next/server';

/**
 * OSIRIS — Frontier GPU Clusters
 *
 * Curated dataset of the world's largest disclosed GPU clusters — the
 * physical sites where frontier AI training actually happens. Distinct from
 * general data centers: these are purpose-built H100/H200/B200/TPU/Trainium
 * fleets at 50MW-1000MW+ each, where ~$1B+ worth of accelerators sit.
 *
 * Sources: SemiAnalysis quarterly cluster reports, company press releases,
 * SEC 10-K / 10-Q filings, Stargate joint-venture disclosures, Bloomberg
 * + The Information reporting, NVIDIA quarterly investor calls, regional
 * grid-operator interconnect filings.
 *
 *   chips        marquee accelerator model deployed at scale
 *   chip_count   estimated number deployed (often a rough public estimate)
 *   power_mw     IT-load megawatts
 *   workload     primary training workload
 *   status       operating | construction | planned
 */

type ChipFamily = 'H100' | 'H200' | 'H800' | 'B200' | 'GB200' | 'GB300' | 'A100' | 'TPU' | 'Trainium' | 'MTIA' | 'Dojo' | 'mixed';
type ClusterStatus = 'operating' | 'construction' | 'planned';
type Operator = 'OpenAI' | 'Microsoft' | 'Google' | 'Meta' | 'xAI' | 'Anthropic' | 'AWS' | 'Oracle' | 'Tesla' | 'CoreWeave' | 'ByteDance' | 'Alibaba' | 'Baidu' | 'Tencent' | 'G42' | 'Apple' | 'Other';

interface Cluster {
  name: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  operator: Operator;
  partner: string | null;
  chips: ChipFamily;
  chip_count: number;          // approximate; 0 if undisclosed
  power_mw: number;
  status: ClusterStatus;
  workload: string;
  announced: string;           // ISO month or year
  notes: string;
}

const CLUSTERS: Cluster[] = [
  // ─── xAI ───
  { name: 'Colossus 1', city: 'Memphis, TN', country: 'US', region: 'North America',
    lat: 35.13, lng: -89.97, operator: 'xAI', partner: null, chips: 'H100', chip_count: 100000, power_mw: 150,
    status: 'operating', workload: 'Grok 3 + ongoing pretraining', announced: '2024-09',
    notes: 'Built in ~122 days at the old Electrolux site. Fed partly by adjacent gas turbines + grid; power-supply controversy with TVA + neighbouring residents.' },
  { name: 'Colossus 2', city: 'Memphis, TN', country: 'US', region: 'North America',
    lat: 35.13, lng: -89.97, operator: 'xAI', partner: null, chips: 'H200', chip_count: 200000, power_mw: 300,
    status: 'construction', workload: 'Grok 4 + post-training',
    announced: '2024-12',
    notes: 'Doubling Colossus 1 capacity. Targeting first power Q2 2025; mix of H200s + B200s expected.' },

  // ─── OpenAI / Microsoft ───
  { name: 'Stargate Abilene (Site 1)', city: 'Abilene, TX', country: 'US', region: 'North America',
    lat: 32.45, lng: -99.73, operator: 'OpenAI', partner: 'Oracle + SoftBank',
    chips: 'GB200', chip_count: 64000, power_mw: 1200,
    status: 'construction', workload: 'GPT-5 + GPT-6 training', announced: '2025-01',
    notes: 'First $100B Stargate site. Initial 1.2GW phase. Full campus targeting 5GW eventual. Oracle operates the steel + chips.' },
  { name: 'Stargate UAE', city: 'Abu Dhabi', country: 'AE', region: 'Middle East',
    lat: 24.47, lng: 54.37, operator: 'OpenAI', partner: 'G42 + Oracle + SoftBank',
    chips: 'GB200', chip_count: 0, power_mw: 1000,
    status: 'planned', workload: 'sovereign-AI + OpenAI training',
    announced: '2025-05',
    notes: 'First international Stargate site. Pairs with G42\'s Khazna AI Campus.' },
  { name: 'Azure Mt. Pleasant (Wisconsin)', city: 'Mt. Pleasant, WI', country: 'US', region: 'North America',
    lat: 42.72, lng: -87.79, operator: 'Microsoft', partner: 'OpenAI',
    chips: 'GB200', chip_count: 0, power_mw: 900,
    status: 'construction', workload: 'OpenAI + Microsoft Copilot inference + training',
    announced: '2024-05',
    notes: 'Resurrects the abandoned Foxconn LCD-factory site. $3.3B Microsoft investment. Was originally going to be an LCD plant.' },
  { name: 'Azure Goodyear (Phoenix)', city: 'Goodyear, AZ', country: 'US', region: 'North America',
    lat: 33.43, lng: -112.36, operator: 'Microsoft', partner: 'OpenAI',
    chips: 'H100', chip_count: 0, power_mw: 750,
    status: 'operating', workload: 'OpenAI GPT-4/4o training',
    announced: '2023',
    notes: 'Where GPT-4 was reportedly trained. Major water-use controversy (~50M gallons/day cooling at peak).' },
  { name: 'Azure Atlanta', city: 'Atlanta, GA', country: 'US', region: 'North America',
    lat: 33.75, lng: -84.39, operator: 'Microsoft', partner: 'OpenAI',
    chips: 'GB200', chip_count: 0, power_mw: 500,
    status: 'construction', workload: 'OpenAI training + Azure inference',
    announced: '2024',
    notes: 'Atlanta is becoming Microsoft\'s SE US AI hub; co-located with the Atlanta Tech Village ecosystem.' },

  // ─── Google ───
  { name: 'Google TPU Pod (Council Bluffs)', city: 'Council Bluffs, IA', country: 'US', region: 'North America',
    lat: 41.26, lng: -95.86, operator: 'Google', partner: null,
    chips: 'TPU', chip_count: 0, power_mw: 600,
    status: 'operating', workload: 'Gemini training',
    announced: '2024',
    notes: 'Google\'s largest TPU pod — v5p + Trillium (v6) chips. Same campus as us-central1 cloud region.' },
  { name: 'Google TPU Pod (Pryor, OK)', city: 'Pryor, OK', country: 'US', region: 'North America',
    lat: 36.31, lng: -95.32, operator: 'Google', partner: null,
    chips: 'TPU', chip_count: 0, power_mw: 400,
    status: 'operating', workload: 'Gemini training + DeepMind workloads',
    announced: '2023',
    notes: 'MidAmerica Industrial Park. Google\'s major Oklahoma TPU farm.' },
  { name: 'Google TPU Pod (St. Ghislain)', city: 'St. Ghislain', country: 'BE', region: 'Europe',
    lat: 50.45, lng: 3.82, operator: 'Google', partner: null,
    chips: 'TPU', chip_count: 0, power_mw: 250,
    status: 'operating', workload: 'European-region Gemini inference + training',
    announced: '2022',
    notes: 'Google\'s flagship European DC. Uses canal-water cooling.' },

  // ─── Meta ───
  { name: 'Meta Newton Hyperion', city: 'Newton, GA', country: 'US', region: 'North America',
    lat: 33.51, lng: -83.82, operator: 'Meta', partner: null,
    chips: 'H100', chip_count: 0, power_mw: 1000,
    status: 'construction', workload: 'Llama 4 + Llama 5 training',
    announced: '2024-10',
    notes: 'Meta\'s flagship "Hyperion" project — multi-GW campus. $10B+ investment over decade.' },
  { name: 'Meta Eagle Mountain', city: 'Eagle Mountain, UT', country: 'US', region: 'North America',
    lat: 40.32, lng: -112.01, operator: 'Meta', partner: null,
    chips: 'H100', chip_count: 24576, power_mw: 250,
    status: 'operating', workload: 'Llama 3 training (one of two clusters used)',
    announced: '2024-03',
    notes: 'One of two 24,576-H100 clusters Meta disclosed in their Llama 3 paper. The second is at Newton.' },
  { name: 'Meta Newton (Llama 3 Cluster 2)', city: 'Newton, GA', country: 'US', region: 'North America',
    lat: 33.51, lng: -83.82, operator: 'Meta', partner: null,
    chips: 'H100', chip_count: 24576, power_mw: 250,
    status: 'operating', workload: 'Llama 3 training (second of two clusters)',
    announced: '2024-03',
    notes: 'Second Llama 3 cluster. Meta\'s total H100 fleet was 350k by end-2024, targeting 600k+ in 2025.' },
  { name: 'Meta Richland Parish', city: 'Richland Parish, LA', country: 'US', region: 'North America',
    lat: 32.55, lng: -91.71, operator: 'Meta', partner: null,
    chips: 'B200', chip_count: 0, power_mw: 2000,
    status: 'planned', workload: 'Meta MTIA + frontier training (post-Llama 5)',
    announced: '2024-12',
    notes: 'Planned 4-million-sq-ft DC. Powered by 2.3GW of new natural-gas turbines. $10B project.' },

  // ─── Anthropic ───
  { name: 'Anthropic Project Rainier (multiple AWS sites)', city: 'New Albany, IN', country: 'US', region: 'North America',
    lat: 38.28, lng: -85.82, operator: 'Anthropic', partner: 'AWS',
    chips: 'Trainium', chip_count: 400000, power_mw: 600,
    status: 'construction', workload: 'Claude 5 + frontier training',
    announced: '2024-11',
    notes: 'AWS Trainium2-based — first frontier-lab cluster not built on NVIDIA. 5× scale of previous Anthropic clusters. New Albany IN first site.' },

  // ─── Tesla ───
  { name: 'Tesla Cortex (Giga Texas)', city: 'Austin, TX', country: 'US', region: 'North America',
    lat: 30.22, lng: -97.62, operator: 'Tesla', partner: null,
    chips: 'H100', chip_count: 50000, power_mw: 130,
    status: 'operating', workload: 'FSD (Full Self-Driving) v13 training',
    announced: '2024',
    notes: 'Adjacent to Tesla\'s Austin gigafactory. Used for Optimus + FSD training. Tesla has both NVIDIA H100s + their own Dojo chips here.' },
  { name: 'Tesla Dojo (Buffalo)', city: 'Buffalo, NY', country: 'US', region: 'North America',
    lat: 42.89, lng: -78.88, operator: 'Tesla', partner: null,
    chips: 'Dojo', chip_count: 0, power_mw: 100,
    status: 'operating', workload: 'FSD video training (Dojo-only workloads)',
    announced: '2023',
    notes: 'Tesla\'s in-house D1-chip supercomputer. Used Tesla\'s former solar plant. Dojo program partially paused as Tesla leaned harder on NVIDIA H100s 2024+.' },

  // ─── Cloud GPU providers (Neocloud) ───
  { name: 'CoreWeave Plano (TX)', city: 'Plano, TX', country: 'US', region: 'North America',
    lat: 33.02, lng: -96.70, operator: 'CoreWeave', partner: null,
    chips: 'H100', chip_count: 0, power_mw: 300,
    status: 'operating', workload: 'GPU-as-a-Service (Microsoft + OpenAI customers)',
    announced: '2024',
    notes: 'CoreWeave\'s largest TX site. Microsoft contracted ~$10B in CoreWeave capacity 2023-24 to backstop OpenAI demand.' },
  { name: 'CoreWeave Newark', city: 'Kearny, NJ', country: 'US', region: 'North America',
    lat: 40.77, lng: -74.16, operator: 'CoreWeave', partner: null,
    chips: 'H100', chip_count: 0, power_mw: 200,
    status: 'operating', workload: 'GPU-as-a-Service for NE US enterprises',
    announced: '2023',
    notes: 'Old crypto-mining facility converted to GPU cloud. Low-latency for NYC financial customers.' },
  { name: 'Lambda Labs (Bay Area + AZ)', city: 'Mesa, AZ', country: 'US', region: 'North America',
    lat: 33.42, lng: -111.83, operator: 'Other', partner: 'Lambda',
    chips: 'H100', chip_count: 0, power_mw: 75,
    status: 'operating', workload: 'GPU-as-a-Service (startup-focused)',
    announced: '2024',
    notes: 'Lambda is one of the larger "neoclouds" — H100/H200 capacity for AI-startup customers.' },
  { name: 'Crusoe Iceland (Reykjanes)', city: 'Reykjanes', country: 'IS', region: 'Europe',
    lat: 63.91, lng: -22.71, operator: 'Other', partner: 'Crusoe',
    chips: 'H100', chip_count: 0, power_mw: 100,
    status: 'operating', workload: 'AI training (geothermal-powered)',
    announced: '2024',
    notes: 'Crusoe\'s geothermal-cooled site. 100% renewable energy via Iceland\'s grid.' },
  { name: 'Crusoe Abilene (TX)', city: 'Abilene, TX', country: 'US', region: 'North America',
    lat: 32.45, lng: -99.73, operator: 'Other', partner: 'Crusoe',
    chips: 'GB200', chip_count: 0, power_mw: 200,
    status: 'construction', workload: 'AI training (gas-flare-powered → grid mix)',
    announced: '2024',
    notes: 'Originally gas-flare-powered. Crusoe was selected as Stargate Abilene\'s primary contractor.' },

  // ─── China ───
  { name: 'ByteDance Wuhan AI Cluster', city: 'Wuhan', country: 'CN', region: 'Asia-Pacific',
    lat: 30.59, lng: 114.31, operator: 'ByteDance', partner: null,
    chips: 'A100', chip_count: 0, power_mw: 300,
    status: 'operating', workload: 'Doubao LLM + TikTok recommendation training',
    announced: '2023',
    notes: 'ByteDance has reportedly stockpiled ~200K A100/H100s pre-export-controls. Wuhan cluster is one of the largest disclosed.' },
  { name: 'ByteDance Johor (Malaysia)', city: 'Johor', country: 'MY', region: 'Asia-Pacific',
    lat: 1.49, lng: 103.76, operator: 'ByteDance', partner: null,
    chips: 'H100', chip_count: 0, power_mw: 200,
    status: 'construction', workload: 'TikTok inference + Doubao training',
    announced: '2024',
    notes: 'ByteDance + Alibaba + many Chinese firms are building Johor capacity to bypass US export controls — Malaysia gets H100s, ships compute to China.' },
  { name: 'Alibaba Cloud Zhangbei AI Cluster', city: 'Zhangbei', country: 'CN', region: 'Asia-Pacific',
    lat: 41.16, lng: 114.71, operator: 'Alibaba', partner: null,
    chips: 'H800', chip_count: 0, power_mw: 200,
    status: 'operating', workload: 'Qwen models + Alibaba Cloud GPU customers',
    announced: '2024',
    notes: 'H800 (China-export-control-modified H100). Hebei province; cold climate.' },
  { name: 'Baidu Yangquan', city: 'Yangquan, Shanxi', country: 'CN', region: 'Asia-Pacific',
    lat: 37.86, lng: 113.58, operator: 'Baidu', partner: null,
    chips: 'mixed', chip_count: 0, power_mw: 150,
    status: 'operating', workload: 'ERNIE / Wenxin LLM training',
    announced: '2023',
    notes: 'Baidu\'s flagship AI cluster. Mix of H800s + domestic Huawei Ascend chips.' },
  { name: 'Tencent Cloud Tianjin AI', city: 'Tianjin', country: 'CN', region: 'Asia-Pacific',
    lat: 39.13, lng: 117.20, operator: 'Tencent', partner: null,
    chips: 'mixed', chip_count: 0, power_mw: 120,
    status: 'operating', workload: 'Hunyuan LLM + gaming AI',
    announced: '2024',
    notes: 'Tencent + Alibaba both turning to domestic Huawei Ascend 910C as US controls tightened 2024.' },

  // ─── Other notable ───
  { name: 'Apple AI Compute (Reno + NC)', city: 'Reno, NV', country: 'US', region: 'North America',
    lat: 39.53, lng: -119.81, operator: 'Apple', partner: null,
    chips: 'mixed', chip_count: 0, power_mw: 200,
    status: 'operating', workload: 'Apple Intelligence training + PCC (Private Cloud Compute)',
    announced: '2024',
    notes: 'Apple\'s in-house compute for Apple Intelligence. Heavy investment in Apple Silicon servers — first major hyperscaler to use ARM at scale for AI inference.' },
  { name: 'AWS Trainium2 (Austin)', city: 'Austin, TX', country: 'US', region: 'North America',
    lat: 30.27, lng: -97.74, operator: 'AWS', partner: 'Anthropic',
    chips: 'Trainium', chip_count: 0, power_mw: 400,
    status: 'operating', workload: 'Anthropic Claude training (Project Rainier I)',
    announced: '2024',
    notes: 'AWS\'s flagship Trainium2 cluster. Sits inside US-East-2 region. First major non-NVIDIA frontier-AI training site.' },
  { name: 'Tencent Cloud HK (Sovereign)', city: 'Hong Kong', country: 'HK', region: 'Asia-Pacific',
    lat: 22.31, lng: 114.17, operator: 'Tencent', partner: null,
    chips: 'H100', chip_count: 0, power_mw: 80,
    status: 'operating', workload: 'Non-mainland inference + sovereign workloads',
    announced: '2024',
    notes: 'HK still loophole region for some Chinese firms accessing NVIDIA chips without mainland export-control friction.' },
];

export async function GET() {
  const total_chips = CLUSTERS.reduce((a, c) => a + c.chip_count, 0);
  const total_mw = CLUSTERS.reduce((a, c) => a + c.power_mw, 0);
  const byOperator: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byChip: Record<string, number> = {};
  for (const c of CLUSTERS) {
    byOperator[c.operator] = (byOperator[c.operator] || 0) + 1;
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byChip[c.chips] = (byChip[c.chips] || 0) + 1;
  }
  const maxMw = CLUSTERS.reduce((m, c) => Math.max(m, c.power_mw), 0) || 1;
  const clusters = CLUSTERS.map(c => ({
    ...c,
    intensity: Math.min(1, Math.sqrt(c.power_mw / maxMw)),
  }));
  return NextResponse.json({
    clusters, total: CLUSTERS.length, total_chips, total_mw,
    by_operator: byOperator, by_status: byStatus, by_chip: byChip,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' }});
}
