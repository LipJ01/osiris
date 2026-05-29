import { NextResponse } from 'next/server';

/**
 * OSIRIS — Critical Mineral Supply Chains
 *
 * Curated dataset of battery-metal + EV-relevant supply-chain nodes
 * (lithium / cobalt / nickel / rare-earths / graphite) and the flows that
 * connect them. Mine → refining → cathode → cell → OEM pack assembly.
 *
 * Tells the EV-decoupling story: most lithium goes Australia→China for
 * refining, most cobalt goes DRC→China, most rare earths originate at Bayan
 * Obo, and most cathode capacity is concentrated in China + Korea regardless
 * of where the cells are assembled.
 *
 * Sources: Benchmark Mineral Intelligence, BloombergNEF supply-chain
 * reports, USGS Mineral Yearbook, S&P Capital IQ, IEA Critical Minerals
 * Outlook, company filings.
 */

type Stage = 'mine' | 'refining' | 'cathode' | 'cell' | 'pack' | 'oem';
type Bloc = 'China' | 'Korea' | 'Japan' | 'US' | 'EU' | 'Other';

interface Node {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  stage: Stage;
  commodity: string;
  bloc: Bloc;
  operator: string;
  capacity: string;
  notes: string;
}

interface Edge {
  from: string;       // node id
  to: string;         // node id
  commodity: string;
  weight: number;     // 1-3 strength of flow
  notes?: string;
}

