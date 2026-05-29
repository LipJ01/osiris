'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Activity, Globe, Radio, Eye,
  Shield, Sun, AlertTriangle, Camera, Flame, Target,
  CloudLightning, Radiation, Tv, Anchor, Ship, Newspaper,
  Fish, Fuel, Pickaxe, Trees, Landmark, Cable, Rocket, Wind,
  Biohazard, Megaphone, Network, Bug, Tent, Container, Train,
  Package, Server, Cpu, Mountain, WifiOff, Snowflake, Pill, Ban,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
}

const LAYER_GROUPS = [
  {
    label: 'AVIATION',
    icon: Plane,
    color: '#00E5FF',
    layers: [
      { key: 'flights', label: 'Commercial', icon: Plane, color: '#00E5FF', dataKey: 'commercial_flights' },
      { key: 'private', label: 'Private', icon: Plane, color: '#00E676', dataKey: 'private_flights' },
      { key: 'jets', label: 'Private Jets', icon: Plane, color: '#FF69B4', dataKey: 'private_jets' },
      { key: 'military', label: 'Military', icon: Shield, color: '#FF3D3D', dataKey: 'military_flights' },
    ],
  },
  {
    label: 'MARITIME & SPACE',
    icon: Ship,
    color: '#00BCD4',
    layers: [
      { key: 'maritime', label: 'Maritime / Naval', icon: Ship, color: '#00BCD4', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: 'sharks', label: 'Tagged Sharks', icon: Fish, color: '#1DE9B6', dataKey: 'sharks' },
      { key: 'satellites', label: 'Satellites', icon: Satellite, color: '#D4AF37', dataKey: 'satellites' },
      { key: 'spaceports', label: 'Spaceports', icon: Rocket, color: '#FF80AB', dataKey: 'spaceports' },
    ],
  },
  {
    label: 'FISHERIES',
    icon: Fish,
    color: '#1DE9B6',
    layers: [
      { key: 'fish_stocks', label: 'Stock Health', icon: Fish, color: '#1DE9B6', dataKey: 'fish_stocks' },
      { key: 'fishing_effort', label: 'Fishing Effort (GFW)', icon: Anchor, color: '#FF6B00', dataKey: 'fishing_effort' },
      { key: 'fish_landings', label: 'US Landings (NOAA)', icon: Anchor, color: '#FFD500', dataKey: 'fish_landings' },
    ],
  },
  {
    label: 'BIOMES',
    icon: Trees,
    color: '#4CAF50',
    layers: [
      { key: 'forests', label: 'Forests', icon: Trees, color: '#4CAF50', dataKey: 'forests' },
      { key: 'coral_reefs', label: 'Coral Reefs', icon: Fish, color: '#FF80AB', dataKey: 'coral_reefs' },
    ],
  },
  {
    label: 'RESOURCES',
    icon: Fuel,
    color: '#FFA000',
    layers: [
      { key: 'oil_gas', label: 'Oil & Gas (upstream)', icon: Fuel, color: '#FFA000', dataKey: 'oil_gas' },
      { key: 'mines', label: 'Tier-1 Mines', icon: Pickaxe, color: '#B0BEC5', dataKey: 'mines' },
      { key: 'mineral_chains', label: 'Mineral Supply Chains', icon: Network, color: '#FF80AB', dataKey: 'mineral_nodes' },
    ],
  },
  {
    label: 'MACRO',
    icon: Landmark,
    color: '#FFD700',
    layers: [
      { key: 'cb_rates', label: 'Central Bank Rates', icon: Landmark, color: '#FFD700', dataKey: 'cb_rates' },
      { key: 'macro_us', label: 'US Macro Indicators', icon: Landmark, color: '#FFC400', dataKey: 'macro_us_indicators' },
    ],
  },
  {
    label: 'FREIGHT',
    icon: Container,
    color: '#1976D2',
    layers: [
      { key: 'shipping_lanes', label: 'Shipping Lanes', icon: Ship, color: '#1976D2', dataKey: 'shipping_lanes' },
      { key: 'air_cargo', label: 'Air Cargo Hubs', icon: Package, color: '#FF9800', dataKey: 'air_cargo' },
      { key: 'rail_corridors', label: 'Rail Corridors', icon: Train, color: '#795548', dataKey: 'rail_corridors' },
    ],
  },
  {
    label: 'INFRASTRUCTURE',
    icon: Cable,
    color: '#80DEEA',
    layers: [
      { key: 'submarine_cables', label: 'Submarine Cables', icon: Cable, color: '#80DEEA', dataKey: 'submarine_cables' },
      { key: 'pipelines', label: 'Pipelines', icon: Fuel, color: '#FFA000', dataKey: 'pipelines' },
      { key: 'power_plants', label: 'Power Plants', icon: Fuel, color: '#FFEB3B', dataKey: 'power_plants' },
      { key: 'refineries', label: 'Refineries', icon: Fuel, color: '#00BCD4', dataKey: 'refineries' },
      { key: 'data_centers', label: 'Data Centers', icon: Server, color: '#26C6DA', dataKey: 'data_centers' },
      { key: 'gpu_clusters', label: 'GPU Clusters', icon: Cpu, color: '#EC407A', dataKey: 'gpu_clusters' },
    ],
  },
  {
    label: 'INFLUENCE OPS',
    icon: Megaphone,
    color: '#EC407A',
    layers: [
      { key: 'influence_campaigns', label: 'Named Campaigns', icon: Megaphone, color: '#EC407A', dataKey: 'influence_campaigns' },
      { key: 'influence_takedowns', label: 'Platform Takedowns', icon: Network, color: '#9C27B0', dataKey: 'influence_takedowns' },
    ],
  },
  {
    label: 'CONNECTIVITY',
    icon: WifiOff,
    color: '#FFAB91',
    layers: [
      { key: 'network_interference', label: 'Network Interference (OONI)', icon: WifiOff, color: '#FFAB91', dataKey: 'network_interference' },
    ],
  },
  {
    label: 'CYBER',
    icon: Bug,
    color: '#FF1744',
    layers: [
      { key: 'cyber_attacks', label: 'Named Attacks', icon: Bug, color: '#FF1744', dataKey: 'cyber_attacks' },
      { key: 'ransomware', label: 'Ransomware Tracker', icon: Bug, color: '#E91E63', dataKey: 'ransomware' },
    ],
  },
  {
    label: 'NARCOTICS',
    icon: Pill,
    color: '#BA68C8',
    layers: [
      { key: 'drug_seizures', label: 'Major Seizures', icon: Pill, color: '#BA68C8', dataKey: 'drug_seizures' },
    ],
  },
  {
    label: 'SANCTIONS',
    icon: Ban,
    color: '#FF8A65',
    layers: [
      { key: 'sanctions', label: 'Sanctions Geography', icon: Ban, color: '#FF8A65', dataKey: 'sanctions' },
    ],
  },
  {
    label: 'HUMANITARIAN',
    icon: Tent,
    color: '#42A5F5',
    layers: [
      { key: 'refugees', label: 'Refugee Flows (UNHCR)', icon: Tent, color: '#42A5F5', dataKey: 'refugee_corridors' },
    ],
  },
  {
    label: 'HEALTH',
    icon: Biohazard,
    color: '#FF6B6B',
    layers: [
      { key: 'outbreaks', label: 'Disease Outbreaks', icon: Biohazard, color: '#FF6B6B', dataKey: 'outbreaks' },
    ],
  },
  {
    label: 'SURVEILLANCE',
    icon: Camera,
    color: '#39FF14',
    layers: [
      { key: 'cctv', label: 'CCTV Cameras', icon: Camera, color: '#39FF14', dataKey: 'cameras' },
      { key: 'live_news', label: 'Live News Feeds', icon: Tv, color: '#FF4081', dataKey: 'live_feeds' },
    ],
  },
  {
    label: 'NATURAL HAZARDS',
    icon: Activity,
    color: '#FF9500',
    layers: [
      { key: 'earthquakes', label: 'Earthquakes (24h)', icon: Activity, color: '#FF9500', dataKey: 'earthquakes' },
      { key: 'fires', label: 'Active Fires', icon: Flame, color: '#FF6B00', dataKey: 'fires' },
      { key: 'weather', label: 'Severe Weather', icon: CloudLightning, color: '#E040FB', dataKey: 'weather_events' },
      { key: 'storms', label: 'Active Tropical Cyclones', icon: Wind, color: '#26C6DA', dataKey: 'storms' },
      { key: 'volcanoes', label: 'Active Volcanoes', icon: Mountain, color: '#FF5722', dataKey: 'volcanoes' },
      { key: 'sea_ice', label: 'Sea Ice Extent', icon: Snowflake, color: '#90CAF9', dataKey: 'sea_ice' },
      { key: 'air_quality', label: 'Air Quality', icon: Wind, color: '#FF80AB', dataKey: 'air_quality' },
    ],
  },
  {
    label: 'THREATS & INFRA',
    icon: AlertTriangle,
    color: '#FF3D3D',
    layers: [
      { key: 'infrastructure', label: 'Nuclear Facilities', icon: Radiation, color: '#76FF03', dataKey: 'infrastructure' },
      { key: 'military_bases', label: 'Military Bases', icon: Shield, color: '#448AFF', dataKey: 'military_bases' },
      { key: 'global_incidents', label: 'Global Incidents', icon: AlertTriangle, color: '#FF3D3D', dataKey: 'gdelt' },
      { key: 'gps_jamming', label: 'GPS Jamming (live)', icon: Radio, color: '#FF4444', dataKey: 'gps_jamming' },
      { key: 'gps_jamming_daily', label: 'GPS Jamming (24h)', icon: Radio, color: '#FF9100', dataKey: 'gps_jamming_daily' },
      { key: 'scm_suppliers', label: 'SCM Suppliers', icon: Target, color: '#00BCD4', dataKey: 'scm_suppliers' },
    ],
  },
  {
    label: 'DISPLAY',
    icon: Sun,
    color: '#448AFF',
    layers: [
      { key: 'day_night', label: 'Day / Night Cycle', icon: Sun, color: '#448AFF', dataKey: '' },
    ],
  },
];

