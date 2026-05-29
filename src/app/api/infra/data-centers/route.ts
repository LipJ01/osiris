import { NextResponse } from 'next/server';

/**
 * OSIRIS — Data Centers & IXPs
 *
 * Curated dataset of the world's largest hyperscale cloud regions
 * (AWS / Azure / GCP / Oracle / Alibaba), top-tier colocation campuses
 * (Equinix, Digital Realty, NTT), and the major internet exchange points.
 *
 * Coordinates are metro centroids where exact data center locations are
 * not publicly disclosed (most hyperscale halls are deliberately kept
 * vague). Capacity is approximate IT-load MW or "rack count" where
 * disclosed; many are estimated from filings + community trackers.
 *
 * Sources: AWS / Azure / GCP region pages, Equinix + Digital Realty
 * portfolios, Data Center Map, PeeringDB (for IXPs), reporting from
 * Data Center Dynamics / SemiAnalysis.
 */

type FacilityType = 'aws' | 'azure' | 'gcp' | 'oracle' | 'alibaba' | 'tencent' | 'colo' | 'ixp' | 'sovereign';

interface Facility {
  name: string;
  city: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  type: FacilityType;
  operator: string;
  capacity_mw: number;          // rough IT-load megawatts; 0 if unknown
  scale: 'mega' | 'large' | 'medium';
  notes: string;
}