const NODES: Node[] = [
  // ── MINES (battery-metal upstream) ──
  { id: 'greenbushes', name: 'Greenbushes', city: 'Greenbushes, WA', country: 'AU',
    lat: -33.85, lng: 116.06, stage: 'mine', commodity: 'lithium (spodumene)', bloc: 'Other',
    operator: 'IGO + Albemarle + Tianqi', capacity: '1.5 Mt spodumene / yr',
    notes: 'Highest-grade hard-rock lithium mine globally; ~40% of world hard-rock supply. Tianqi gives China a direct stake.' },
  { id: 'salar-atacama', name: 'Salar de Atacama', city: 'Antofagasta', country: 'CL',
    lat: -23.50, lng: -68.20, stage: 'mine', commodity: 'lithium (brine)', bloc: 'Other',
    operator: 'SQM + Albemarle', capacity: '200 kt LCE / yr',
    notes: 'World\'s highest-grade lithium brine. Chile\'s 2023 National Lithium Strategy is moving toward state-private 51/49 partnerships.' },
  { id: 'mutanda', name: 'Mutanda', city: 'Lualaba', country: 'CD',
    lat: -10.96, lng: 25.56, stage: 'mine', commodity: 'cobalt + copper', bloc: 'Other',
    operator: 'Glencore', capacity: '30 kt Co + 200 kt Cu / yr',
    notes: 'Largest single cobalt mine globally. DRC supplies ~70% of world cobalt; most refined in China.' },
  { id: 'tenke-fungurume', name: 'Tenke Fungurume', city: 'Lualaba', country: 'CD',
    lat: -10.61, lng: 26.13, stage: 'mine', commodity: 'cobalt + copper', bloc: 'China',
    operator: 'CMOC (China Molybdenum)', capacity: '20 kt Co + 350 kt Cu / yr',
    notes: 'Chinese-owned DRC giant. CMOC also owns Kisanfu nearby. China controls ~70% of DRC cobalt production.' },
  { id: 'morowali', name: 'Morowali nickel cluster', city: 'Central Sulawesi', country: 'ID',
    lat: -2.95, lng: 121.95, stage: 'mine', commodity: 'nickel (laterite)', bloc: 'China',
    operator: 'Tsingshan + multiple Chinese JVs', capacity: '~600 kt Ni / yr (combined)',
    notes: 'Indonesia\'s nickel boom. Mined + smelted on-site at IMIP industrial park; ~all Chinese-financed.' },
  { id: 'norilsk', name: 'Norilsk', city: 'Norilsk', country: 'RU',
    lat: 69.34, lng: 88.20, stage: 'mine', commodity: 'nickel + palladium', bloc: 'Other',
    operator: 'Nornickel', capacity: '215 kt Ni + 90 kt Pd / yr',
    notes: 'World\'s largest palladium producer + 2nd-largest Class-1 nickel. Sanctions-adjacent but not yet sanctioned.' },
  { id: 'bayan-obo', name: 'Bayan Obo', city: 'Inner Mongolia', country: 'CN',
    lat: 41.78, lng: 109.97, stage: 'mine', commodity: 'rare earths (REO)', bloc: 'China',
    operator: 'Baotou Steel (China Northern REE)', capacity: '105 kt REO / yr',
    notes: 'Single largest REE deposit on Earth. ~38% of global REO production. Co-located with magnet manufacturing.' },
  { id: 'mountain-pass', name: 'Mountain Pass', city: 'San Bernardino, CA', country: 'US',
    lat: 35.48, lng: -115.53, stage: 'mine', commodity: 'rare earths (REO)', bloc: 'US',
    operator: 'MP Materials', capacity: '42 kt REO / yr',
    notes: 'Only operating REE mine in the Western hemisphere. Currently ships concentrate to Shenghe in China for separation — diversification away from this is in progress.' },
  { id: 'thacker-pass', name: 'Thacker Pass', city: 'Humboldt County, NV', country: 'US',
    lat: 41.69, lng: -118.05, stage: 'mine', commodity: 'lithium (claystone)', bloc: 'US',
    operator: 'Lithium Americas + GM', capacity: '40 kt LCE / yr (Phase 1)',
    notes: 'Largest known US lithium resource. GM has $650M stake + offtake. Construction-stage 2024.' },
  { id: 'olaroz', name: 'Salar de Olaroz', city: 'Jujuy', country: 'AR',
    lat: -23.50, lng: -66.70, stage: 'mine', commodity: 'lithium (brine)', bloc: 'Other',
    operator: 'Allkem + Toyota Tsusho', capacity: '40 kt LCE / yr',
    notes: 'Argentine lithium triangle. Toyota Tsusho stake gives Japanese OEMs offtake security.' },

  // ── REFINING (the chokepoint stage) ──
  { id: 'ganfeng-xinyu', name: 'Ganfeng Lithium', city: 'Xinyu, Jiangxi', country: 'CN',
    lat: 27.82, lng: 114.93, stage: 'refining', commodity: 'lithium', bloc: 'China',
    operator: 'Ganfeng Lithium', capacity: '110 kt LCE / yr',
    notes: '#2 lithium chemicals refiner globally. Supplies LG, Tesla, BMW, VW. Owns upstream stakes in 15+ countries.' },
  { id: 'tianqi-shehong', name: 'Tianqi Lithium Shehong', city: 'Suining, Sichuan', country: 'CN',
    lat: 30.45, lng: 105.55, stage: 'refining', commodity: 'lithium', bloc: 'China',
    operator: 'Tianqi Lithium', capacity: '60 kt LCE / yr',
    notes: 'Largest single lithium hydroxide refiner. Owns 26% of SQM Chile + 51% of Greenbushes via Talison JV.' },
  { id: 'huayou', name: 'Huayou Cobalt', city: 'Tongxiang, Zhejiang', country: 'CN',
    lat: 30.62, lng: 120.55, stage: 'refining', commodity: 'cobalt + nickel', bloc: 'China',
    operator: 'Zhejiang Huayou Cobalt', capacity: '40 kt Co + 100 kt Ni / yr',
    notes: 'World\'s largest cobalt refiner. Vertically integrated DRC → China → cathode (joint with LGES + Posco).' },
  { id: 'umicore-kokkola', name: 'Umicore Kokkola', city: 'Kokkola', country: 'FI',
    lat: 63.84, lng: 23.13, stage: 'refining', commodity: 'cobalt', bloc: 'EU',
    operator: 'Umicore', capacity: '8 kt Co / yr',
    notes: 'Europe\'s largest cobalt refiner. Sources from DRC + Cuba; supplies Umicore cathode plants.' },
  { id: 'shenghe-baotou', name: 'Shenghe Resources', city: 'Baotou', country: 'CN',
    lat: 40.65, lng: 109.84, stage: 'refining', commodity: 'rare earths separation', bloc: 'China',
    operator: 'Shenghe Resources', capacity: '~25% global REE separation',
    notes: 'Imports Mountain Pass + Australian concentrates for separation. China processes >90% of global REE supply.' },
  { id: 'sumitomo-niihama', name: 'Sumitomo Niihama', city: 'Niihama', country: 'JP',
    lat: 33.96, lng: 133.28, stage: 'refining', commodity: 'nickel sulphate', bloc: 'Japan',
    operator: 'Sumitomo Metal Mining', capacity: '~30 kt Ni / yr (chemical grade)',
    notes: 'Long-standing supplier to Panasonic-Tesla cathode plants. Japan\'s largest non-China battery-metal refiner.' },

  // ── CATHODE ──
  { id: 'lgchem-cheongju', name: 'LG Chem cathode', city: 'Cheongju', country: 'KR',
    lat: 36.64, lng: 127.49, stage: 'cathode', commodity: 'NCM cathode', bloc: 'Korea',
    operator: 'LG Chem', capacity: '~120 kt / yr',
    notes: 'World\'s largest non-Chinese cathode supplier. Feeds LG Energy Solution cells globally.' },
  { id: 'posco-gwangyang', name: 'POSCO Future M', city: 'Gwangyang', country: 'KR',
    lat: 34.93, lng: 127.69, stage: 'cathode', commodity: 'NCM + LFP cathode', bloc: 'Korea',
    operator: 'POSCO Future M', capacity: '~90 kt / yr (expanding)',
    notes: 'Korean steel-major\'s battery-materials arm. Major customer: Samsung SDI + GM Ultium.' },
  { id: 'beihai', name: 'Beihai cathode hub', city: 'Beihai, Guangxi', country: 'CN',
    lat: 21.48, lng: 109.12, stage: 'cathode', commodity: 'NCM + LFP cathode', bloc: 'China',
    operator: 'multi (Ronbay, Easpring, Brunp)', capacity: '~500 kt / yr cluster',
    notes: 'China\'s coastal cathode cluster. Imports DRC cobalt + Indonesian nickel.' },
  { id: 'ningde-cathode', name: 'CATL cathode (Ningde)', city: 'Ningde, Fujian', country: 'CN',
    lat: 26.66, lng: 119.55, stage: 'cathode', commodity: 'NCM + LFP cathode', bloc: 'China',
    operator: 'CATL + subsidiaries', capacity: '~300 kt / yr',
    notes: 'CATL\'s vertically-integrated cathode operations. Adjacent to its main gigafactory.' },
  { id: 'umicore-poland', name: 'Umicore cathode', city: 'Nysa', country: 'PL',
    lat: 50.47, lng: 17.34, stage: 'cathode', commodity: 'NCM cathode', bloc: 'EU',
    operator: 'Umicore', capacity: '~30 kt / yr (Phase 1)',
    notes: 'EU\'s largest cathode plant. Hit by Chinese-LFP commoditisation; Umicore announced restructuring 2024.' },

  // ── CELL / GIGAFACTORIES ──
  { id: 'catl-ningde', name: 'CATL Ningde Gigafactory', city: 'Ningde', country: 'CN',
    lat: 26.67, lng: 119.55, stage: 'cell', commodity: 'NCM + LFP cells', bloc: 'China',
    operator: 'CATL', capacity: '~250 GWh / yr',
    notes: 'World\'s largest battery factory. CATL holds ~38% of global EV battery market.' },
  { id: 'byd-shenzhen', name: 'BYD blade-cell gigafactory', city: 'Chongqing', country: 'CN',
    lat: 29.43, lng: 106.91, stage: 'cell', commodity: 'LFP blade cells', bloc: 'China',
    operator: 'BYD', capacity: '~80 GWh / yr (this plant alone)',
    notes: 'Pioneered LFP blade-cell format. BYD now #2 globally with ~17% share.' },
  { id: 'lges-ochang', name: 'LG Energy Solution Ochang', city: 'Ochang', country: 'KR',
    lat: 36.72, lng: 127.43, stage: 'cell', commodity: 'NCM cells', bloc: 'Korea',
    operator: 'LG Energy Solution', capacity: '~35 GWh / yr',
    notes: 'LGES global R&D centre + flagship plant. ~13% global market share.' },
  { id: 'panasonic-tesla-nv', name: 'Panasonic Gigafactory Nevada', city: 'Sparks, NV', country: 'US',
    lat: 39.54, lng: -119.43, stage: 'cell', commodity: '2170 NCA cells', bloc: 'Japan',
    operator: 'Panasonic + Tesla', capacity: '~38 GWh / yr',
    notes: 'First-mover US gigafactory. Supplies Tesla Model 3/Y. New Panasonic Kansas plant 2025 doubles capacity.' },
  { id: 'tesla-berlin', name: 'Tesla Gigafactory Berlin', city: 'Grünheide', country: 'DE',
    lat: 52.40, lng: 13.79, stage: 'cell', commodity: '4680 NCA cells', bloc: 'US',
    operator: 'Tesla', capacity: '~50 GWh / yr (planned)',
    notes: 'EU\'s most-watched gigafactory. Repeated grid + permitting challenges.' },
  { id: 'gm-ultium-ohio', name: 'Ultium Cells Lordstown', city: 'Lordstown, OH', country: 'US',
    lat: 41.16, lng: -80.85, stage: 'cell', commodity: 'NCMA cells', bloc: 'US',
    operator: 'GM + LGES JV', capacity: '~40 GWh / yr',
    notes: 'Reconverted GM plant. Part of GM\'s Ultium platform supplying Chevy/Cadillac/GMC EVs.' },
  { id: 'northvolt-ett', name: 'Northvolt Ett', city: 'Skellefteå', country: 'SE',
    lat: 64.75, lng: 20.95, stage: 'cell', commodity: 'NCM cells', bloc: 'EU',
    operator: 'Northvolt', capacity: '~16 GWh / yr',
    notes: 'EU\'s first home-grown gigafactory. Filed for US Chapter 11 Nov 2024; future of European-owned cell capacity in question.' },
  { id: 'sk-on-georgia', name: 'SK On Commerce', city: 'Commerce, GA', country: 'US',
    lat: 34.20, lng: -83.46, stage: 'cell', commodity: 'NCM cells', bloc: 'Korea',
    operator: 'SK On', capacity: '~22 GWh / yr',
    notes: 'Supplies Ford F-150 Lightning + VW ID.4. Korean gigafactories dominate US battery manufacturing.' },

  // ── OEM (auto assembly) ──
  { id: 'tesla-fremont', name: 'Tesla Fremont', city: 'Fremont, CA', country: 'US',
    lat: 37.49, lng: -121.95, stage: 'oem', commodity: 'EV assembly', bloc: 'US',
    operator: 'Tesla', capacity: '~600k vehicles / yr',
    notes: 'Tesla\'s historic plant. Model S/X/3/Y assembly.' },
  { id: 'tesla-shanghai', name: 'Tesla Shanghai Gigafactory', city: 'Shanghai', country: 'CN',
    lat: 31.16, lng: 121.78, stage: 'oem', commodity: 'EV assembly + cells', bloc: 'US',
    operator: 'Tesla', capacity: '~950k vehicles / yr',
    notes: 'Tesla\'s largest plant. Exports to Europe + Asia. Uses CATL LFP for standard-range + LGES NCM for long-range.' },
  { id: 'byd-shenzhen-assembly', name: 'BYD Shenzhen HQ', city: 'Shenzhen', country: 'CN',
    lat: 22.54, lng: 114.06, stage: 'oem', commodity: 'EV assembly', bloc: 'China',
    operator: 'BYD', capacity: '~4 million vehicles / yr (2024)',
    notes: 'BYD surpassed Tesla in EV+PHEV global volume 2023. Fully integrated mine→cell→car.' },
  { id: 'vw-zwickau', name: 'VW Zwickau', city: 'Zwickau', country: 'DE',
    lat: 50.72, lng: 12.49, stage: 'oem', commodity: 'EV assembly', bloc: 'EU',
    operator: 'Volkswagen', capacity: '~330k EVs / yr',
    notes: 'VW\'s flagship MEB-platform EV plant. Recently scaled back amid EU EV-demand softening 2024.' },
  { id: 'hyundai-meta', name: 'Hyundai Metaplant', city: 'Ellabell, GA', country: 'US',
    lat: 32.16, lng: -81.40, stage: 'oem', commodity: 'EV assembly', bloc: 'Korea',
    operator: 'Hyundai Motor Group', capacity: '~300k EVs / yr',
    notes: 'Opening 2024-25. Pairs with LGES + SK On Georgia cell plants for IRA-compliant assembly.' },
];

