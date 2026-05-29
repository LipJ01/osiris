/**
 * OSIRIS — Extended intelligence layer feed config.
 *
 * Each entry describes one data feed for the extended layer set. The page
 * fetches a feed lazily the first time any of its `triggers` (activeLayers
 * keys) is enabled, and optionally re-polls it on `pollMs`. This keeps
 * page.tsx free of ~35 near-identical fetch/poll blocks — to add a layer,
 * add a route + a LayerPanel entry + one line here.
 */
export interface LayerFeed {
  /** Dedupe key for the one-shot lazy fetch. */
  id: string;
  /** activeLayers keys that should trigger this feed to load. */
  triggers: string[];
  /** API endpoint. */
  url: string;
  /** Maps the raw response into the keys consumed by the map/panels. */
  transform?: (d: any) => Record<string, unknown>;
  /** If set, the feed is re-polled at this interval (ms) while active. */
  pollMs?: number;
}

export const EXTRA_LAYER_FEEDS: LayerFeed[] = [
  // Maritime & space
  { id: 'sharks', triggers: ['sharks'], url: '/api/sharks', transform: d => ({ sharks: d.sharks }) },
  { id: 'spaceports', triggers: ['spaceports'], url: '/api/space/spaceports', transform: d => ({ spaceports: d.spaceports }) },

  // Fisheries
  { id: 'fish_stocks', triggers: ['fish_stocks'], url: '/api/fisheries', transform: d => ({ fish_stocks: d.stocks }) },
  { id: 'fishing_effort', triggers: ['fishing_effort'], url: '/api/fisheries/effort', transform: d => ({ fishing_effort: d.zones, fishing_effort_range: d.date_range }) },
  { id: 'fish_landings', triggers: ['fish_landings'], url: '/api/fisheries/landings', transform: d => ({ fish_landings: d.states, fish_landings_year: d.year, fish_landings_total: d.total_dollars }) },

  // Biomes
  { id: 'forests', triggers: ['forests'], url: '/api/biomes/forests', transform: d => ({ forests: d.forests }) },
  { id: 'coral_reefs', triggers: ['coral_reefs'], url: '/api/biomes/coral-reefs', transform: d => ({ coral_reefs: d.reefs }) },

  // Resources
  { id: 'oil_gas', triggers: ['oil_gas'], url: '/api/resources/oil-gas', transform: d => ({ oil_gas: d.fields }) },
  { id: 'mines', triggers: ['mines'], url: '/api/resources/mines', transform: d => ({ mines: d.mines }) },
  { id: 'mineral_chains', triggers: ['mineral_chains'], url: '/api/resources/minerals', transform: d => ({ mineral_nodes: d.nodes, mineral_edges: d.edges }) },
  { id: 'refineries', triggers: ['refineries'], url: '/api/resources/refineries', transform: d => ({ refineries: d.refineries }) },

  // Macro
  { id: 'cb_rates', triggers: ['cb_rates'], url: '/api/macro/cb-rates', transform: d => ({ cb_rates: d.banks, cb_rates_built_at: d.built_at }) },
  { id: 'macro_us', triggers: ['macro_us'], url: '/api/macro/indicators', transform: d => ({ macro_us: d, macro_us_indicators: d.indicators }) },

  // Freight
  { id: 'shipping_lanes', triggers: ['shipping_lanes'], url: '/api/freight/shipping-lanes', transform: d => ({ shipping_lanes: d.lanes }) },
  { id: 'air_cargo', triggers: ['air_cargo'], url: '/api/freight/air-cargo', transform: d => ({ air_cargo: d.hubs }) },
  { id: 'rail_corridors', triggers: ['rail_corridors'], url: '/api/freight/rail-corridors', transform: d => ({ rail_corridors: d.corridors }) },

  // Infrastructure
  { id: 'submarine_cables', triggers: ['submarine_cables'], url: '/api/infra/submarine-cables', transform: d => ({ submarine_cables: d.cables, submarine_cable_landings: d.landings }) },
  { id: 'pipelines', triggers: ['pipelines'], url: '/api/infra/pipelines', transform: d => ({ pipelines: d.pipelines }) },
  { id: 'power_plants', triggers: ['power_plants'], url: '/api/infra/power-plants', transform: d => ({ power_plants: d.plants }) },
  { id: 'data_centers', triggers: ['data_centers'], url: '/api/infra/data-centers', transform: d => ({ data_centers: d.facilities }) },
  { id: 'gpu_clusters', triggers: ['gpu_clusters'], url: '/api/infra/gpu-clusters', transform: d => ({ gpu_clusters: d.clusters }) },

  // Influence ops
  { id: 'influence_campaigns', triggers: ['influence_campaigns'], url: '/api/influence/campaigns', transform: d => ({ influence_campaigns_ops: d.operations, influence_campaigns_operators: d.operators }) },
  { id: 'influence_takedowns', triggers: ['influence_takedowns'], url: '/api/influence/takedowns', transform: d => ({ influence_takedowns_operators: d.operators, influence_takedowns_total: d.total_events }) },

  // Connectivity
  { id: 'network_interference', triggers: ['network_interference'], url: '/api/connectivity/network-interference', transform: d => ({ network_interference: d.countries, network_interference_built_at: d.built_at, network_interference_total: d.total_measurements }) },

  // Cyber
  { id: 'cyber_attacks', triggers: ['cyber_attacks'], url: '/api/cyber/attacks', transform: d => ({ cyber_attacks: d.attacks, cyber_targets: d.targets, cyber_arcs: d.arcs }) },
  { id: 'ransomware', triggers: ['ransomware'], url: '/api/cyber/ransomware', transform: d => ({ ransomware_countries: d.countries, ransomware_total: d.total_victims, ransomware_window: d.window_days, ransomware_groups: d.groups_seen }), pollMs: 1800000 },

  // Narcotics / sanctions
  { id: 'drug_seizures', triggers: ['drug_seizures'], url: '/api/narcotics/seizures', transform: d => ({ drug_seizures: d.seizures, drug_seizures_total_kg: d.total_kg, drug_seizures_by_drug: d.by_drug }) },
  { id: 'sanctions', triggers: ['sanctions'], url: '/api/sanctions/geography', transform: d => ({ sanctions: d.countries, sanctions_total_targets: d.total_targets, sanctions_schema_totals: d.schema_totals, sanctions_last_change: d.last_change }) },

  // Humanitarian
  { id: 'refugees', triggers: ['refugees'], url: '/api/humanitarian/refugees', transform: d => ({ refugee_corridors: d.corridors, refugee_asylum: d.asylum_markers, refugee_year: d.year }) },

  // Health
  { id: 'outbreaks', triggers: ['outbreaks'], url: '/api/health/outbreaks', transform: d => ({ outbreaks: d.markers, outbreaks_built_at: d.built_at, outbreaks_total: d.total_reports }) },

  // Threats
  { id: 'military_bases', triggers: ['military_bases'], url: '/api/threats/military-bases', transform: d => ({ military_bases: d.bases }) },
  { id: 'gps_jamming_daily', triggers: ['gps_jamming_daily'], url: '/api/gps-jamming', transform: d => ({ gps_jamming_daily: d }) },

  // Environment
  { id: 'air_quality', triggers: ['air_quality'], url: '/api/environment/air-quality', transform: d => ({ air_quality: d.cities, air_quality_built_at: d.built_at }), pollMs: 900000 },
  { id: 'storms', triggers: ['storms'], url: '/api/environment/storms', transform: d => ({ storms: d.storms, storms_built_at: d.built_at }), pollMs: 1800000 },
  { id: 'volcanoes', triggers: ['volcanoes'], url: '/api/environment/volcanoes', transform: d => ({ volcanoes: d.volcanoes, volcanoes_built_at: d.built_at }), pollMs: 7200000 },
  { id: 'sea_ice', triggers: ['sea_ice'], url: '/api/environment/sea-ice', transform: d => ({ sea_ice: d.poles, sea_ice_built_at: d.built_at }) },
];