// Flat list for backward compat
const ALL_LAYERS = LAYER_GROUPS.flatMap(g => g.layers);

function LayerPanel({ data, activeLayers, setActiveLayers }: LayerPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    LAYER_GROUPS.forEach(g => { initial[g.label] = true; });
    return initial;
  });

  const toggle = (key: string) => setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  const getCount = (dk: string): number | null => {
    if (!dk) return null;
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      if (data[k] && Array.isArray(data[k])) {
        total += data[k].length;
        found = true;
      }
    }
    return found ? total : null;
  };
  const totalEntities = ALL_LAYERS.reduce((s: number, l: any) => s + (getCount(l.dataKey) || 0), 0);
  const activeCount = Object.values(activeLayers).filter(Boolean).length;

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  };

  const toggleAllInGroup = (group: typeof LAYER_GROUPS[0]) => {
    const allActive = group.layers.every(l => activeLayers[l.key]);
    setActiveLayers((prev: any) => {
      const next = { ...prev };
      group.layers.forEach(l => { next[l.key] = !allActive; });
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="glass-panel p-3 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Eye className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--alert-green)] animate-osiris-pulse" />
          </div>
          <span className="hud-text text-[12px] text-[var(--text-primary)] tracking-widest">DATA LAYERS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`gotham-tag ${activeCount > 10 ? 'gotham-tag--critical' : activeCount > 5 ? 'gotham-tag--high' : 'gotham-tag--low'}`} style={{ fontSize: '8px', padding: '1px 6px' }}>
            {activeCount}/{ALL_LAYERS.length}
          </span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '7px', padding: '1px 5px' }}>{totalEntities.toLocaleString()} ENT</span>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-1">
        {LAYER_GROUPS.map((group) => {
          const isExpanded = expandedGroups[group.label];
          const groupActiveCount = group.layers.filter(l => activeLayers[l.key]).length;
          const allActive = groupActiveCount === group.layers.length;
          const GroupIcon = group.icon;

          return (
            <div key={group.label}>
              {/* Group Header */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
                >
                  <GroupIcon className="w-3 h-3 flex-shrink-0" style={{ color: group.color }} />
                  <span className="text-[9px] font-mono tracking-[0.15em] text-[var(--text-secondary)] font-bold flex-1 text-left">{group.label}</span>
                  <span className="text-[8px] font-mono tabular-nums" style={{ color: groupActiveCount > 0 ? group.color : 'var(--text-muted)' }}>
                    {groupActiveCount}/{group.layers.length}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  )}
                </button>
                {/* Toggle all in group */}
                <button
                  onClick={() => toggleAllInGroup(group)}
                  className="p-1 rounded hover:bg-white/[0.05] transition-colors"
                  title={allActive ? 'Disable all' : 'Enable all'}
                >
                  {allActive ? (
                    <ToggleRight className="w-3.5 h-3.5" style={{ color: group.color }} />
                  ) : (
                    <ToggleLeft className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  )}
                </button>
              </div>

              {/* Layer items */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-2 pl-2 border-l border-[var(--border-secondary)]/40 space-y-px">
                      {group.layers.map((layer) => {
                        const Icon = layer.icon;
                        const isActive = activeLayers[layer.key];
                        const count = getCount(layer.dataKey);
                        return (
                          <button
                            key={layer.key}
                            onClick={() => toggle(layer.key)}
                            className={`w-full flex items-center gap-2.5 px-2 py-[5px] rounded-md transition-all duration-200 group ${
                              isActive
                                ? 'bg-white/[0.04] border border-white/[0.06]'
                                : 'border border-transparent hover:bg-white/[0.02]'
                            }`}
                          >
                            {/* Color dot indicator */}
                            <div
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-100' : 'scale-50 opacity-30'}`}
                              style={{
                                backgroundColor: layer.color,
                                boxShadow: isActive ? `0 0 6px ${layer.color}60` : 'none',
                              }}
                            />
                            <Icon
                              className="w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200"
                              style={{ color: isActive ? layer.color : 'var(--text-muted)' }}
                            />
                            <span className={`text-[11px] font-mono tracking-wide flex-1 text-left transition-colors duration-200 ${
                              isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                            }`}>
                              {layer.label}
                            </span>
                            {count !== null && (
                              <span
                                className="text-[9px] font-mono tabular-nums font-bold transition-colors duration-200"
                                style={{ color: isActive ? layer.color : 'var(--text-muted)' }}
                              >
                                {count.toLocaleString()}
                              </span>
                            )}
                            {/* Toggle switch */}
                            <div className={`layer-toggle ${isActive ? 'active' : ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default memo(LayerPanel);