const EDGES: Edge[] = [
  // ── Lithium chain ──
  { from: 'greenbushes', to: 'tianqi-shehong', commodity: 'spodumene', weight: 3, notes: 'Greenbushes-Tianqi vertical via Talison JV' },
  { from: 'greenbushes', to: 'ganfeng-xinyu', commodity: 'spodumene', weight: 2 },
  { from: 'salar-atacama', to: 'tianqi-shehong', commodity: 'lithium carbonate', weight: 2 },
  { from: 'salar-atacama', to: 'lgchem-cheongju', commodity: 'lithium hydroxide', weight: 1 },
  { from: 'olaroz', to: 'sumitomo-niihama', commodity: 'lithium carbonate', weight: 1, notes: 'Toyota Tsusho offtake' },
  { from: 'thacker-pass', to: 'gm-ultium-ohio', commodity: 'lithium carbonate', weight: 2, notes: 'GM offtake agreement' },
  // ── Lithium refining → cathode ──
  { from: 'ganfeng-xinyu', to: 'beihai', commodity: 'lithium hydroxide', weight: 2 },
  { from: 'ganfeng-xinyu', to: 'ningde-cathode', commodity: 'lithium hydroxide', weight: 2 },
  { from: 'ganfeng-xinyu', to: 'lgchem-cheongju', commodity: 'lithium hydroxide', weight: 2 },
  { from: 'tianqi-shehong', to: 'beihai', commodity: 'lithium hydroxide', weight: 2 },
  { from: 'tianqi-shehong', to: 'lgchem-cheongju', commodity: 'lithium hydroxide', weight: 2 },
  { from: 'tianqi-shehong', to: 'posco-gwangyang', commodity: 'lithium hydroxide', weight: 1 },
  // ── Cobalt chain (DRC dominated) ──
  { from: 'mutanda', to: 'huayou', commodity: 'cobalt hydroxide', weight: 2 },
  { from: 'mutanda', to: 'umicore-kokkola', commodity: 'cobalt hydroxide', weight: 1 },
  { from: 'tenke-fungurume', to: 'huayou', commodity: 'cobalt hydroxide', weight: 3, notes: 'Chinese vertical integration' },
  { from: 'huayou', to: 'beihai', commodity: 'cobalt sulphate', weight: 2 },
  { from: 'huayou', to: 'lgchem-cheongju', commodity: 'cobalt sulphate', weight: 2 },
  { from: 'huayou', to: 'posco-gwangyang', commodity: 'cobalt sulphate', weight: 2 },
  { from: 'umicore-kokkola', to: 'umicore-poland', commodity: 'cobalt sulphate', weight: 2 },
  // ── Nickel chain ──
  { from: 'morowali', to: 'huayou', commodity: 'nickel sulphate', weight: 3, notes: 'Indonesia→China dominant pathway' },
  { from: 'morowali', to: 'ningde-cathode', commodity: 'NCM precursor', weight: 2 },
  { from: 'norilsk', to: 'sumitomo-niihama', commodity: 'nickel briquettes', weight: 1, notes: 'Pre-sanctions historical flow' },
  { from: 'sumitomo-niihama', to: 'panasonic-tesla-nv', commodity: 'nickel sulphate', weight: 2 },
  // ── Rare earths (Bayan Obo dominant) ──
  { from: 'bayan-obo', to: 'shenghe-baotou', commodity: 'rare-earth oxides', weight: 3 },
  { from: 'mountain-pass', to: 'shenghe-baotou', commodity: 'REO concentrate', weight: 2, notes: 'US→China dependency the IRA aims to break' },
  // ── Cathode → cell ──
  { from: 'beihai', to: 'catl-ningde', commodity: 'NCM cathode', weight: 2 },
  { from: 'ningde-cathode', to: 'catl-ningde', commodity: 'cathode', weight: 3 },
  { from: 'ningde-cathode', to: 'byd-shenzhen', commodity: 'LFP cathode', weight: 1 },
  { from: 'lgchem-cheongju', to: 'lges-ochang', commodity: 'NCM cathode', weight: 3 },
  { from: 'lgchem-cheongju', to: 'sk-on-georgia', commodity: 'NCM cathode', weight: 2 },
  { from: 'lgchem-cheongju', to: 'gm-ultium-ohio', commodity: 'NCM cathode', weight: 2 },
  { from: 'posco-gwangyang', to: 'sk-on-georgia', commodity: 'NCM cathode', weight: 2 },
  { from: 'posco-gwangyang', to: 'gm-ultium-ohio', commodity: 'NCM cathode', weight: 1 },
  { from: 'umicore-poland', to: 'tesla-berlin', commodity: 'NCM cathode', weight: 1 },
  { from: 'umicore-poland', to: 'northvolt-ett', commodity: 'NCM cathode', weight: 1 },
  // ── Cell → OEM ──
  { from: 'catl-ningde', to: 'tesla-shanghai', commodity: 'LFP cells (standard range)', weight: 3 },
  { from: 'catl-ningde', to: 'vw-zwickau', commodity: 'NCM cells', weight: 2 },
  { from: 'catl-ningde', to: 'tesla-berlin', commodity: 'NCM cells', weight: 1 },
  { from: 'byd-shenzhen', to: 'byd-shenzhen-assembly', commodity: 'LFP blade cells', weight: 3, notes: 'In-house integration' },
  { from: 'panasonic-tesla-nv', to: 'tesla-fremont', commodity: '2170 cells', weight: 3 },
  { from: 'tesla-berlin', to: 'vw-zwickau', commodity: '4680 cells (limited)', weight: 1 },
  { from: 'lges-ochang', to: 'hyundai-meta', commodity: 'NCM cells', weight: 2 },
  { from: 'sk-on-georgia', to: 'hyundai-meta', commodity: 'NCM cells', weight: 3 },
  { from: 'gm-ultium-ohio', to: 'tesla-fremont', commodity: 'NCMA cells', weight: 1, notes: 'Not actual flow — placeholder' },
];

export async function GET() {
  // Build edge features with from/to coordinates pre-resolved
  const byId = new Map(NODES.map(n => [n.id, n]));
  const edges = EDGES.map(e => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return null;
    return {
      from: e.from, to: e.to,
      from_lat: a.lat, from_lng: a.lng,
      to_lat: b.lat, to_lng: b.lng,
      from_bloc: a.bloc, to_bloc: b.bloc,
      from_name: a.name, to_name: b.name,
      from_stage: a.stage, to_stage: b.stage,
      commodity: e.commodity, weight: e.weight, notes: e.notes || null,
    };
  }).filter(Boolean);

  const byStage: Record<string, number> = {};
  const byBloc: Record<string, number> = {};
  for (const n of NODES) {
    byStage[n.stage] = (byStage[n.stage] || 0) + 1;
    byBloc[n.bloc] = (byBloc[n.bloc] || 0) + 1;
  }

  return NextResponse.json({
    nodes: NODES,
    edges,
    total_nodes: NODES.length,
    total_edges: edges.length,
    by_stage: byStage,
    by_bloc: byBloc,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' },
  });
}