const DCS: Facility[] = [
  // ─── AWS regions (subset of major) ───
  { name: 'AWS us-east-1', city: 'Ashburn, VA', country: 'US', region: 'North America',
    lat: 39.04, lng: -77.49, type: 'aws', operator: 'AWS', capacity_mw: 4500, scale: 'mega',
    notes: 'AWS\'s oldest + largest region. Northern Virginia hosts ~50% of all data-center capacity in the US. Frequent multi-hour outages affect global services when this region hiccups.' },
  { name: 'AWS us-east-2', city: 'Columbus, OH', country: 'US', region: 'North America',
    lat: 39.96, lng: -82.99, type: 'aws', operator: 'AWS', capacity_mw: 900, scale: 'large',
    notes: 'Secondary US east region. Used for failover + workloads avoiding NoVA congestion.' },
  { name: 'AWS us-west-2', city: 'Hermiston, OR', country: 'US', region: 'North America',
    lat: 45.84, lng: -119.29, type: 'aws', operator: 'AWS', capacity_mw: 1100, scale: 'large',
    notes: 'Hydro-powered (BPA grid). Many GovCloud workloads + lower-cost training jobs.' },
  { name: 'AWS eu-west-1', city: 'Dublin', country: 'IE', region: 'Europe',
    lat: 53.35, lng: -6.26, type: 'aws', operator: 'AWS', capacity_mw: 700, scale: 'large',
    notes: 'AWS\'s flagship EU region. Hosts EU-data residency workloads for ~half of Fortune-500 EU operations.' },
  { name: 'AWS eu-central-1', city: 'Frankfurt', country: 'DE', region: 'Europe',
    lat: 50.11, lng: 8.68, type: 'aws', operator: 'AWS', capacity_mw: 800, scale: 'large',
    notes: 'GDPR-strict regional alternative to eu-west-1.' },
  { name: 'AWS ap-northeast-1', city: 'Tokyo', country: 'JP', region: 'Asia-Pacific',
    lat: 35.69, lng: 139.69, type: 'aws', operator: 'AWS', capacity_mw: 550, scale: 'large',
    notes: 'Anchor APAC region. Significant Anthropic Claude inference capacity 2024.' },
  { name: 'AWS ap-southeast-1', city: 'Singapore', country: 'SG', region: 'Asia-Pacific',
    lat: 1.35, lng: 103.82, type: 'aws', operator: 'AWS', capacity_mw: 500, scale: 'large',
    notes: 'SE Asia + India proxy region. Singapore\'s grid + water-cooling constraints have pushed AWS expansion to Johor MY.' },
  { name: 'AWS ap-south-1', city: 'Mumbai', country: 'IN', region: 'Asia-Pacific',
    lat: 19.08, lng: 72.88, type: 'aws', operator: 'AWS', capacity_mw: 300, scale: 'large',
    notes: 'India local region. Doubling Hyderabad capacity through 2026.' },
  { name: 'AWS sa-east-1', city: 'São Paulo', country: 'BR', region: 'South America',
    lat: -23.55, lng: -46.63, type: 'aws', operator: 'AWS', capacity_mw: 200, scale: 'medium',
    notes: 'Only AWS region in South America. Latency-sensitive workloads go via Miami otherwise.' },
  { name: 'AWS me-south-1', city: 'Bahrain', country: 'BH', region: 'Middle East',
    lat: 26.07, lng: 50.55, type: 'aws', operator: 'AWS', capacity_mw: 200, scale: 'medium',
    notes: 'GCC sovereign-cloud anchor. Now joined by me-central-1 in UAE.' },
  { name: 'AWS ap-northeast-2', city: 'Seoul', country: 'KR', region: 'Asia-Pacific',
    lat: 37.57, lng: 126.98, type: 'aws', operator: 'AWS', capacity_mw: 350, scale: 'large',
    notes: 'Korean enterprise + gaming workloads. Samsung is largest single customer.' },
  { name: 'AWS ap-southeast-3', city: 'Jakarta', country: 'ID', region: 'Asia-Pacific',
    lat: -6.21, lng: 106.85, type: 'aws', operator: 'AWS', capacity_mw: 200, scale: 'medium',
    notes: 'Indonesian sovereign data residency region.' },

  // ─── Azure (subset) ───
  { name: 'Azure East US', city: 'Boydton, VA', country: 'US', region: 'North America',
    lat: 36.66, lng: -78.40, type: 'azure', operator: 'Microsoft', capacity_mw: 1200, scale: 'mega',
    notes: 'Microsoft\'s flagship US east region. Anchors Office365 + significant OpenAI training capacity.' },
  { name: 'Azure West US 3', city: 'Phoenix, AZ', country: 'US', region: 'North America',
    lat: 33.45, lng: -112.07, type: 'azure', operator: 'Microsoft', capacity_mw: 1000, scale: 'mega',
    notes: 'Microsoft\'s GPU-heavy expansion. Goodyear AZ campus is core to OpenAI training fleet.' },
  { name: 'Azure North Europe', city: 'Dublin', country: 'IE', region: 'Europe',
    lat: 53.35, lng: -6.26, type: 'azure', operator: 'Microsoft', capacity_mw: 600, scale: 'large',
    notes: 'Dublin\'s grid + water are strained; further DC growth permits frozen by EirGrid 2022+.' },
  { name: 'Azure West Europe', city: 'Amsterdam', country: 'NL', region: 'Europe',
    lat: 52.31, lng: 4.76, type: 'azure', operator: 'Microsoft', capacity_mw: 500, scale: 'large',
    notes: 'Netherlands DC growth restricted by 2022 government moratorium on new hyperscale builds.' },
  { name: 'Azure Sweden Central', city: 'Gävle', country: 'SE', region: 'Europe',
    lat: 60.67, lng: 17.14, type: 'azure', operator: 'Microsoft', capacity_mw: 400, scale: 'large',
    notes: 'Cold-climate datacenter region. Critical hub for OpenAI training scaling in EU.' },
  { name: 'Azure Japan East', city: 'Tokyo', country: 'JP', region: 'Asia-Pacific',
    lat: 35.69, lng: 139.69, type: 'azure', operator: 'Microsoft', capacity_mw: 450, scale: 'large',
    notes: 'Microsoft + OpenAI announced $2.9B JP expansion 2024.' },
  { name: 'Azure Australia East', city: 'Sydney', country: 'AU', region: 'Asia-Pacific',
    lat: -33.87, lng: 151.21, type: 'azure', operator: 'Microsoft', capacity_mw: 300, scale: 'large',
    notes: 'Major AU enterprise + sovereign workloads.' },
  { name: 'Azure UK South', city: 'London', country: 'GB', region: 'Europe',
    lat: 51.51, lng: -0.13, type: 'azure', operator: 'Microsoft', capacity_mw: 400, scale: 'large',
    notes: 'UK sovereign cloud + financial services anchor.' },

  // ─── GCP regions ───
  { name: 'GCP us-central1', city: 'Council Bluffs, IA', country: 'US', region: 'North America',
    lat: 41.26, lng: -95.86, type: 'gcp', operator: 'Google', capacity_mw: 1500, scale: 'mega',
    notes: 'Google\'s oldest + largest US region. Houses major TPU pods for Gemini training.' },
  { name: 'GCP us-east4', city: 'Ashburn, VA', country: 'US', region: 'North America',
    lat: 39.04, lng: -77.49, type: 'gcp', operator: 'Google', capacity_mw: 600, scale: 'large',
    notes: 'GCP\'s NoVA presence. Smaller than AWS\'s, but rapidly growing.' },
  { name: 'GCP us-west4', city: 'Las Vegas, NV', country: 'US', region: 'North America',
    lat: 36.17, lng: -115.14, type: 'gcp', operator: 'Google', capacity_mw: 400, scale: 'large',
    notes: 'Strategic gaming + low-latency LA market. TPU v5p cluster online here.' },
  { name: 'GCP europe-west4', city: 'Eemshaven', country: 'NL', region: 'Europe',
    lat: 53.43, lng: 6.83, type: 'gcp', operator: 'Google', capacity_mw: 400, scale: 'large',
    notes: 'NW Netherlands coastal site. Wind + seawater cooling.' },
  { name: 'GCP asia-northeast1', city: 'Tokyo', country: 'JP', region: 'Asia-Pacific',
    lat: 35.69, lng: 139.69, type: 'gcp', operator: 'Google', capacity_mw: 300, scale: 'large',
    notes: 'GCP Tokyo. Significant Japanese sovereign workloads.' },
  { name: 'GCP asia-southeast1', city: 'Jurong West, Singapore', country: 'SG', region: 'Asia-Pacific',
    lat: 1.35, lng: 103.71, type: 'gcp', operator: 'Google', capacity_mw: 300, scale: 'large',
    notes: 'GCP SE Asia anchor. Like AWS, expanding to Johor MY due to SG constraints.' },

  // ─── Oracle (significant for OpenAI) ───
  { name: 'OCI us-ashburn-1', city: 'Ashburn, VA', country: 'US', region: 'North America',
    lat: 39.04, lng: -77.49, type: 'oracle', operator: 'Oracle', capacity_mw: 500, scale: 'large',
    notes: 'OCI\'s flagship region. Hosts significant ByteDance + sovereign workloads.' },
  { name: 'OCI us-phoenix-1', city: 'Phoenix, AZ', country: 'US', region: 'North America',
    lat: 33.45, lng: -112.07, type: 'oracle', operator: 'Oracle', capacity_mw: 400, scale: 'large',
    notes: 'OpenAI training cluster announced here 2024 (joint with Microsoft).' },
  { name: 'OCI Stargate Abilene', city: 'Abilene, TX', country: 'US', region: 'North America',
    lat: 32.45, lng: -99.73, type: 'oracle', operator: 'Oracle + OpenAI + SoftBank', capacity_mw: 1200, scale: 'mega',
    notes: 'First Stargate site (announced Jan 2025). 10× campus build planned for ~5GW eventually. Initial 1.2GW build under construction.' },

  // ─── Alibaba / Chinese hyperscale ───
  { name: 'Alibaba Cloud Hangzhou', city: 'Hangzhou', country: 'CN', region: 'Asia-Pacific',
    lat: 30.27, lng: 120.15, type: 'alibaba', operator: 'Alibaba Cloud', capacity_mw: 800, scale: 'mega',
    notes: 'Anchor region for Aliyun. Hosts Alibaba\'s own retail platforms + AliCloud public-cloud customers.' },
  { name: 'Alibaba Cloud Shanghai', city: 'Shanghai', country: 'CN', region: 'Asia-Pacific',
    lat: 31.23, lng: 121.47, type: 'alibaba', operator: 'Alibaba Cloud', capacity_mw: 500, scale: 'large',
    notes: 'Aliyun Shanghai. Major BAT-tier workloads.' },
  { name: 'Tencent Cloud Guangzhou', city: 'Guangzhou', country: 'CN', region: 'Asia-Pacific',
    lat: 23.13, lng: 113.26, type: 'tencent', operator: 'Tencent Cloud', capacity_mw: 400, scale: 'large',
    notes: 'Tencent\'s main South China cluster. WeChat + QQ + gaming backend.' },

  // ─── Major colocation campuses ───
  { name: 'Equinix DC1-15 (Ashburn campus)', city: 'Ashburn, VA', country: 'US', region: 'North America',
    lat: 39.02, lng: -77.46, type: 'colo', operator: 'Equinix', capacity_mw: 200, scale: 'large',
    notes: 'World\'s largest carrier-hotel campus. Connects ~99% of US peering. Equinix\'s flagship.' },
  { name: 'Equinix LD8 (Slough)', city: 'Slough', country: 'GB', region: 'Europe',
    lat: 51.51, lng: -0.59, type: 'colo', operator: 'Equinix', capacity_mw: 50, scale: 'medium',
    notes: 'UK\'s premier financial-services colo. Major LINX peering site.' },
  { name: 'Equinix SG3', city: 'Singapore', country: 'SG', region: 'Asia-Pacific',
    lat: 1.32, lng: 103.83, type: 'colo', operator: 'Equinix', capacity_mw: 80, scale: 'medium',
    notes: 'SG carrier-hotel. New SG5 facility approved 2024 (Singapore rare new-build permit).' },
  { name: 'Equinix TY11 (Tokyo)', city: 'Tokyo', country: 'JP', region: 'Asia-Pacific',
    lat: 35.66, lng: 139.79, type: 'colo', operator: 'Equinix', capacity_mw: 50, scale: 'medium',
    notes: 'Tokyo financial + telco colo.' },
  { name: 'Digital Realty Loudoun Campus', city: 'Ashburn, VA', country: 'US', region: 'North America',
    lat: 39.04, lng: -77.49, type: 'colo', operator: 'Digital Realty', capacity_mw: 250, scale: 'large',
    notes: 'Multi-building Northern Virginia campus. Largest DLR site.' },
  { name: 'Digital Realty MRS1-4 (Marseille)', city: 'Marseille', country: 'FR', region: 'Europe',
    lat: 43.30, lng: 5.37, type: 'colo', operator: 'Digital Realty', capacity_mw: 60, scale: 'medium',
    notes: 'Mediterranean cable-landing hub. 16+ submarine cables land here.' },
  { name: 'NTT Tokyo Data Center', city: 'Inzai, Chiba', country: 'JP', region: 'Asia-Pacific',
    lat: 35.83, lng: 140.14, type: 'colo', operator: 'NTT Communications', capacity_mw: 150, scale: 'large',
    notes: 'Japan\'s biggest colo campus. Tier-3 + earthquake-hardened.' },
  { name: 'CoreSite NY1-NY3 (3rd Ave)', city: 'New York, NY', country: 'US', region: 'North America',
    lat: 40.75, lng: -73.97, type: 'colo', operator: 'CoreSite', capacity_mw: 40, scale: 'medium',
    notes: 'Manhattan financial-district peering hub.' },
  { name: 'CWAN Bahnhofstrasse 9', city: 'Stockholm', country: 'SE', region: 'Europe',
    lat: 59.33, lng: 18.06, type: 'colo', operator: 'Bahnhof', capacity_mw: 30, scale: 'medium',
    notes: 'Cold-war bunker converted to data center. Hosts Pirate Bay + Wikileaks mirrors historically.' },

  // ─── Internet Exchange Points ───
  { name: 'DE-CIX Frankfurt', city: 'Frankfurt', country: 'DE', region: 'Europe',
    lat: 50.11, lng: 8.68, type: 'ixp', operator: 'DE-CIX', capacity_mw: 0, scale: 'mega',
    notes: 'World\'s largest IXP by peak traffic (~17 Tbps). Frankfurt is the BGP centre of gravity for Europe.' },
  { name: 'AMS-IX Amsterdam', city: 'Amsterdam', country: 'NL', region: 'Europe',
    lat: 52.31, lng: 4.94, type: 'ixp', operator: 'AMS-IX', capacity_mw: 0, scale: 'mega',
    notes: '~11 Tbps peak. Second-largest European IXP after DE-CIX.' },
  { name: 'LINX London', city: 'London', country: 'GB', region: 'Europe',
    lat: 51.51, lng: -0.13, type: 'ixp', operator: 'LINX', capacity_mw: 0, scale: 'mega',
    notes: 'UK\'s peering backbone (~7 Tbps peak). Spread across Telehouse + Equinix LD8 sites.' },
  { name: 'JPNAP / NSPIXP', city: 'Tokyo', country: 'JP', region: 'Asia-Pacific',
    lat: 35.66, lng: 139.79, type: 'ixp', operator: 'NTT/Internet Multifeed', capacity_mw: 0, scale: 'large',
    notes: 'Japan\'s major peering points. ~6 Tbps peak combined.' },
  { name: 'HKIX', city: 'Hong Kong', country: 'HK', region: 'Asia-Pacific',
    lat: 22.42, lng: 114.21, type: 'ixp', operator: 'HKIX (CUHK)', capacity_mw: 0, scale: 'large',
    notes: 'East Asia peering backbone (~5 Tbps). Operated by Chinese University of Hong Kong.' },
  { name: 'SGIX Singapore', city: 'Singapore', country: 'SG', region: 'Asia-Pacific',
    lat: 1.35, lng: 103.82, type: 'ixp', operator: 'SGIX', capacity_mw: 0, scale: 'large',
    notes: 'SE Asia peering hub. Singapore is the regional BGP cross-connect for 6+ submarine cable landings.' },
  { name: 'Equinix Internet Exchange Ashburn', city: 'Ashburn, VA', country: 'US', region: 'North America',
    lat: 39.04, lng: -77.49, type: 'ixp', operator: 'Equinix', capacity_mw: 0, scale: 'large',
    notes: 'US east-coast peering hub. Lighter than European IXPs because most US peering is private cross-connects.' },

  // ─── Sovereign / national strategic ───
  { name: 'Yandex Vladimir DC', city: 'Vladimir', country: 'RU', region: 'Russia & Caspian',
    lat: 56.13, lng: 40.41, type: 'sovereign', operator: 'Yandex', capacity_mw: 65, scale: 'medium',
    notes: 'Russia\'s biggest commercial data center. Yandex separated Russia ops 2024 after sale to Russian buyers.' },
  { name: 'NSA Utah Data Center (Bumblehive)', city: 'Bluffdale, UT', country: 'US', region: 'North America',
    lat: 40.43, lng: -111.93, type: 'sovereign', operator: 'NSA', capacity_mw: 65, scale: 'large',
    notes: 'NSA\'s flagship storage/processing center. Reported 100+ EB storage; built 2014.' },
  { name: 'GCHQ Cheltenham Donut + Bude', city: 'Cheltenham', country: 'GB', region: 'Europe',
    lat: 51.90, lng: -2.12, type: 'sovereign', operator: 'GCHQ', capacity_mw: 40, scale: 'medium',
    notes: 'UK SIGINT HQ. Co-located submarine-cable taps at Bude Cornwall. Tempora program.' },
  { name: 'G42 Khazna AI Campus', city: 'Abu Dhabi', country: 'AE', region: 'Middle East',
    lat: 24.47, lng: 54.37, type: 'sovereign', operator: 'G42 + Microsoft', capacity_mw: 200, scale: 'large',
    notes: 'UAE\'s sovereign-AI ambition. Microsoft made $1.5B equity investment Apr 2024. Reported 5GW build-out plan.' },
];

export async function GET() {
  const total_mw = DCS.reduce((a, d) => a + d.capacity_mw, 0);
  const byType: Record<string, number> = {};
  const byScale: Record<string, number> = {};
  for (const d of DCS) {
    byType[d.type] = (byType[d.type] || 0) + 1;
    byScale[d.scale] = (byScale[d.scale] || 0) + 1;
  }
  const maxMw = DCS.reduce((m, d) => Math.max(m, d.capacity_mw), 0) || 1;
  const facilities = DCS.map(d => ({
    ...d,
    intensity: Math.min(1, Math.sqrt(Math.max(d.capacity_mw, 30) / maxMw)),
  }));
  return NextResponse.json({
    facilities, total: DCS.length, total_mw, by_type: byType, by_scale: byScale,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' }});
}
