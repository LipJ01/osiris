import maplibregl from 'maplibre-gl';

/**
 * OSIRIS — Extended intelligence map layers (install).
 *
 * Adds the maplibre sources, layers and click/hover handlers for the extended
 * layer set (resources, fisheries, infra, cyber, influence, humanitarian, …).
 * Extracted out of OsirisMap to keep that file focused on the base map. Call
 * once from inside the map's `load` handler, AFTER the base layers are added,
 * passing the popup helpers that live in that closure.
 *
 * Z-order note: these layers are installed after the base layers, so they
 * render above them. Intra-module order is preserved (line/arc underlays are
 * added before their point markers).
 */
export interface ExtendedLayerContext {
  popup: (coords: any, html: string) => void;
  pStyle: string;
  linkStyle: string;
  setSelectedShark: (s: { id: number; name: string; bucket: string; color: string } | null) => void;
}

/** New geojson source IDs introduced by the extended layers. */
export const EXTENDED_SOURCES = [
  'gps-jamming-daily', 'sharks', 'shark-track', 'shark-track-pings', 'fish-stocks',
  'fishing-effort', 'fish-landings', 'oil-gas', 'mines', 'refineries', 'forests', 'cb-rates',
  'submarine-cables', 'submarine-cable-landings', 'power-plants', 'military-bases', 'spaceports',
  'air-quality', 'outbreaks', 'influence-arcs', 'influence-ops', 'influence-takedowns', 'cyber-arcs',
  'cyber-targets', 'ransomware', 'macro-us', 'pipelines', 'mineral-arcs', 'mineral-nodes', 'refugee-arcs',
  'refugee-asylum', 'storms', 'storm-tracks', 'coral-reefs', 'shipping-lanes', 'air-cargo', 'rail-corridors',
  'data-centers', 'gpu-clusters', 'volcanoes', 'network-interference', 'sea-ice', 'drug-seizures', 'sanctions',
];

/** Interactive layers that should show a pointer cursor on hover. */
const HOVER_LAYERS = [
  'shark-dots', 'fish-stocks-dots', 'fishing-effort-ring', 'fish-landings-dots', 'oil-gas-dots',
  'mines-dots', 'refineries-dots', 'forests-dots', 'cb-rates-dots', 'subcables-line', 'subcable-landings',
  'power-plants-dots', 'military-bases-dots', 'spaceports-dots', 'air-quality-dots', 'outbreaks-dots',
  'influence-ops-dots', 'influence-takedowns-dots', 'cyber-targets-dots', 'ransomware-dots', 'macro-us-dots',
  'pipelines-line', 'mineral-nodes-dots', 'refugee-asylum-dots', 'storms-dots', 'coral-reefs-dots',
  'shipping-lanes-line', 'air-cargo-dots', 'rail-corridors-line', 'data-centers-dots', 'gpu-clusters-dots',
  'volcanoes-dots', 'network-interference-dots', 'sea-ice-dots', 'drug-seizures-dots', 'sanctions-dots',
];

const SHARK_BUCKET_COLOR: Record<string, string> = {
  white: '#E0F7FA', tiger: '#FF9500', mako: '#448AFF', blue: '#1DE9B6',
  hammerhead: '#AB47BC', whale: '#FFD700', bull: '#FF3D3D', other: '#80CBC4',
};

export function installExtendedLayers(map: maplibregl.Map, ctx: ExtendedLayerContext) {
  const { popup, pStyle, linkStyle, setSelectedShark } = ctx;
  void linkStyle; // available to handlers below

  // ─────────────────────────── LAYERS ───────────────────────────
      map.addLayer({ id: 'subcables-glow', type: 'line', source: 'submarine-cables', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#80DEEA'],
        'line-width': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,6],
        'line-opacity': 0.15, 'line-blur': 2,
      }});
      // Main line — Telegeography-assigned colour per cable.
      map.addLayer({ id: 'subcables-line', type: 'line', source: 'submarine-cables', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#80DEEA'],
        'line-width': ['interpolate',['linear'],['zoom'], 1,0.6, 5,1.1, 10,1.8, 14,2.6],
        'line-opacity': 0.78,
      }});
      // Landing stations — small dots, only visible past zoom 4 to avoid clutter.
      map.addLayer({ id: 'subcable-landings', type: 'circle', source: 'submarine-cable-landings', minzoom: 4, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 4,1.5, 8,2.5, 12,4],
        'circle-color': '#80DEEA',
        'circle-opacity': 0.75,
        'circle-stroke-width': 0.6,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'subcable-landing-label', type: 'symbol', source: 'submarine-cable-landings', minzoom: 7, layout: {
        'text-field': ['get', 'name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.1], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#80DEEA', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.85,
      }});

      // ── Refugee corridor arcs (drawn under markers) ──
      // Single blue arc family — refugee count → opacity + width
      map.addLayer({ id: 'refugee-arcs-glow', type: 'line', source: 'refugee-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': '#42A5F5',
        'line-width': ['interpolate',['linear'],['get','refugees'],
          100000, 2, 500000, 4, 1000000, 6, 3500000, 10],
        'line-opacity': 0.10, 'line-blur': 2,
      }});
      map.addLayer({ id: 'refugee-arcs-line', type: 'line', source: 'refugee-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': '#42A5F5',
        'line-width': ['interpolate',['linear'],['get','refugees'],
          100000, 0.7, 500000, 1.3, 1000000, 2.2, 3500000, 3.5],
        'line-opacity': ['interpolate',['linear'],['get','refugees'],
          100000, 0.30, 500000, 0.55, 1000000, 0.75, 3500000, 0.90],
      }});

      // ── Mineral supply chain arcs (drawn under markers) ──
      // Bloc-coded by the destination's bloc — shows where the supply lands.
      const MINERAL_ARC_COLOR: any = ['match', ['get','to_bloc'],
        'China',  '#FF6E40',
        'Korea',  '#1A237E',
        'Japan',  '#EC407A',
        'US',     '#448AFF',
        'EU',     '#3949AB',
        'Other',  '#9E9E9E',
        '#9E9E9E'];
      map.addLayer({ id: 'mineral-arcs-glow', type: 'line', source: 'mineral-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': MINERAL_ARC_COLOR,
        'line-width': ['interpolate',['linear'],['get','weight'], 1, 2, 2, 4, 3, 6],
        'line-opacity': 0.10, 'line-blur': 2,
      }});
      map.addLayer({ id: 'mineral-arcs-line', type: 'line', source: 'mineral-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': MINERAL_ARC_COLOR,
        'line-width': ['interpolate',['linear'],['get','weight'], 1, 0.7, 2, 1.2, 3, 2],
        'line-opacity': ['interpolate',['linear'],['get','weight'], 1, 0.35, 2, 0.55, 3, 0.75],
      }});

      // ── Shipping lanes — colour by cargo type, dashed when rerouted/disrupted ──
      const SL_COLOR: any = ['match', ['get','type'],
        'container', '#1976D2',
        'crude',     '#FFA000',
        'lng',       '#26C6DA',
        'bulk',      '#8D6E63',
        'chemical',  '#9C27B0',
        'mixed',     '#90A4AE',
        '#1976D2'];
      map.addLayer({ id: 'shipping-lanes-glow', type: 'line', source: 'shipping-lanes', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': SL_COLOR,
        'line-width': ['interpolate',['linear'],['get','importance'], 1, 6, 3, 2.5],
        'line-opacity': 0.10, 'line-blur': 2,
      }});
      map.addLayer({ id: 'shipping-lanes-line', type: 'line', source: 'shipping-lanes', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': SL_COLOR,
        'line-width': ['interpolate',['linear'],['get','importance'], 1, 2.2, 2, 1.5, 3, 1],
        'line-opacity': 0.75,
      }});
      // Disrupted/rerouted lanes get a dashed overlay
      map.addLayer({ id: 'shipping-lanes-disrupted', type: 'line', source: 'shipping-lanes',
        filter: ['in', ['get','status'], ['literal',['disrupted','rerouted']]],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': '#FF1744',
          'line-width': ['interpolate',['linear'],['get','importance'], 1, 1.5, 3, 0.8],
          'line-opacity': 0.85,
          'line-dasharray': [2, 3],
        }});

      // ── Rail freight corridors — earth-tone brown with subtle texture ──
      const RAIL_COLOR: any = ['match', ['get','status'],
        'operating', '#795548',
        'reduced',   '#A1887F',
        'planned',   '#448AFF',
        'sanctioned','#9E9E9E',
        '#795548'];
      map.addLayer({ id: 'rail-corridors-glow', type: 'line', source: 'rail-corridors', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': RAIL_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1, 4, 5, 6, 10, 8],
        'line-opacity': 0.12, 'line-blur': 2,
      }});
      map.addLayer({ id: 'rail-corridors-line', type: 'line', source: 'rail-corridors', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': RAIL_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1, 1.5, 5, 2.5, 10, 3.5],
        'line-opacity': 0.85,
        'line-dasharray': [4, 1.5],   // crosstie-evoking dash
      }});

      // ── Pipelines (drawn under markers, after submarine cables) ──
      // Colour by status: green=operating, amber=partial, red=damaged/suspended,
      // blue=planned, grey=cancelled. Type encoded by dash pattern.
      const PIPE_COLOR: any = ['match', ['get','status'],
        'operating', '#00E676',
        'partial',   '#FFB300',
        'suspended', '#FF6B00',
        'damaged',   '#FF1744',
        'planned',   '#448AFF',
        'cancelled', '#9E9E9E',
        '#9E9E9E'];
      map.addLayer({ id: 'pipelines-glow', type: 'line', source: 'pipelines', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': PIPE_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
        'line-opacity': 0.10, 'line-blur': 2,
      }});
      map.addLayer({ id: 'pipelines-line', type: 'line', source: 'pipelines', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': PIPE_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1,1.2, 5,2, 10,2.8],
        'line-opacity': 0.85,
      }});
      // Hairline + chevron labels — show pipeline name when zoomed in
      map.addLayer({ id: 'pipelines-label', type: 'symbol', source: 'pipelines', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'symbol-placement': 'line', 'text-allow-overlap': false,
      }, paint: {
        'text-color': PIPE_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});

      // ── Influence Ops: operator → target arcs (drawn under all markers) ──
      const BLOC_INF_COLOR: any = ['match', ['get','bloc'],
        'Russia', '#E53935',
        'China',  '#FF6E40',
        'Iran',   '#7B1FA2',
        'NK',     '#616161',
        'Israel', '#00897B',
        'Turkey', '#FFB300',
        'Saudi',  '#43A047',
        'UAE',    '#FFD700',
        'India',  '#FF9800',
        'US',     '#448AFF',
        'UK',     '#1A237E',
        'Other',  '#9E9E9E',
        '#9E9E9E'];
      map.addLayer({ id: 'influence-arcs-glow', type: 'line', source: 'influence-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': BLOC_INF_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1,2.5, 5,4, 10,6],
        'line-opacity': 0.08, 'line-blur': 2,
      }});
      map.addLayer({ id: 'influence-arcs-line', type: 'line', source: 'influence-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': BLOC_INF_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1,0.6, 5,1, 10,1.5],
        'line-opacity': 0.45,
      }});

      // ── Cyber: attacker → target arcs (sister of influence-arcs, dashed) ──
      map.addLayer({ id: 'cyber-arcs-glow', type: 'line', source: 'cyber-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': BLOC_INF_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
        'line-opacity': 0.10, 'line-blur': 2,
      }});
      map.addLayer({ id: 'cyber-arcs-line', type: 'line', source: 'cyber-arcs', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': BLOC_INF_COLOR,
        'line-width': ['interpolate',['linear'],['zoom'], 1,0.8, 5,1.3, 10,2],
        'line-opacity': 0.55,
        // Dashed pattern distinguishes cyber arcs from influence-ops arcs
        'line-dasharray': [3, 2],
      }});

      map.addLayer({ id: 'jam-daily-fill', type: 'fill', source: 'gps-jamming-daily', paint: {
        'fill-color': ['interpolate', ['linear'], ['get', 'bad_pct'],
          50, '#FFB300',
          75, '#FF6F00',
          90, '#D50000',
          100, '#B71C1C',
        ],
        'fill-opacity': ['interpolate', ['linear'], ['get', 'bad_pct'], 50, 0.15, 100, 0.45],
      }});
      map.addLayer({ id: 'jam-daily-outline', type: 'line', source: 'gps-jamming-daily', paint: {
        'line-color': '#FF6F00', 'line-width': 0.5, 'line-opacity': 0.5,
      }});
      map.addLayer({ id: 'shark-track-glow', type: 'line', source: 'shark-track', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#1DE9B6'],
        'line-width': ['interpolate',['linear'],['zoom'], 1,4, 5,8, 10,14],
        'line-opacity': 0.15, 'line-blur': 3,
      }});
      map.addLayer({ id: 'shark-track-line', type: 'line', source: 'shark-track', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#1DE9B6'],
        'line-width': ['interpolate',['linear'],['zoom'], 1,1.5, 5,2.5, 10,3.5],
        'line-opacity': 0.75,
      }});
      map.addLayer({ id: 'shark-track-pings', type: 'circle', source: 'shark-track-pings', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.2, 5,2, 10,3],
        'circle-color': ['coalesce', ['get', 'color'], '#1DE9B6'],
        'circle-opacity': 0.7,
        'circle-stroke-width': 0.5, 'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.6,
      }});

      // Tagged sharks (OCEARCH) — color by species bucket
      map.addLayer({ id: 'shark-glow', type: 'circle', source: 'sharks', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,10, 10,18],
        'circle-color': '#1DE9B6', 'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'shark-dots', type: 'circle', source: 'sharks', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
        'circle-color': ['match', ['get','bucket'],
          'white',      '#E0F7FA',
          'tiger',      '#FF9500',
          'mako',       '#448AFF',
          'blue',       '#1DE9B6',
          'hammerhead', '#AB47BC',
          'whale',      '#FFD700',
          'bull',       '#FF3D3D',
          /* other */   '#80CBC4'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#1DE9B6', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'shark-label', type: 'symbol', source: 'sharks', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.4], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#1DE9B6', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Fish stock health — diamond markers, color by status. Diamond shape
      // distinguishes a managed fishery from a live shark dot at a glance.
      map.addLayer({ id: 'fish-stocks-glow', type: 'circle', source: 'fish-stocks', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,16, 10,28],
        'circle-color': ['match', ['get','status'],
          'collapsed',  '#FF1744',
          'overfished', '#FF6B00',
          'recovering', '#FFD500',
          'fully',      '#448AFF',
          'healthy',    '#00E676',
          /* fallback */ '#80CBC4'],
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'fish-stocks-dots', type: 'circle', source: 'fish-stocks', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
        'circle-color': ['match', ['get','status'],
          'collapsed',  '#FF1744',
          'overfished', '#FF6B00',
          'recovering', '#FFD500',
          'fully',      '#448AFF',
          'healthy',    '#00E676',
          '#80CBC4'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'fish-stocks-label', type: 'symbol', source: 'fish-stocks', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','status'],
          'collapsed',  '#FF1744',
          'overfished', '#FF6B00',
          'recovering', '#FFD500',
          'fully',      '#448AFF',
          'healthy',    '#00E676',
          '#80CBC4'],
        'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.85,
      }});

      // Fishing effort (GFW) — graduated circles scaling with total vessel-hours.
      // Big amber/red rings for heavily-fished zones, faint where activity is low.
      map.addLayer({ id: 'fishing-effort-glow', type: 'circle', source: 'fishing-effort', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 6, 0.25, 14, 0.5, 22, 0.75, 32, 1, 44],
        'circle-color': ['interpolate',['linear'],['get','intensity'],
          0, '#FFD500', 0.5, '#FF6B00', 1, '#FF1744'],
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'fishing-effort-ring', type: 'circle', source: 'fishing-effort', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 9, 0.5, 14, 0.75, 19, 1, 26],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2,
        'circle-stroke-color': ['interpolate',['linear'],['get','intensity'],
          0, '#FFD500', 0.5, '#FF6B00', 1, '#FF1744'],
        'circle-stroke-opacity': 0.85,
      }});
      map.addLayer({ id: 'fishing-effort-dots', type: 'circle', source: 'fishing-effort', paint: {
        'circle-radius': 3,
        'circle-color': ['interpolate',['linear'],['get','intensity'],
          0, '#FFD500', 0.5, '#FF6B00', 1, '#FF1744'],
        'circle-opacity': 0.95,
      }});
      map.addLayer({ id: 'fishing-effort-label', type: 'symbol', source: 'fishing-effort', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.8], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#FF6B00', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.85,
      }});

      // US commercial landings — gold rings sized by $ value. Distinct visual
      // language from fishing-effort (orange/red rings) so the two co-exist.
      map.addLayer({ id: 'fish-landings-glow', type: 'circle', source: 'fish-landings', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 12, 0.5, 18, 0.75, 26, 1, 36],
        'circle-color': '#FFD500', 'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'fish-landings-dots', type: 'circle', source: 'fish-landings', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 6, 0.5, 9, 0.75, 12, 1, 16],
        'circle-color': '#FFD500',
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#D4AF37',
        'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'fish-landings-label', type: 'symbol', source: 'fish-landings', minzoom: 3, layout: {
        'text-field': ['format',
          ['get','state'], { 'font-scale': 1 },
          '\n', {},
          ['concat', '$', ['get','total_dollars_compact']], { 'font-scale': 0.85, 'text-color': '#D4AF37' },
        ],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.6], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#FFD500', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9,
      }});

      // Oil & Gas — graduated rings sized by BOE/day. Marker colour shows the
      // dominant product: amber for oil, sky-blue for gas, ochre for mixed.
      map.addLayer({ id: 'oil-gas-glow', type: 'circle', source: 'oil-gas', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 12, 0.5, 18, 0.75, 26, 1, 36],
        'circle-color': ['match', ['get','type'],
          'oil',   '#FFA000',
          'gas',   '#03A9F4',
          'mixed', '#FFCA28',
          '#FFA000'],
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'oil-gas-dots', type: 'circle', source: 'oil-gas', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 6, 0.5, 9, 0.75, 12, 1, 15],
        'circle-color': ['match', ['get','type'],
          'oil',   '#FFA000',
          'gas',   '#03A9F4',
          'mixed', '#FFCA28',
          '#FFA000'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'oil-gas-label', type: 'symbol', source: 'oil-gas', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','type'],
          'oil',   '#FFA000',
          'gas',   '#03A9F4',
          'mixed', '#FFCA28',
          '#FFA000'],
        'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9,
      }});

      // Tier-1 mines — square markers with commodity-specific colour. Square
      // shape reads as "industrial site" vs round oil/gas/fish markers.
      const MINE_COLOR: any = ['match', ['get','commodity'],
        'copper',     '#D84315',
        'gold',       '#FFD700',
        'iron',       '#8D6E63',
        'lithium',    '#E1F5FE',
        'nickel',     '#90CAF9',
        'coal',       '#37474F',
        'rare-earth', '#CE93D8',
        'uranium',    '#76FF03',
        'diamond',    '#B3E5FC',
        'silver',     '#CFD8DC',
        'bauxite',    '#FFAB40',
        'cobalt',     '#5C6BC0',
        'platinum',   '#ECEFF1',
        /* fallback */'#B0BEC5'];
      map.addLayer({ id: 'mines-glow', type: 'circle', source: 'mines', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 6, 0.25, 12, 0.5, 18, 0.75, 26, 1, 36],
        'circle-color': MINE_COLOR,
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      // Square-ish mine markers via stroke + small radius for industrial feel
      map.addLayer({ id: 'mines-dots', type: 'circle', source: 'mines', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 6, 0.5, 9, 0.75, 11, 1, 14],
        'circle-color': MINE_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'mines-label', type: 'symbol', source: 'mines', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': MINE_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.9,
      }});

      // Refineries (downstream) — cyan rings to distinguish from amber upstream.
      const REF_COLOR: any = ['match', ['get','status'],
        'operating',      '#00BCD4',
        'restructuring',  '#FF9500',
        'idle',           '#9E9E9E',
        'closing',        '#FF1744',
        '#00BCD4'];
      map.addLayer({ id: 'refineries-glow', type: 'circle', source: 'refineries', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 11, 0.5, 17, 0.75, 24, 1, 32],
        'circle-color': REF_COLOR,
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'refineries-dots', type: 'circle', source: 'refineries', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 6, 0.5, 8, 0.75, 11, 1, 14],
        'circle-color': REF_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'refineries-label', type: 'symbol', source: 'refineries', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': REF_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9,
      }});

      // Forests — green rings sized by area, colour by intactness status.
      // Bright green = intact, amber = degraded, red = critical, teal = recovering.
      const FOREST_COLOR: any = ['match', ['get','status'],
        'intact',     '#4CAF50',
        'degraded',   '#FF9800',
        'critical',   '#FF1744',
        'recovering', '#00BFA5',
        '#4CAF50'];
      map.addLayer({ id: 'forests-glow', type: 'circle', source: 'forests', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 18, 0.5, 30, 0.75, 44, 1, 60],
        'circle-color': FOREST_COLOR,
        'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'forests-dots', type: 'circle', source: 'forests', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 11, 0.75, 16, 1, 22],
        'circle-color': FOREST_COLOR,
        'circle-opacity': 0.55,
        'circle-stroke-width': 2,
        'circle-stroke-color': FOREST_COLOR,
        'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'forests-label', type: 'symbol', source: 'forests', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.6], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': FOREST_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // Central Bank Rates — gold rings, size by absolute rate magnitude.
      // Colour by recent direction: green=cut, red=hike, neutral=hold.
      const CB_DIR_COLOR: any = ['case',
        ['<', ['coalesce', ['get', 'change_bps'], 0], 0], '#00E676',
        ['>', ['coalesce', ['get', 'change_bps'], 0], 0], '#FF1744',
        '#FFD700'];
      map.addLayer({ id: 'cb-rates-glow', type: 'circle', source: 'cb-rates', paint: {
        'circle-radius': ['interpolate',['linear'],['get','current_rate'],
          0, 8, 5, 16, 10, 24, 20, 36],
        'circle-color': CB_DIR_COLOR,
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'cb-rates-dots', type: 'circle', source: 'cb-rates', paint: {
        'circle-radius': ['interpolate',['linear'],['get','current_rate'],
          0, 4, 5, 8, 10, 12, 20, 18],
        'circle-color': CB_DIR_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFD700',
        'circle-stroke-opacity': 0.8,
      }});
      map.addLayer({ id: 'cb-rates-label', type: 'symbol', source: 'cb-rates', minzoom: 2, layout: {
        'text-field': ['format',
          ['get', 'iso'], { 'font-scale': 1 },
          '\n', {},
          ['concat', ['to-string', ['get', 'current_rate_display']], '%'], { 'font-scale': 0.95, 'text-color': '#FFD700' },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#FFD700', 'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // Power plants — graduated rings sized by MW capacity, coloured by type.
      const POWER_COLOR: any = ['match', ['get','type'],
        'hydro',          '#00BCD4',
        'nuclear',        '#76FF03',
        'coal',           '#37474F',
        'gas',            '#FFB300',
        'solar',          '#FDD835',
        'wind',           '#B3E5FC',
        'geothermal',     '#FF5722',
        'pumped-storage', '#9C27B0',
        '#FFEB3B'];
      map.addLayer({ id: 'power-plants-glow', type: 'circle', source: 'power-plants', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 6, 0.25, 14, 0.5, 22, 0.75, 32, 1, 44],
        'circle-color': POWER_COLOR,
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'power-plants-dots', type: 'circle', source: 'power-plants', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 13, 1, 16],
        'circle-color': POWER_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'power-plants-label', type: 'symbol', source: 'power-plants', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': POWER_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // Military bases — colour by operator bloc, size by personnel.
      // Square/diamond visual via thick stroke so they read as installations
      // rather than the round point-markers used elsewhere.
      const BLOC_COLOR: any = ['match', ['get','bloc'],
        'US',     '#448AFF',
        'NATO',   '#1E88E5',
        'UK',     '#1A237E',
        'France', '#7986CB',
        'Russia', '#E53935',
        'China',  '#FF6E40',
        'India',  '#FF9800',
        'Iran',   '#7B1FA2',
        'Israel', '#00897B',
        'Other',  '#9E9E9E',
        '#9E9E9E'];
      map.addLayer({ id: 'military-bases-glow', type: 'circle', source: 'military-bases', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 12, 0.5, 18, 0.75, 26, 1, 36],
        'circle-color': BLOC_COLOR,
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'military-bases-dots', type: 'circle', source: 'military-bases', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 6, 0.5, 9, 0.75, 12, 1, 15],
        'circle-color': BLOC_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.8,
        'circle-stroke-color': '#fff',
        'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'military-bases-label', type: 'symbol', source: 'military-bases', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': BLOC_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // Spaceports — coloured by operator bloc, sized by 2024 launch cadence.
      // Pulsing white outline gives them a "transmission" feel distinct from
      // military bases (which use grey-tinted rings).
      const SP_COLOR: any = ['match', ['get','bloc'],
        'US',     '#448AFF',
        'China',  '#FF6E40',
        'Russia', '#E53935',
        'ESA',    '#FFC107',
        'Japan',  '#EC407A',
        'India',  '#FF9800',
        'Iran',   '#7B1FA2',
        'NK',     '#616161',
        'Israel', '#00897B',
        'UK',     '#1A237E',
        'Other',  '#80DEEA',
        '#80DEEA'];
      map.addLayer({ id: 'spaceports-glow', type: 'circle', source: 'spaceports', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 6, 0.25, 14, 0.5, 24, 0.75, 36, 1, 50],
        'circle-color': SP_COLOR,
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'spaceports-ring', type: 'circle', source: 'spaceports', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 10, 0.5, 15, 0.75, 21, 1, 28],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': SP_COLOR,
        'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'spaceports-dots', type: 'circle', source: 'spaceports', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 5, 0.5, 7, 0.75, 10, 1, 13],
        'circle-color': SP_COLOR,
        'circle-opacity': 0.95,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff',
        'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'spaceports-label', type: 'symbol', source: 'spaceports', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': SP_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // Air quality — colour by US AQI category, size by AQI magnitude.
      // Pulse-friendly soft glow keeps "good" cities visible without overpowering.
      const AQ_COLOR: any = ['match', ['get','category'],
        'good',           '#00E676',
        'moderate',       '#FFEB3B',
        'usg',            '#FF9800',
        'unhealthy',      '#FF1744',
        'very-unhealthy', '#AA00FF',
        'hazardous',      '#7B1FA2',
        'unknown',        '#9E9E9E',
        '#9E9E9E'];
      map.addLayer({ id: 'air-quality-glow', type: 'circle', source: 'air-quality', paint: {
        'circle-radius': ['interpolate',['linear'],['coalesce',['get','us_aqi'],50],
          0, 8, 50, 12, 100, 18, 150, 26, 200, 36, 300, 48, 500, 60],
        'circle-color': AQ_COLOR,
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'air-quality-dots', type: 'circle', source: 'air-quality', paint: {
        'circle-radius': ['interpolate',['linear'],['coalesce',['get','us_aqi'],50],
          0, 4, 50, 6, 100, 9, 150, 12, 200, 16, 300, 20, 500, 26],
        'circle-color': AQ_COLOR,
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'air-quality-label', type: 'symbol', source: 'air-quality', minzoom: 2, layout: {
        'text-field': ['format',
          ['get', 'name'], { 'font-scale': 1 },
          '\n', {},
          ['concat', 'AQI ', ['to-string', ['coalesce', ['get', 'us_aqi'], '?']]], { 'font-scale': 0.9 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': AQ_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // Disease outbreaks — colour by dominant disease family at the country.
      // Glow opacity scales with recency: bright halo for fresh outbreaks,
      // faded for older entries still in the rolling window.
      const OUTBREAK_COLOR: any = ['match', ['get','dominant_family'],
        'vhf',         '#FF1744',
        'respiratory', '#FF6B00',
        'vector',      '#AB47BC',
        'bacterial',   '#26A69A',
        'vpd',         '#FFEB3B',
        'mpox',        '#42A5F5',
        'other',       '#9E9E9E',
        '#9E9E9E'];
      map.addLayer({ id: 'outbreaks-glow', type: 'circle', source: 'outbreaks', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 16, 0.5, 26, 0.75, 38, 1, 52],
        'circle-color': OUTBREAK_COLOR,
        // recency-driven opacity: fresher = brighter
        'circle-opacity': ['interpolate',['linear'],['get','recency'], 0, 0.05, 0.5, 0.12, 1, 0.20],
        'circle-blur': 1,
      }});
      map.addLayer({ id: 'outbreaks-dots', type: 'circle', source: 'outbreaks', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 18],
        'circle-color': OUTBREAK_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 1.8,
        'circle-stroke-color': '#000',
        'circle-stroke-opacity': 0.55,
      }});
      map.addLayer({ id: 'outbreaks-label', type: 'symbol', source: 'outbreaks', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': OUTBREAK_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // Influence Ops — named-campaign operator markers (square-ish with
      // doubled stroke for "command-post" feel, distinct from outbreaks).
      map.addLayer({ id: 'influence-ops-glow', type: 'circle', source: 'influence-ops', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 7, 0.25, 14, 0.5, 22, 0.75, 32, 1, 42],
        'circle-color': BLOC_INF_COLOR,
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'influence-ops-dots', type: 'circle', source: 'influence-ops', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 18],
        'circle-color': BLOC_INF_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#fff',
        'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'influence-ops-label', type: 'symbol', source: 'influence-ops', minzoom: 2, layout: {
        'text-field': ['concat', ['get','operator'], ' · ', ['to-string', ['get','total_count']], ' ops'],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': BLOC_INF_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // Influence Ops — takedowns layer (separate source, ring style)
      map.addLayer({ id: 'influence-takedowns-glow', type: 'circle', source: 'influence-takedowns', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 6, 0.25, 13, 0.5, 20, 0.75, 30, 1, 40],
        'circle-color': BLOC_INF_COLOR,
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'influence-takedowns-ring', type: 'circle', source: 'influence-takedowns', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 9, 0.5, 14, 0.75, 19, 1, 26],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': BLOC_INF_COLOR,
        'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'influence-takedowns-dots', type: 'circle', source: 'influence-takedowns', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 5, 0.5, 7, 0.75, 10, 1, 13],
        'circle-color': BLOC_INF_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 1.2,
        'circle-stroke-color': '#fff',
        'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'influence-takedowns-label', type: 'symbol', source: 'influence-takedowns', minzoom: 3, layout: {
        'text-field': ['concat', ['get','operator'], ' · ', ['get','assets_display']],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': BLOC_INF_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.9,
      }});

      // ── Cyber: target country markers (one dot per attacked country) ──
      // Colour by dominant attacker bloc against that target — tells the
      // "who keeps hitting us" story at a glance.
      // Reuses BLOC_INF_COLOR but maps to a `dominant_bloc` property.
      const CYBER_TARGET_COLOR: any = ['match', ['get','dominant_bloc'],
        'Russia',   '#E53935',
        'China',    '#FF6E40',
        'NK',       '#9E9E9E',
        'Iran',     '#7B1FA2',
        'Israel',   '#00897B',
        'US',       '#448AFF',
        'Criminal', '#FF1744',
        'Hacktivist','#FFEB3B',
        '#9E9E9E'];
      map.addLayer({ id: 'cyber-targets-glow', type: 'circle', source: 'cyber-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 7, 0.25, 14, 0.5, 22, 0.75, 32, 1, 44],
        'circle-color': CYBER_TARGET_COLOR,
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'cyber-targets-dots', type: 'circle', source: 'cyber-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 18],
        'circle-color': CYBER_TARGET_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FF1744',  // red border = "got hit"
        'circle-stroke-opacity': 0.55,
      }});
      map.addLayer({ id: 'cyber-targets-label', type: 'symbol', source: 'cyber-targets', minzoom: 3, layout: {
        'text-field': ['concat', ['get','target_country'], ' · ', ['to-string', ['get','total_count']], ' attacks'],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': CYBER_TARGET_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // ── Ransomware tracker ── magenta gradient by victim count
      const RANSOM_COLOR: any = ['interpolate',['linear'],['get','victim_count'],
        1,  '#F48FB1',
        3,  '#EC407A',
        8,  '#D81B60',
        20, '#C2185B',
        50, '#880E4F'];
      map.addLayer({ id: 'ransomware-glow', type: 'circle', source: 'ransomware', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 16, 0.5, 26, 0.75, 38, 1, 50],
        'circle-color': RANSOM_COLOR,
        'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'ransomware-dots', type: 'circle', source: 'ransomware', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 18],
        'circle-color': RANSOM_COLOR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFB3C7',
        'circle-stroke-opacity': 0.55,
      }});
      map.addLayer({ id: 'ransomware-label', type: 'symbol', source: 'ransomware', minzoom: 3, layout: {
        'text-field': ['concat', ['get','iso'], ' · ', ['to-string', ['get','victim_count']], ' victims'],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': RANSOM_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // US Macro Indicators — gold "command-post" marker over NYC, large
      // ring style to invite the click into the dense popup panel.
      map.addLayer({ id: 'macro-us-glow', type: 'circle', source: 'macro-us', paint: {
        'circle-radius': 28, 'circle-color': '#FFC400',
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'macro-us-ring', type: 'circle', source: 'macro-us', paint: {
        'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2, 'circle-stroke-color': '#FFC400', 'circle-stroke-opacity': 0.8,
      }});
      map.addLayer({ id: 'macro-us-dots', type: 'circle', source: 'macro-us', paint: {
        'circle-radius': 8, 'circle-color': '#FFC400',
        'circle-opacity': 0.92,
        'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.5,
      }});
      // ── Refugee asylum markers ──
      map.addLayer({ id: 'refugee-asylum-glow', type: 'circle', source: 'refugee-asylum', paint: {
        'circle-radius': ['interpolate',['linear'],['get','total_refugees'],
          100000, 8, 1000000, 18, 5000000, 36, 10000000, 50],
        'circle-color': '#42A5F5', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'refugee-asylum-dots', type: 'circle', source: 'refugee-asylum', paint: {
        'circle-radius': ['interpolate',['linear'],['get','total_refugees'],
          100000, 4, 1000000, 8, 5000000, 14, 10000000, 18],
        'circle-color': '#42A5F5', 'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'refugee-asylum-label', type: 'symbol', source: 'refugee-asylum', minzoom: 2, layout: {
        'text-field': ['format',
          ['get','name'], { 'font-scale': 1 },
          '\n', {},
          ['get','total_display'], { 'font-scale': 0.85, 'text-color': '#90CAF9' },
        ],
        'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#42A5F5',
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Data centers — cyan dots, hyperscaler hue per provider ──
      const DC_COLOR: any = ['match', ['get','type'],
        'aws',       '#FF9900',
        'azure',     '#00A4EF',
        'gcp',       '#4285F4',
        'oracle',    '#C74634',
        'alibaba',   '#FF6E40',
        'tencent',   '#00A0E9',
        'colo',      '#80DEEA',
        'ixp',       '#FFD600',
        'sovereign', '#9C27B0',
        '#80DEEA'];
      map.addLayer({ id: 'data-centers-glow', type: 'circle', source: 'data-centers', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 5, 0.25, 10, 0.5, 16, 0.75, 22, 1, 30],
        'circle-color': DC_COLOR, 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'data-centers-dots', type: 'circle', source: 'data-centers', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 5, 0.5, 7, 0.75, 9, 1, 12],
        'circle-color': DC_COLOR, 'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.55,
      }});
      map.addLayer({ id: 'data-centers-label', type: 'symbol', source: 'data-centers', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.3], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': DC_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.9,
      }});

      // ── GPU clusters — hot-pink "compute beacons" with ring inside dot ──
      // Distinctly different visual from data-centers: bigger, brighter, pulsing.
      map.addLayer({ id: 'gpu-clusters-glow', type: 'circle', source: 'gpu-clusters', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 12, 0.25, 22, 0.5, 32, 0.75, 44, 1, 60],
        'circle-color': '#EC407A', 'circle-opacity': 0.18, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'gpu-clusters-ring', type: 'circle', source: 'gpu-clusters', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 14, 0.5, 20, 0.75, 28, 1, 38],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#FF80AB',
        'circle-stroke-opacity': 0.85,
      }});
      map.addLayer({ id: 'gpu-clusters-dots', type: 'circle', source: 'gpu-clusters', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 18],
        'circle-color': '#EC407A', 'circle-opacity': 0.95,
        'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.65,
      }});
      map.addLayer({ id: 'gpu-clusters-label', type: 'symbol', source: 'gpu-clusters', minzoom: 2, layout: {
        'text-field': ['format',
          ['get','name'], { 'font-scale': 1 },
          '\n', {},
          ['get','headline'], { 'font-scale': 0.85, 'text-color': '#F8BBD0' },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.6], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#EC407A',
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Air cargo hubs — amber dots sized by tonnage ──
      map.addLayer({ id: 'air-cargo-glow', type: 'circle', source: 'air-cargo', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 14, 0.5, 22, 0.75, 30, 1, 40],
        'circle-color': '#FF9800', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'air-cargo-dots', type: 'circle', source: 'air-cargo', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3, 0.25, 5, 0.5, 8, 0.75, 11, 1, 14],
        'circle-color': '#FF9800', 'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FFE082', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'air-cargo-label', type: 'symbol', source: 'air-cargo', minzoom: 2, layout: {
        'text-field': ['format',
          ['get','iata'], { 'font-scale': 1 },
          '\n', {},
          ['concat', ['get','cargo_display'], ' Mt'], { 'font-scale': 0.85 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#FF9800',
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // ── Network interference (OONI) — peach gradient by severity ──
      const NI_COLOR: any = ['match', ['get','severity'],
        'critical', '#FF1744',
        'elevated', '#FF6B00',
        'normal',   '#FFAB91',
        '#FFAB91'];
      map.addLayer({ id: 'network-interference-glow', type: 'circle', source: 'network-interference', paint: {
        'circle-radius': ['interpolate',['linear'],['get','anomaly_rate'],
          0.07, 12, 0.15, 20, 0.30, 32, 0.55, 50],
        'circle-color': NI_COLOR, 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'network-interference-dots', type: 'circle', source: 'network-interference', paint: {
        'circle-radius': ['interpolate',['linear'],['get','anomaly_rate'],
          0.07, 5, 0.15, 8, 0.30, 12, 0.55, 18],
        'circle-color': NI_COLOR, 'circle-opacity': 0.92,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFCCBC', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'network-interference-label', type: 'symbol', source: 'network-interference', minzoom: 2, layout: {
        'text-field': ['format',
          ['get','iso'], { 'font-scale': 1 },
          '\n', {},
          ['get','rate_display'], { 'font-scale': 0.85 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': NI_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Coral reefs — pink-coral gradient by status ──
      const REEF_COLOR: any = ['match', ['get','status'],
        'intact',     '#F48FB1',
        'degraded',   '#FF9800',
        'critical',   '#FF1744',
        'recovering', '#00BFA5',
        '#F48FB1'];
      map.addLayer({ id: 'coral-reefs-glow', type: 'circle', source: 'coral-reefs', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 16, 0.5, 26, 0.75, 38, 1, 50],
        'circle-color': REEF_COLOR,
        'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'coral-reefs-dots', type: 'circle', source: 'coral-reefs', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 18],
        'circle-color': REEF_COLOR,
        'circle-opacity': 0.55,
        'circle-stroke-width': 2,
        'circle-stroke-color': REEF_COLOR,
        'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'coral-reefs-label', type: 'symbol', source: 'coral-reefs', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': REEF_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // ── Sanctions geography — burnt-orange severity gradient ──
      const SANC_COLOR: any = ['match', ['get','severity'],
        'critical', '#D32F2F',
        'major',    '#FF6B00',
        'moderate', '#FF8A65',
        'minor',    '#FFCCBC',
        '#FFCCBC'];
      map.addLayer({ id: 'sanctions-glow', type: 'circle', source: 'sanctions', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 16, 0.5, 26, 0.75, 38, 1, 52],
        'circle-color': SANC_COLOR, 'circle-opacity': 0.13, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sanctions-dots', type: 'circle', source: 'sanctions', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 4, 0.25, 7, 0.5, 10, 0.75, 14, 1, 19],
        'circle-color': SANC_COLOR, 'circle-opacity': 0.92,
        'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'sanctions-label', type: 'symbol', source: 'sanctions', minzoom: 2, layout: {
        'text-field': ['format',
          ['get','iso'], { 'font-scale': 1 },
          '\n', {},
          ['get','count_display'], { 'font-scale': 0.85 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': SANC_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Drug seizures — purple-magenta gradient by drug class ──
      const DRUG_COLOR: any = ['match', ['get','drug'],
        'cocaine',         '#E1BEE7',
        'heroin',          '#8E24AA',
        'fentanyl',        '#FF1744',
        'methamphetamine', '#00BCD4',
        'mdma',            '#FFD600',
        'cannabis',        '#4CAF50',
        'precursors',      '#FF9800',
        'mixed',           '#BA68C8',
        '#BA68C8'];
      map.addLayer({ id: 'drug-seizures-glow', type: 'circle', source: 'drug-seizures', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 8, 0.25, 14, 0.5, 22, 0.75, 32, 1, 44],
        'circle-color': DRUG_COLOR, 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'drug-seizures-dots', type: 'circle', source: 'drug-seizures', paint: {
        'circle-radius': ['interpolate',['linear'],['get','intensity'],
          0, 3.5, 0.25, 5.5, 0.5, 8, 0.75, 11, 1, 14],
        'circle-color': DRUG_COLOR, 'circle-opacity': 0.92,
        'circle-stroke-width': 1.8,
        'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.55,
      }});
      map.addLayer({ id: 'drug-seizures-label', type: 'symbol', source: 'drug-seizures', minzoom: 3, layout: {
        'text-field': ['get','quantity_display'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.3], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': DRUG_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      // ── Sea ice extent — ice-blue "command-post" markers at each pole ──
      // Colour shifts by percentile vs 1981-2010 climatology: blue if normal,
      // amber if below 25th percentile, red if below 10th.
      const ICE_COLOR: any = ['match', ['get','percentile'],
        '<10',    '#FF1744',
        '10-25',  '#FF6B00',
        '25-50',  '#FFB300',
        '50-75',  '#42A5F5',
        '75-90',  '#90CAF9',
        '>90',    '#E1F5FE',
        '#90CAF9'];
      map.addLayer({ id: 'sea-ice-glow', type: 'circle', source: 'sea-ice', paint: {
        'circle-radius': 32, 'circle-color': ICE_COLOR,
        'circle-opacity': 0.13, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sea-ice-ring', type: 'circle', source: 'sea-ice', paint: {
        'circle-radius': 18, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2, 'circle-stroke-color': ICE_COLOR, 'circle-stroke-opacity': 0.85,
      }});
      map.addLayer({ id: 'sea-ice-dots', type: 'circle', source: 'sea-ice', paint: {
        'circle-radius': 9, 'circle-color': ICE_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'sea-ice-label', type: 'symbol', source: 'sea-ice', minzoom: 1, layout: {
        'text-field': ['format',
          ['get','pole'], { 'font-scale': 1 },
          '\n', {},
          ['get','headline'], { 'font-scale': 0.85 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.8], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ICE_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Active volcanoes — red-orange glow, triangle-like via concentric stroke ──
      // Recency tweaks opacity: fresher report = brighter halo.
      map.addLayer({ id: 'volcanoes-glow', type: 'circle', source: 'volcanoes', paint: {
        'circle-radius': 18,
        'circle-color': '#FF5722',
        'circle-opacity': ['interpolate',['linear'],['coalesce',['get','days_ago'],999],
          0, 0.28, 7, 0.18, 30, 0.10, 365, 0.06],
        'circle-blur': 1,
      }});
      map.addLayer({ id: 'volcanoes-dots', type: 'circle', source: 'volcanoes', paint: {
        'circle-radius': ['interpolate',['linear'],['coalesce',['get','days_ago'],999],
          0, 7, 30, 5, 365, 4],
        'circle-color': '#FF5722',
        'circle-opacity': 0.92,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFD180',
        'circle-stroke-opacity': 0.75,
      }});
      map.addLayer({ id: 'volcanoes-label', type: 'symbol', source: 'volcanoes', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.3], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#FF7043',
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Active tropical cyclones ──
      // Track polyline (history), then storm-eye marker on top
      map.addLayer({ id: 'storm-tracks-line', type: 'line', source: 'storm-tracks', layout: {
        'line-cap': 'round', 'line-join': 'round',
      }, paint: {
        'line-color': '#26C6DA',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 1, 5, 1.5, 10, 2.5],
        'line-opacity': 0.7,
        'line-dasharray': [2, 2],
      }});
      map.addLayer({ id: 'storms-glow', type: 'circle', source: 'storms', paint: {
        'circle-radius': ['interpolate',['linear'],['coalesce',['get','max_wind_mph'],50],
          0, 12, 39, 16, 74, 24, 96, 32, 111, 40, 130, 48, 157, 60],
        'circle-color': ['interpolate',['linear'],['coalesce',['get','max_wind_mph'],50],
          0, '#80DEEA', 39, '#26C6DA', 74, '#FFC400', 96, '#FF9800', 111, '#FF6B00', 130, '#FF1744', 157, '#7B1FA2'],
        'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'storms-dots', type: 'circle', source: 'storms', paint: {
        'circle-radius': ['interpolate',['linear'],['coalesce',['get','max_wind_mph'],50],
          0, 5, 39, 7, 74, 10, 111, 14, 157, 18],
        'circle-color': ['interpolate',['linear'],['coalesce',['get','max_wind_mph'],50],
          0, '#80DEEA', 39, '#26C6DA', 74, '#FFC400', 96, '#FF9800', 111, '#FF6B00', 130, '#FF1744', 157, '#7B1FA2'],
        'circle-opacity': 0.95,
        'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'storms-label', type: 'symbol', source: 'storms', minzoom: 2, layout: {
        'text-field': ['format',
          ['get','title'], { 'font-scale': 1 },
          '\n', {},
          ['concat', ['coalesce',['get','max_wind_mph'],'?'], ' mph'], { 'font-scale': 0.85 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#26C6DA',
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

      // ── Mineral supply chain nodes — shape per stage, colour per bloc ──
      const STAGE_RADIUS_MUL: any = ['match', ['get','stage'],
        'mine',      1.4,
        'refining',  1.1,
        'cathode',   1.0,
        'cell',      1.2,
        'pack',      1.0,
        'oem',       1.3, 1];
      const MINERAL_COLOR: any = ['match', ['get','bloc'],
        'China', '#FF6E40', 'Korea', '#1A237E', 'Japan', '#EC407A',
        'US',    '#448AFF', 'EU',    '#3949AB', 'Other', '#80CBC4',
        '#80CBC4'];
      map.addLayer({ id: 'mineral-nodes-glow', type: 'circle', source: 'mineral-nodes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1, ['*', STAGE_RADIUS_MUL, 8], 5, ['*', STAGE_RADIUS_MUL, 14], 10, ['*', STAGE_RADIUS_MUL, 20]],
        'circle-color': MINERAL_COLOR,
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'mineral-nodes-dots', type: 'circle', source: 'mineral-nodes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1, ['*', STAGE_RADIUS_MUL, 3.5], 5, ['*', STAGE_RADIUS_MUL, 6], 10, ['*', STAGE_RADIUS_MUL, 9]],
        'circle-color': MINERAL_COLOR,
        'circle-opacity': 0.92,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'mineral-nodes-label', type: 'symbol', source: 'mineral-nodes', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': MINERAL_COLOR,
        'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.92,
      }});

      map.addLayer({ id: 'macro-us-label', type: 'symbol', source: 'macro-us', minzoom: 2, layout: {
        'text-field': ['format',
          'US MACRO', { 'font-scale': 1 },
          '\n', {},
          ['concat', ['to-string', ['get', 'indicator_count']], ' indicators'], { 'font-scale': 0.85 },
        ],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.6], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: {
        'text-color': '#FFC400', 'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.95,
      }});

  // ─────────────────────────── HANDLERS ───────────────────────────

    // ── Sharks (OCEARCH profile link + auto-load historical track) ──
    map.on('click', 'shark-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = SHARK_BUCKET_COLOR[p.bucket as string] || SHARK_BUCKET_COLOR.other;
      setSelectedShark({ id: Number(p.id), name: p.name, bucket: p.bucket, color });
      const lastPing = p.last_ping ? new Date(p.last_ping) : null;
      const daysAgo = lastPing ? Math.floor((Date.now() - lastPing.getTime()) / 86400000) : null;
      const pingLabel = daysAgo == null ? '—' : daysAgo === 0 ? 'today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(29,233,182,0.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#1DE9B6;font-size:14px;font-weight:700;letter-spacing:0.1em;">🦈 ${p.name||'Unknown'}</span>
          <span style="color:#5C5A54;font-size:9px;">#${p.id||''}</span>
        </div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;font-style:italic;">${p.species||'Species unknown'}</div>
        ${p.image ? `<img src="${p.image}" alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:5px;margin-bottom:8px;" />` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">LENGTH</span><br/><span style="color:#E8E6E0;">${p.length||'—'}</span></div>
          <div><span style="color:#5C5A54;">WEIGHT</span><br/><span style="color:#E8E6E0;">${p.weight||'—'}</span></div>
          <div><span style="color:#5C5A54;">GENDER</span><br/><span style="color:#E8E6E0;">${p.gender||'—'}</span></div>
          <div><span style="color:#5C5A54;">STAGE</span><br/><span style="color:#E8E6E0;">${p.stage_of_life||'—'}</span></div>
          <div><span style="color:#5C5A54;">TAGGED</span><br/><span style="color:#E8E6E0;">${p.tag_location||'—'}</span></div>
          <div><span style="color:#5C5A54;">LAST PING</span><br/><span style="color:#1DE9B6;">${pingLabel}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:8px;">POS ${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</div>
        ${p.slug ? `<a href="https://www.ocearch.org/tracker/detail/${p.slug}" target="_blank" style="${linkStyle}color:#1DE9B6;border:1px solid rgba(29,233,182,0.4);background:rgba(29,233,182,0.1);">🌊 OCEARCH PROFILE</a>` : ''}
      </div>`);
    });

    // ── Fish stock health ──
    map.on('click', 'fish-stocks-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const statusColors: Record<string,string> = {
        collapsed:'#FF1744', overfished:'#FF6B00', recovering:'#FFD500', fully:'#448AFF', healthy:'#00E676',
      };
      const statusLabels: Record<string,string> = {
        collapsed:'COLLAPSED', overfished:'OVERFISHED', recovering:'RECOVERING', fully:'FULLY FISHED', healthy:'HEALTHY',
      };
      const c = statusColors[p.status] || '#80CBC4';
      const label = statusLabels[p.status] || (p.status||'').toUpperCase();
      const bm = typeof p.biomass_pct === 'number' || (typeof p.biomass_pct === 'string' && p.biomass_pct !== '');
      const bmVal = bm ? Number(p.biomass_pct) : null;
      // Tiny inline bar — green if healthy zone (>=100), bucketed otherwise
      const barWidth = bmVal == null ? 0 : Math.max(0, Math.min(220, (bmVal / 220) * 220));
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🐟 ${p.name||'Fishery'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${label}</span>
        </div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:2px;">${p.species||''}</div>
        <div style="font-size:9px;color:#5C5A54;font-style:italic;margin-bottom:8px;">${p.scientific||''}</div>
        ${bmVal != null ? `
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#5C5A54;margin-bottom:3px;">
              <span>BIOMASS vs B<sub>MSY</sub></span><span style="color:${c};font-weight:700;">${bmVal}%</span>
            </div>
            <div style="width:220px;height:5px;background:#1a1a24;border-radius:3px;overflow:hidden;position:relative;">
              <div style="width:${barWidth}px;height:100%;background:${c};border-radius:3px;"></div>
              <div style="position:absolute;left:100px;top:-1px;width:1px;height:7px;background:#999;" title="B_MSY"></div>
            </div>
          </div>` : ''}
        <div style="font-size:9px;color:#aaa;line-height:1.5;margin-bottom:8px;">${p.notes||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">FAO AREA</span><br/><span style="color:#E8E6E0;">${p.fao_area||'—'}</span></div>
          <div><span style="color:#5C5A54;">ASSESSED</span><br/><span style="color:#E8E6E0;">${p.year||'—'} · ${p.source||'—'}</span></div>
        </div>
      </div>`);
    });

    // ── Fishing effort (GFW) ──
    const GEAR_LABEL: Record<string, string> = {
      drifting_longlines: 'Drifting longlines',
      set_longlines: 'Set longlines',
      tuna_purse_seines: 'Tuna purse seine',
      other_purse_seines: 'Other purse seine',
      trawlers: 'Trawlers',
      set_gillnets: 'Set gillnets',
      pots_and_traps: 'Pots & traps',
      pole_and_line: 'Pole & line',
      trollers: 'Trollers',
      dredge_fishing: 'Dredge',
      fixed_gear: 'Fixed gear',
      squid_jigger: 'Squid jiggers',
      fishing: 'Other fishing',
      inconclusive: 'Inconclusive',
    };
    map.on('click', 'fishing-effort-ring', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const totalHours = Math.round(Number(p.total_hours) || 0).toLocaleString();
      const totalVessels = Number(p.total_vessels) || 0;
      let gears: any[] = [];
      try { gears = typeof p.top_gears === 'string' ? JSON.parse(p.top_gears) : (p.top_gears || []); } catch {}
      const gearRows = gears.slice(0, 5).map((g: any) => {
        const label = GEAR_LABEL[g.gear] || g.gear;
        const hrs = Math.round(g.hours || 0).toLocaleString();
        return `<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#E8E6E0;">${label}</span>
          <span style="color:#FF9500;font-variant-numeric:tabular-nums;">${hrs}h · ${g.vessels}v</span>
        </div>`;
      }).join('');
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,107,0,0.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#FF6B00;font-size:13px;font-weight:700;letter-spacing:0.05em;">⚓ ${p.name||'Zone'}</span>
          <span style="color:#5C5A54;font-size:9px;">${p.region||''}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:10px;">
          <div><span style="color:#5C5A54;font-size:9px;">VESSEL-HOURS</span><br/><span style="color:#FF6B00;font-weight:700;font-variant-numeric:tabular-nums;">${totalHours}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">UNIQUE VESSELS</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${totalVessels.toLocaleString()}</span></div>
        </div>
        ${gearRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:3px;">TOP GEAR TYPES</div>
          ${gearRows}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Global Fishing Watch · last full calendar month</div>
      </div>`);
    });

    // ── US commercial landings (NOAA FOSS) ──
    map.on('click', 'fish-landings-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const dollars = Number(p.total_dollars) || 0;
      const pounds = Number(p.total_pounds) || 0;
      let species: any[] = [];
      try { species = typeof p.top_species === 'string' ? JSON.parse(p.top_species) : (p.top_species || []); } catch {}
      const rows = species.slice(0, 6).map((s: any) => {
        const d = Math.round(s.dollars || 0);
        const lb = Math.round(s.pounds || 0);
        return `<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#E8E6E0;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</span>
          <span style="color:#FFD500;font-variant-numeric:tabular-nums;">$${(d/1_000_000).toFixed(1)}M · ${(lb/1_000_000).toFixed(1)}M lb</span>
        </div>`;
      }).join('');
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,213,0,0.3);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#FFD500;font-size:13px;font-weight:700;letter-spacing:0.05em;">⚓ ${p.state||'State'}</span>
          <span style="color:#5C5A54;font-size:9px;">${p.region||''} · ${p.year||''}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:10px;">
          <div><span style="color:#5C5A54;font-size:9px;">VALUE</span><br/><span style="color:#FFD500;font-weight:700;font-variant-numeric:tabular-nums;">$${(dollars/1_000_000).toFixed(1)}M</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">VOLUME</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${(pounds/1_000_000).toFixed(0)}M lb</span></div>
        </div>
        ${rows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:3px;">TOP SPECIES BY VALUE (${p.species_count || species.length} total)</div>
          ${rows}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">NOAA Fisheries One Stop Shop · commercial landings ${p.year||''}</div>
      </div>`);
    });

    // ── Oil & Gas (curated upstream fields) ──
    map.on('click', 'oil-gas-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const typeColor = p.type === 'gas' ? '#03A9F4' : p.type === 'mixed' ? '#FFCA28' : '#FFA000';
      const typeLabel = p.type === 'gas' ? 'GAS' : p.type === 'mixed' ? 'OIL + GAS' : 'OIL';
      const statusColor: Record<string,string> = {
        producing:'#00E676', declining:'#FF9500', rebuilding:'#FFD500', sanctioned:'#FF1744',
      };
      const oilK = Number(p.oil_kbpd) || 0;
      const gasM = Number(p.gas_mmcfd) || 0;
      // Bar chart of oil vs gas share, BOE-normalised
      const oilBoe = oilK;
      const gasBoe = gasM / 6;
      const totalBoe = oilBoe + gasBoe;
      const oilPct = totalBoe > 0 ? Math.round((oilBoe / totalBoe) * 100) : 0;
      const gasPct = 100 - oilPct;
      popup(coords, `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${typeColor};font-size:13px;font-weight:700;letter-spacing:0.05em;">⛽ ${p.name||'Field'}</span>
          <span style="color:${typeColor};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${typeColor}80;border-radius:3px;">${typeLabel}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · ${p.region||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">OIL</span><br/><span style="color:#FFA000;font-weight:700;font-variant-numeric:tabular-nums;">${oilK.toLocaleString()} kbpd</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">GAS</span><br/><span style="color:#03A9F4;font-weight:700;font-variant-numeric:tabular-nums;">${gasM.toLocaleString()} MMcf/d</span></div>
        </div>
        ${totalBoe > 0 ? `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#5C5A54;margin-bottom:3px;">
            <span>BOE/d MIX</span><span>${oilPct}% oil · ${gasPct}% gas</span>
          </div>
          <div style="width:100%;height:5px;background:#1a1a24;border-radius:3px;overflow:hidden;display:flex;">
            <div style="width:${oilPct}%;height:100%;background:#FFA000;"></div>
            <div style="width:${gasPct}%;height:100%;background:#03A9F4;"></div>
          </div>
        </div>` : ''}
        <div style="margin-bottom:8px;font-size:9px;color:#aaa;line-height:1.5;">${p.notes||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator||'—'}</span></div>
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusColor[p.status]||'#aaa'};font-weight:700;">${(p.status||'').toUpperCase()}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;">RESERVES <span style="color:#E8E6E0;">${p.reserves||'—'}</span></div>
      </div>`);
    });

    // ── Tier-1 mines ──
    const COMMODITY_LABEL: Record<string,string> = {
      copper:'Copper', gold:'Gold', iron:'Iron Ore', lithium:'Lithium', nickel:'Nickel',
      coal:'Coal', 'rare-earth':'Rare Earths', uranium:'Uranium', diamond:'Diamond',
      silver:'Silver', bauxite:'Bauxite', cobalt:'Cobalt', platinum:'Platinum',
    };
    const COMMODITY_COLOR: Record<string,string> = {
      copper:'#D84315', gold:'#FFD700', iron:'#8D6E63', lithium:'#E1F5FE', nickel:'#90CAF9',
      coal:'#37474F', 'rare-earth':'#CE93D8', uranium:'#76FF03', diamond:'#B3E5FC',
      silver:'#CFD8DC', bauxite:'#FFAB40', cobalt:'#5C6BC0', platinum:'#ECEFF1',
    };
    map.on('click', 'mines-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = COMMODITY_COLOR[p.commodity] || '#B0BEC5';
      const label = COMMODITY_LABEL[p.commodity] || (p.commodity || '').toUpperCase();
      const secondary = p.secondary && p.secondary !== 'null' && p.secondary !== 'undefined' ? p.secondary : null;
      const revB = Number(p.revenue_musd) || 0;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">⛏️ ${p.name||'Mine'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${label.toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · ${p.region||''}${secondary ? ` · also <span style="color:${COMMODITY_COLOR[secondary]||'#aaa'};">${COMMODITY_LABEL[secondary]||secondary}</span>` : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">PRODUCTION</span><br/><span style="color:${c};font-weight:700;">${p.production||'—'}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">REVENUE</span><br/><span style="color:#FFD500;font-weight:700;font-variant-numeric:tabular-nums;">$${(revB/1000).toFixed(1)}B/yr</span></div>
        </div>
        <div style="margin-bottom:8px;font-size:9px;color:#aaa;line-height:1.5;">${p.notes||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:6px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator||'—'}</span></div>
          <div><span style="color:#5C5A54;">MINE LIFE</span><br/><span style="color:#E8E6E0;">${p.life_years||'—'} yrs</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;">ORE GRADE <span style="color:#E8E6E0;">${p.ore_grade||'—'}</span></div>
      </div>`);
    });

    // ── Refineries (downstream) ──
    map.on('click', 'refineries-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const statusColor: Record<string,string> = {
        operating:'#00BCD4', restructuring:'#FF9500', idle:'#9E9E9E', closing:'#FF1744',
      };
      const c = statusColor[p.status] || '#00BCD4';
      const cap = Number(p.capacity_kbpd) || 0;
      const nelson = p.nelson && p.nelson !== 'null' ? Number(p.nelson) : null;
      // Nelson complexity bar: 4 = simple, 14 = world-class deep conversion
      const nelsonPct = nelson != null ? Math.max(0, Math.min(100, (nelson / 14) * 100)) : 0;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🏭 ${p.name||'Refinery'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${(p.status||'').toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city||''} · ${p.country||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">CAPACITY</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${cap.toLocaleString()} kbpd</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator||'—'}</span></div>
        </div>
        ${nelson != null ? `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#5C5A54;margin-bottom:3px;">
            <span>NELSON COMPLEXITY</span><span style="color:${c};font-weight:700;">${nelson.toFixed(1)}</span>
          </div>
          <div style="width:100%;height:5px;background:#1a1a24;border-radius:3px;overflow:hidden;">
            <div style="width:${nelsonPct}%;height:100%;background:${c};border-radius:3px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:8px;color:#5C5A54;margin-top:2px;">
            <span>simple</span><span>deep conversion</span>
          </div>
        </div>` : ''}
        <div style="font-size:9px;color:#aaa;line-height:1.5;">${p.notes||''}</div>
      </div>`);
    });

    // ── Forests ──
    const FOREST_STATUS_COLOR: Record<string,string> = {
      intact:'#4CAF50', degraded:'#FF9800', critical:'#FF1744', recovering:'#00BFA5',
    };
    const FOREST_STATUS_LABEL: Record<string,string> = {
      intact:'INTACT', degraded:'DEGRADED', critical:'CRITICAL', recovering:'RECOVERING',
    };
    map.on('click', 'forests-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = FOREST_STATUS_COLOR[p.status] || '#4CAF50';
      const label = FOREST_STATUS_LABEL[p.status] || (p.status||'').toUpperCase();
      const areaKha = Number(p.area_kha) || 0;
      const lossKha = Number(p.annual_loss_kha) || 0;
      const lossPct = Number(p.loss_pct_yr) || 0;
      const carbon = Number(p.carbon_gt) || 0;
      let threats: string[] = [];
      try { threats = typeof p.threats === 'string' ? JSON.parse(p.threats) : (p.threats || []); } catch {}
      const isRecovering = lossKha < 0;
      // Loss-rate bar: scale 0-3% per year. Negative loss (recovering) shown specially.
      const lossBarPct = isRecovering ? 0 : Math.min(100, (Math.abs(lossPct) / 3) * 100);
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🌲 ${p.name||'Forest'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${label}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · ${p.region||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">AREA</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${(areaKha/1000).toLocaleString(undefined,{maximumFractionDigits:1})} Mha</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">CARBON STORED</span><br/><span style="color:#FFD500;font-weight:700;font-variant-numeric:tabular-nums;">${carbon.toFixed(carbon < 1 ? 2 : 1)} GtC</span></div>
        </div>
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#5C5A54;margin-bottom:3px;">
            <span>${isRecovering ? 'ANNUAL GAIN' : 'ANNUAL LOSS'}</span>
            <span style="color:${isRecovering ? '#00E676' : c};font-weight:700;font-variant-numeric:tabular-nums;">${isRecovering ? '+' : ''}${Math.abs(lossKha).toLocaleString()} kha/yr · ${isRecovering ? '+' : ''}${Math.abs(lossPct).toFixed(2)}%</span>
          </div>
          ${!isRecovering ? `<div style="width:100%;height:5px;background:#1a1a24;border-radius:3px;overflow:hidden;">
            <div style="width:${lossBarPct}%;height:100%;background:${c};border-radius:3px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:8px;color:#5C5A54;margin-top:2px;">
            <span>0%</span><span>3%+ /yr</span>
          </div>` : `<div style="font-size:9px;color:#00E676;font-style:italic;">Net forest gain — rare and worth celebrating.</div>`}
        </div>
        ${threats.length ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">PRIMARY THREATS</div>
          ${threats.map(t => `<span style="display:inline-block;color:#E8E6E0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:2px 6px;border-radius:3px;margin:1px 3px 1px 0;font-size:9px;">${t}</span>`).join('')}
        </div>` : ''}
        <div style="font-size:9px;color:#aaa;line-height:1.5;">${p.notes||''}</div>
      </div>`);
    });

    // ── Central Bank Rates ──
    map.on('click', 'cb-rates-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const change = Number(p.change_bps);
      const yoy = Number(p.yoy_change_bps);
      const dirColor = !Number.isFinite(change) || change === 0 ? '#FFD700' : change < 0 ? '#00E676' : '#FF1744';
      const yoyColor = !Number.isFinite(yoy) || yoy === 0 ? '#5C5A54' : yoy < 0 ? '#00E676' : '#FF1744';
      const arrow = !Number.isFinite(change) || change === 0 ? '→' : change < 0 ? '↓' : '↑';
      const arrowYoy = !Number.isFinite(yoy) || yoy === 0 ? '→' : yoy < 0 ? '↓' : '↑';

      let history: { date: string; value: number }[] = [];
      try { history = typeof p.history === 'string' ? JSON.parse(p.history) : (p.history || []); } catch {}

      // Build an inline SVG sparkline of the history. Width 280, height 50.
      let sparkSvg = '';
      if (history.length >= 2) {
        const W = 280, H = 50, PAD = 4;
        const vals = history.map(h => h.value);
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const range = (maxV - minV) || 1;
        const points = history.map((h, i) => {
          const x = PAD + (i / (history.length - 1)) * (W - 2 * PAD);
          const y = PAD + (1 - (h.value - minV) / range) * (H - 2 * PAD);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        // Area under the curve for fill
        const areaPts = `${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`;
        const lastDate = history[history.length - 1].date.slice(0, 7);
        const firstDate = history[0].date.slice(0, 7);
        sparkSvg = `<svg width="${W}" height="${H + 14}" viewBox="0 0 ${W} ${H + 14}" style="display:block;">
          <polygon points="${areaPts}" fill="${dirColor}" fill-opacity="0.10" />
          <polyline points="${points}" fill="none" stroke="${dirColor}" stroke-width="1.5" />
          <text x="${PAD}" y="${H + 11}" fill="#5C5A54" font-family="JetBrains Mono, monospace" font-size="8">${firstDate}</text>
          <text x="${W - PAD}" y="${H + 11}" text-anchor="end" fill="#5C5A54" font-family="JetBrains Mono, monospace" font-size="8">${lastDate}</text>
          <text x="${W - PAD}" y="${10}" text-anchor="end" fill="#5C5A54" font-family="JetBrains Mono, monospace" font-size="8">${maxV.toFixed(2)}%</text>
          <text x="${W - PAD}" y="${H - PAD - 2}" text-anchor="end" fill="#5C5A54" font-family="JetBrains Mono, monospace" font-size="8">${minV.toFixed(2)}%</text>
        </svg>`;
      }

      const rate = Number(p.current_rate);
      const fundUrl = `https://fred.stlouisfed.org/series/${p.series_code === 'DFF' ? 'DFF' : (p.series_code || '').replace(/^CBRATE_/, 'IRSTCI01') + 'M156N'}`;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,215,0,0.4);min-width:300px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:#FFD700;font-size:13px;font-weight:700;letter-spacing:0.05em;">🏛️ ${p.name||'Central Bank'}</span>
          <span style="color:#FFD700;font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid rgba(255,215,0,0.5);border-radius:3px;">${p.iso||''}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:10px;">${p.city||''} · ${p.country||''}</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;">
          <span style="color:#FFD700;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;">${rate.toFixed(2)}<span style="font-size:14px;color:#aaa;">%</span></span>
          ${Number.isFinite(change) ? `<span style="color:${dirColor};font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;">${arrow} ${Math.abs(change)} bps last move</span>` : ''}
        </div>
        ${Number.isFinite(yoy) ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:8px;">YoY change <span style="color:${yoyColor};font-weight:700;">${arrowYoy} ${Math.abs(yoy)} bps</span> · since ${p.current_rate_date}</div>` : ''}
        ${sparkSvg ? `<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,215,0,0.1);border-radius:4px;padding:4px;margin-bottom:8px;">${sparkSvg}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:6px;">
          <div><span style="color:#5C5A54;">SERIES</span><br/><span style="color:#E8E6E0;">${p.series_code||'—'}</span></div>
          <div><span style="color:#5C5A54;">FREQUENCY</span><br/><span style="color:#E8E6E0;">${p.frequency||'—'}</span></div>
        </div>
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Source: algo-fund via FRED. ${p.series_name||''}</div>
      </div>`);
    });

    // ── Network interference click ──
    const NI_SEVERITY_COLOR: Record<string,string> = {
      critical:'#FF1744', elevated:'#FF6B00', normal:'#FFAB91',
    };
    const NI_SEVERITY_LABEL: Record<string,string> = {
      critical:'CRITICAL', elevated:'ELEVATED', normal:'NORMAL',
    };
    map.on('click', 'network-interference-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = NI_SEVERITY_COLOR[p.severity] || '#FFAB91';
      const label = NI_SEVERITY_LABEL[p.severity] || p.severity?.toUpperCase();
      const rate = Number(p.anomaly_rate) || 0;
      const meas = Number(p.measurement_count) || 0;
      const anom = Number(p.anomaly_count) || 0;
      const conf = Number(p.confirmed_count) || 0;
      const fail = Number(p.failure_count) || 0;
      const ok = Number(p.ok_count) || 0;
      // Tiny stacked bar
      const okPct = meas > 0 ? (ok / meas) * 100 : 0;
      const anomPct = meas > 0 ? (anom / meas) * 100 : 0;
      const confPct = meas > 0 ? (conf / meas) * 100 : 0;
      const failPct = meas > 0 ? (fail / meas) * 100 : 0;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">📡 ${p.name} (${p.iso})</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${label}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:10px;">OONI 7-day window · web-connectivity measurements</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;">
          <span style="color:${c};font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;">${(rate*100).toFixed(1)}<span style="font-size:14px;color:#aaa;">%</span></span>
          <span style="color:#aaa;font-size:10px;">anomaly + confirmed-block rate</span>
        </div>
        <div style="margin-bottom:8px;">
          <div style="width:100%;height:8px;background:#1a1a24;border-radius:3px;overflow:hidden;display:flex;">
            <div style="width:${okPct}%;background:#00E676;" title="OK"></div>
            <div style="width:${anomPct}%;background:#FF6B00;" title="Anomaly"></div>
            <div style="width:${confPct}%;background:#FF1744;" title="Confirmed block"></div>
            <div style="width:${failPct}%;background:#9E9E9E;" title="Failure"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:8px;color:#5C5A54;margin-top:3px;">
            <span style="color:#00E676;">ok</span>
            <span style="color:#FF6B00;">anomaly</span>
            <span style="color:#FF1744;">confirmed</span>
            <span style="color:#9E9E9E;">failure</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">MEASUREMENTS</span><br/><span style="color:#E8E6E0;font-variant-numeric:tabular-nums;">${meas.toLocaleString()}</span></div>
          <div><span style="color:#5C5A54;">CONFIRMED BLOCKS</span><br/><span style="color:${conf>100?'#FF1744':'#E8E6E0'};font-weight:700;font-variant-numeric:tabular-nums;">${conf.toLocaleString()}</span></div>
        </div>
        <a href="https://explorer.ooni.org/country/${p.iso}" target="_blank" rel="noopener" style="${linkStyle}color:#FFAB91;border:1px solid rgba(255,171,145,0.4);background:rgba(255,171,145,0.1);">📡 OONI EXPLORER</a>
      </div>`);
    });

    // ── Coral reef click ──
    const REEF_STATUS_COLOR: Record<string,string> = {
      intact:'#F48FB1', degraded:'#FF9800', critical:'#FF1744', recovering:'#00BFA5',
    };
    const REEF_STATUS_LABEL: Record<string,string> = {
      intact:'INTACT', degraded:'DEGRADED', critical:'CRITICAL', recovering:'RECOVERING',
    };
    map.on('click', 'coral-reefs-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = REEF_STATUS_COLOR[p.status] || '#F48FB1';
      const label = REEF_STATUS_LABEL[p.status] || (p.status||'').toUpperCase();
      let threats: string[] = [];
      try { threats = typeof p.threats === 'string' ? JSON.parse(p.threats) : (p.threats || []); } catch {}
      const lastBleach = Number(p.last_bleaching) || 0;
      const eventsCount = Number(p.bleaching_events_since_2000) || 0;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:300px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🪸 ${p.name||'Reef'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${label}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · ${p.region||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">AREA</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${Number(p.area_km2).toLocaleString()} km²</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">BLEACHING EVENTS</span><br/><span style="color:#FF6B00;font-weight:700;font-variant-numeric:tabular-nums;">${eventsCount} since 2000</span></div>
        </div>
        ${lastBleach > 0 ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:8px;">Last major bleaching: <span style="color:${c};font-weight:700;">${lastBleach}</span></div>` : ''}
        ${threats.length ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">PRIMARY THREATS</div>
          ${threats.map(t => `<span style="display:inline-block;color:#E8E6E0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:2px 6px;border-radius:3px;margin:1px 3px 1px 0;font-size:9px;">${t}</span>`).join('')}
        </div>` : ''}
        ${p.notable_species && p.notable_species !== 'null' ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:8px;">Notable species: <span style="color:#E8E6E0;font-style:italic;">${p.notable_species}</span></div>` : ''}
        <div style="font-size:9px;color:#aaa;line-height:1.5;">${p.notes||''}</div>
      </div>`);
    });

    // ── Sanctions geography click ──
    const SANC_C: Record<string,string> = {
      critical:'#D32F2F', major:'#FF6B00', moderate:'#FF8A65', minor:'#FFCCBC',
    };
    const SANC_LABEL: Record<string,string> = {
      critical:'CRITICAL', major:'MAJOR', moderate:'MODERATE', minor:'MINOR',
    };
    map.on('click', 'sanctions-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = SANC_C[p.severity] || '#FF8A65';
      const targets = Number(p.target_count) || 0;
      const things = Number(p.thing_count) || 0;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🚫 ${p.name} (${p.iso})</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${SANC_LABEL[p.severity] || p.severity?.toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:10px;">Consolidated count across OFAC + EU + UK + UN + national lists</div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px;">
          <span style="color:${c};font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;">${targets.toLocaleString()}</span>
          <span style="color:#aaa;font-size:10px;">sanctioned targets<br/>(persons + companies + vessels + wallets)</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">RELATED ENTITIES</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${things.toLocaleString()}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">SEVERITY BUCKET</span><br/><span style="color:${c};font-weight:700;">${SANC_LABEL[p.severity] || p.severity}</span></div>
        </div>
        <a href="https://www.opensanctions.org/search/?countries=${p.iso.toLowerCase()}" target="_blank" rel="noopener" style="${linkStyle}color:#FF8A65;border:1px solid rgba(255,138,101,0.4);background:rgba(255,138,101,0.1);">🚫 OPENSANCTIONS LOOKUP</a>
      </div>`);
    });

    // ── Drug seizure click ──
    const DRUG_C: Record<string,string> = {
      cocaine:'#E1BEE7', heroin:'#8E24AA', fentanyl:'#FF1744',
      methamphetamine:'#00BCD4', mdma:'#FFD600', cannabis:'#4CAF50',
      precursors:'#FF9800', mixed:'#BA68C8',
    };
    const DRUG_LABEL: Record<string,string> = {
      cocaine:'COCAINE', heroin:'HEROIN', fentanyl:'FENTANYL',
      methamphetamine:'METH', mdma:'MDMA', cannabis:'CANNABIS',
      precursors:'PRECURSORS', mixed:'MIXED',
    };
    map.on('click', 'drug-seizures-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = DRUG_C[p.drug] || '#BA68C8';
      const kg = Number(p.quantity_kg) || 0;
      const val = Number(p.street_value_usd_millions) || 0;
      // Format quantity sensibly
      const qty = kg >= 1000 ? `${(kg/1000).toFixed(1)} tonnes` : `${kg.toLocaleString()} kg`;
      const flow = p.origin_country && p.origin_country !== 'null' && p.destination_country && p.destination_country !== 'null'
        ? `${p.origin_country} → ${p.destination_country}` : '';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:300px;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">💊 ${p.name}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${DRUG_LABEL[p.drug] || p.drug?.toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.date} · ${p.city||''}, ${p.country||''}${flow ? ` · ${flow}` : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">QUANTITY</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${qty}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STREET VALUE</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${val > 0 ? '$' + val.toLocaleString() + 'M' : '—'}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">SEIZED BY<br/><span style="color:#E8E6E0;">${p.agency || '—'}</span></div>
        ${p.attributed_org && p.attributed_org !== 'null' ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">ATTRIBUTED TO<br/><span style="color:${c};">${p.attributed_org}</span></div>` : ''}
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Sea ice click ──
    const ICE_PCT_COLOR: Record<string,string> = {
      '<10':'#FF1744', '10-25':'#FF6B00', '25-50':'#FFB300',
      '50-75':'#42A5F5', '75-90':'#90CAF9', '>90':'#E1F5FE', 'unknown':'#90CAF9',
    };
    const ICE_PCT_LABEL: Record<string,string> = {
      '<10':'BELOW 10th %ILE', '10-25':'BELOW 25th %ILE', '25-50':'BELOW MEDIAN',
      '50-75':'ABOVE MEDIAN', '75-90':'ABOVE 75th %ILE', '>90':'ABOVE 90th %ILE',
      'unknown':'NO BASELINE',
    };
    map.on('click', 'sea-ice-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = ICE_PCT_COLOR[p.percentile] || '#90CAF9';
      const pctLabel = ICE_PCT_LABEL[p.percentile] || '—';
      const current = Number(p.current_extent_mkm2) || 0;
      const climMean = Number(p.climatology_mean_mkm2) || 0;
      const anomaly = Number(p.anomaly_mkm2) || 0;
      const anomalyPct = Number(p.anomaly_pct) || 0;
      const z = Number(p.z_score) || 0;
      let recent: any[] = [];
      try { recent = typeof p.recent_year === 'string' ? JSON.parse(p.recent_year) : (p.recent_year || []); } catch {}
      let clim: any[] = [];
      try { clim = typeof p.climatology_band === 'string' ? JSON.parse(p.climatology_band) : (p.climatology_band || []); } catch {}

      // Annual-cycle SVG: X = DOY 1-366, Y = extent. Render the 10-90 climatology
      // band as a filled area, climatology mean as a thin line, then current
      // year as a bright line on top.
      const W = 300, H = 90, PADL = 22, PADR = 4, PADT = 4, PADB = 12;
      let chart = '';
      if (recent.length >= 2 && clim.length >= 2) {
        // Build per-DOY lookups from clim
        const climByDoy = new Map<number, any>();
        for (const r of clim) climByDoy.set(r.doy, r);
        const allValues = [
          ...recent.map(r => r.extent_mkm2),
          ...clim.map(r => r.p90),
          ...clim.map(r => r.p10),
        ];
        const yMin = Math.max(0, Math.min(...allValues) - 0.5);
        const yMax = Math.max(...allValues) + 0.5;
        const xScale = (doy: number) => PADL + ((doy - 1) / 365) * (W - PADL - PADR);
        const yScale = (v: number) => PADT + (1 - (v - yMin) / (yMax - yMin)) * (H - PADT - PADB);

        // Climatology band (10-90 percentiles) as a filled polygon
        const climSorted = [...clim].sort((a, b) => a.doy - b.doy);
        const top = climSorted.map(r => `${xScale(r.doy).toFixed(1)},${yScale(r.p90).toFixed(1)}`);
        const bot = [...climSorted].reverse().map(r => `${xScale(r.doy).toFixed(1)},${yScale(r.p10).toFixed(1)}`);
        const bandPts = [...top, ...bot].join(' ');
        // Climatology mean line
        const meanPts = climSorted.map(r => `${xScale(r.doy).toFixed(1)},${yScale(r.mean).toFixed(1)}`).join(' ');
        // Current year line — sorted chronologically as supplied
        const curPts = recent.map(r => `${xScale(r.doy).toFixed(1)},${yScale(r.extent_mkm2).toFixed(1)}`).join(' ');
        const lastObs = recent[recent.length - 1];
        const lastX = xScale(lastObs.doy);
        const lastY = yScale(lastObs.extent_mkm2);
        // Y-axis labels (min, mid, max)
        const yMid = (yMin + yMax) / 2;
        chart = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;">
          <polygon points="${bandPts}" fill="#90CAF9" fill-opacity="0.18" />
          <polyline points="${meanPts}" fill="none" stroke="#90CAF9" stroke-opacity="0.6" stroke-width="1" stroke-dasharray="2,2" />
          <polyline points="${curPts}" fill="none" stroke="${c}" stroke-width="1.5" />
          <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="${c}" />
          <text x="2" y="${yScale(yMax).toFixed(0)}" font-size="7" fill="#5C5A54">${yMax.toFixed(0)}</text>
          <text x="2" y="${yScale(yMid).toFixed(0)}" font-size="7" fill="#5C5A54">${yMid.toFixed(0)}</text>
          <text x="2" y="${yScale(yMin).toFixed(0)}" font-size="7" fill="#5C5A54">${yMin.toFixed(0)}</text>
          <text x="${PADL}" y="${H-2}" font-size="6" fill="#5C5A54">Jan</text>
          <text x="${W/2-6}" y="${H-2}" font-size="6" fill="#5C5A54">Jul</text>
          <text x="${W-PADR-12}" y="${H-2}" font-size="6" fill="#5C5A54">Dec</text>
        </svg>`;
      }

      const anomalyColor = anomaly < 0 ? '#FF6B00' : '#00E676';
      const anomalySign = anomaly >= 0 ? '+' : '';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:340px;max-width:360px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">❄️ ${p.pole} sea ice extent</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${pctLabel}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">As of ${p.current_date} · source NSIDC G02135 v4</div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:8px;">
          <span style="color:${c};font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;">${current.toFixed(2)}<span style="font-size:12px;color:#aaa;"> Mkm²</span></span>
          <span style="color:#aaa;font-size:10px;">vs 1981-2010 mean <span style="color:#90CAF9;">${climMean.toFixed(2)}</span></span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:10px;">
          <div><span style="color:#5C5A54;font-size:9px;">ANOMALY</span><br/><span style="color:${anomalyColor};font-weight:700;font-variant-numeric:tabular-nums;">${anomalySign}${anomaly.toFixed(2)} Mkm² (${anomalySign}${anomalyPct.toFixed(1)}%)</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">Z-SCORE</span><br/><span style="color:${Math.abs(z) > 2 ? '#FF1744' : '#E8E6E0'};font-weight:700;font-variant-numeric:tabular-nums;">${z >= 0 ? '+' : ''}${z.toFixed(2)} σ</span></div>
        </div>
        ${chart ? `<div style="margin-bottom:6px;">${chart}</div>
        <div style="display:flex;justify-content:space-between;font-size:8px;color:#5C5A54;margin-bottom:8px;">
          <span><span style="display:inline-block;width:8px;height:8px;background:${c};vertical-align:middle;border-radius:1px;"></span> current year</span>
          <span><span style="display:inline-block;width:8px;height:1px;border-top:1px dashed #90CAF9;vertical-align:middle;"></span> 1981-2010 mean</span>
          <span><span style="display:inline-block;width:8px;height:6px;background:#90CAF9;opacity:0.3;vertical-align:middle;"></span> 10-90 band</span>
        </div>` : ''}
        <a href="https://nsidc.org/sea-ice-today" target="_blank" rel="noopener" style="${linkStyle}color:#90CAF9;border:1px solid rgba(144,202,249,0.4);background:rgba(144,202,249,0.1);">❄️ NSIDC SEA ICE TODAY</a>
      </div>`);
    });

    // ── Active volcano click ──
    map.on('click', 'volcanoes-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const days = Number(p.days_ago);
      const recencyLabel = !Number.isFinite(days) ? 'unknown' :
        days === 0 ? 'today' : days === 1 ? '1 day ago' :
        days < 30 ? `${days} days ago` :
        days < 365 ? `${Math.round(days/30)} months ago` :
        `${(days/365).toFixed(1)} years ago`;
      let sources: any[] = [];
      try { sources = typeof p.sources === 'string' ? JSON.parse(p.sources) : (p.sources || []); } catch {}
      const sourceLinks = sources.map((s: any) => `<a href="${s.url}" target="_blank" rel="noopener" style="${linkStyle}color:#FF7043;border:1px solid rgba(255,87,34,0.4);background:rgba(255,87,34,0.1);">${s.id}</a>`).join(' ');
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,87,34,0.4);min-width:260px;max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#FF5722;font-size:13px;font-weight:700;letter-spacing:0.05em;">🌋 ${p.name || 'Volcano'}</span>
          <span style="color:#FF5722;font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid rgba(255,87,34,0.5);border-radius:3px;">ACTIVE</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · last report ${recencyLabel}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">POSITION</span><br/><span style="color:#E8E6E0;font-variant-numeric:tabular-nums;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">LAST UPDATE</span><br/><span style="color:#FF7043;font-weight:700;">${(p.last_update||'').slice(0,10) || '—'}</span></div>
        </div>
        ${sourceLinks ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:8px;">SOURCES<br/>${sourceLinks}</div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Source: NASA EONET aggregating Smithsonian Global Volcanism Program + NASA Earth Observatory</div>
      </div>`);
    });

    // ── Tropical cyclone click ──
    const SS_CAT_FROM_MPH = (mph: number | null): string => {
      if (mph == null) return '—';
      if (mph < 39) return 'Tropical Depression';
      if (mph < 74) return 'Tropical Storm';
      if (mph < 96) return 'Hurricane Cat 1';
      if (mph < 111) return 'Hurricane Cat 2';
      if (mph < 130) return 'Hurricane Cat 3 (Major)';
      if (mph < 157) return 'Hurricane Cat 4 (Major)';
      return 'Hurricane Cat 5';
    };
    map.on('click', 'storms-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const mph = Number(p.max_wind_mph) || null;
      const cat = SS_CAT_FROM_MPH(mph);
      const c = mph == null ? '#80DEEA' : mph < 39 ? '#80DEEA' : mph < 74 ? '#26C6DA' :
                mph < 96 ? '#FFC400' : mph < 111 ? '#FF9800' : mph < 130 ? '#FF6B00' : mph < 157 ? '#FF1744' : '#7B1FA2';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🌀 ${p.title || p.name}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${p.basin}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${cat}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">MAX WIND</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${mph != null ? mph + ' mph' : '—'}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">POSITION</span><br/><span style="color:#E8E6E0;font-variant-numeric:tabular-nums;">${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°</span></div>
        </div>
        ${p.pressure_mbar && p.pressure_mbar !== 'null' ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">Min pressure <span style="color:#E8E6E0;font-weight:700;">${p.pressure_mbar} mb</span></div>` : ''}
        ${p.movement && p.movement !== 'null' ? `<div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">Movement <span style="color:#E8E6E0;">${p.movement}</span></div>` : ''}
        ${p.source_url && p.source_url !== 'null' ? `<a href="${p.source_url}" target="_blank" rel="noopener" style="${linkStyle}color:${c};border:1px solid ${c}80;background:${c}15;">📡 ${p.source} ADVISORY</a>` : ''}
      </div>`);
    });

    // ── Refugee asylum-country popup ──
    map.on('click', 'refugee-asylum-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const total = Number(p.total_refugees) || 0;
      let origins: any[] = [];
      try { origins = typeof p.origins === 'string' ? JSON.parse(p.origins) : (p.origins || []); } catch {}
      const rows = origins.slice(0, 10).map((o: any) =>
        `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#E8E6E0;">${o.name}</span>
          <span style="color:#42A5F5;font-weight:700;font-variant-numeric:tabular-nums;">${(o.refugees/1000).toLocaleString(undefined,{maximumFractionDigits:0})}k</span>
        </div>`).join('');
      popup(coords, `<div style="${pStyle}border:1px solid rgba(66,165,245,0.4);min-width:280px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#42A5F5;font-size:13px;font-weight:700;letter-spacing:0.05em;">⛺ ${p.name} (asylum)</span>
          <span style="color:#42A5F5;font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid rgba(66,165,245,0.5);border-radius:3px;">${p.origin_count} CORRIDORS</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:10px;">Cross-border refugees hosted (UNHCR ${p.year || ''})</div>
        <div style="margin-bottom:8px;">
          <div style="color:#90CAF9;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;">${(total/1_000_000).toFixed(2)}M</div>
          <div style="color:#5C5A54;font-size:9px;">refugees from top origin countries</div>
        </div>
        ${rows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:3px;">ORIGIN COUNTRIES</div>
          ${rows}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Source: UNHCR Refugee Population Statistics</div>
      </div>`);
    });

    // ── Mineral supply chain node click ──
    const MINERAL_BLOC_C: Record<string,string> = {
      China:'#FF6E40', Korea:'#1A237E', Japan:'#EC407A',
      US:'#448AFF', EU:'#3949AB', Other:'#80CBC4',
    };
    const STAGE_LABEL: Record<string,string> = {
      mine:'⛏️ Mine', refining:'⚗️ Refining', cathode:'🔋 Cathode',
      cell:'🔋 Cell / Gigafactory', pack:'📦 Pack', oem:'🚗 OEM',
    };
    map.on('click', 'mineral-nodes-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = MINERAL_BLOC_C[p.bloc] || '#80CBC4';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;max-width:360px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">${p.name}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${p.bloc}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${STAGE_LABEL[p.stage] || p.stage} · ${p.city||''}, ${p.country||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">COMMODITY</span><br/><span style="color:${c};font-weight:700;">${p.commodity || '—'}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">CAPACITY</span><br/><span style="color:#E8E6E0;font-weight:700;">${p.capacity || '—'}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">OPERATOR <span style="color:#E8E6E0;">${p.operator || '—'}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Data center click ──
    const DC_TYPE_LABEL: Record<string,string> = {
      aws:'AWS', azure:'Azure', gcp:'GCP', oracle:'Oracle Cloud',
      alibaba:'Alibaba Cloud', tencent:'Tencent Cloud',
      colo:'Colocation', ixp:'Internet Exchange', sovereign:'Sovereign / SIGINT',
    };
    const DC_C: Record<string,string> = {
      aws:'#FF9900', azure:'#00A4EF', gcp:'#4285F4', oracle:'#C74634',
      alibaba:'#FF6E40', tencent:'#00A0E9', colo:'#80DEEA', ixp:'#FFD600', sovereign:'#9C27B0',
    };
    map.on('click', 'data-centers-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = DC_C[p.type] || '#80DEEA';
      const mw = Number(p.capacity_mw) || 0;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;max-width:360px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🖥️ ${p.name}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${DC_TYPE_LABEL[p.type] || p.type}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city||''}, ${p.country||''} · ${p.region||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">IT LOAD</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${mw > 0 ? mw + ' MW' : '—'}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator || '—'}</span></div>
        </div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── GPU cluster click ──
    map.on('click', 'gpu-clusters-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const mw = Number(p.power_mw) || 0;
      const chips = Number(p.chip_count) || 0;
      const statusColor = p.status === 'operating' ? '#00E676' : p.status === 'construction' ? '#FFD500' : '#448AFF';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(236,64,122,0.4);min-width:300px;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#EC407A;font-size:13px;font-weight:700;letter-spacing:0.05em;">⚡ ${p.name}</span>
          <span style="color:${statusColor};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${statusColor}80;border-radius:3px;">${(p.status||'').toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city||''}, ${p.country||''} · ${p.operator}${p.partner && p.partner !== 'null' ? ` + ${p.partner}` : ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">CHIPS</span><br/><span style="color:#EC407A;font-weight:700;font-variant-numeric:tabular-nums;">${chips > 0 ? chips.toLocaleString() + ' × ' + p.chips : p.chips}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">POWER</span><br/><span style="color:#FF9800;font-weight:700;font-variant-numeric:tabular-nums;">${mw.toLocaleString()} MW</span></div>
        </div>
        <div style="margin-bottom:8px;font-size:10px;">
          <span style="color:#5C5A54;font-size:9px;">WORKLOAD</span><br/>
          <span style="color:#E8E6E0;line-height:1.4;">${p.workload || '—'}</span>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">Announced: <span style="color:#E8E6E0;">${p.announced || '—'}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Shipping lane click ──
    const LANE_TYPE_COLOR: Record<string,string> = {
      container:'#1976D2', crude:'#FFA000', lng:'#26C6DA', bulk:'#8D6E63',
      chemical:'#9C27B0', mixed:'#90A4AE',
    };
    const LANE_TYPE_LABEL: Record<string,string> = {
      container:'Container', crude:'Crude oil', lng:'LNG', bulk:'Dry bulk',
      chemical:'Chemical', mixed:'Mixed cargo',
    };
    const LANE_STATUS_COLOR: Record<string,string> = {
      normal:'#00E676', disrupted:'#FF6B00', rerouted:'#FF1744',
    };
    map.on('click', 'shipping-lanes-line', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const c = LANE_TYPE_COLOR[p.type] || '#1976D2';
      popup(e.lngLat, `<div style="${pStyle}border:1px solid ${c}40;min-width:300px;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🚢 ${p.name}</span>
          <span style="color:${LANE_STATUS_COLOR[p.status] || '#aaa'};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${LANE_STATUS_COLOR[p.status] || '#aaa'}80;border-radius:3px;">${(p.status||'').toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${LANE_TYPE_LABEL[p.type] || p.type}</div>
        <div style="font-size:10px;margin-bottom:8px;"><span style="color:#5C5A54;font-size:9px;">TRAFFIC</span><br/><span style="color:${c};font-weight:700;">${p.traffic || '—'}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Air cargo hub click ──
    map.on('click', 'air-cargo-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const tonnes = Number(p.cargo_tonnes_yr) || 0;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,152,0,0.4);min-width:300px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#FF9800;font-size:13px;font-weight:700;letter-spacing:0.05em;">📦 ${p.name}</span>
          <span style="color:#FF9800;font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid rgba(255,152,0,0.5);border-radius:3px;">${p.iata}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city}, ${p.country} · ${p.region}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">CARGO TONNAGE</span><br/><span style="color:#FF9800;font-weight:700;font-variant-numeric:tabular-nums;">${(tonnes/1_000_000).toFixed(2)} Mt/yr</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">OPERATOR TYPE</span><br/><span style="color:#E8E6E0;">${p.operator_type}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">PRIMARY OPERATOR<br/><span style="color:#E8E6E0;">${p.primary_operator || '—'}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Rail freight corridor click ──
    const RAIL_STATUS_COLOR: Record<string,string> = {
      operating:'#00E676', reduced:'#FFD500', planned:'#448AFF', sanctioned:'#FF1744',
    };
    map.on('click', 'rail-corridors-line', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const c = RAIL_STATUS_COLOR[p.status] || '#795548';
      let countries: string[] = [];
      try { countries = typeof p.countries === 'string' ? JSON.parse(p.countries) : (p.countries || []); } catch {}
      popup(e.lngLat, `<div style="${pStyle}border:1px solid #79554840;min-width:300px;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#A1887F;font-size:13px;font-weight:700;letter-spacing:0.05em;">🚆 ${p.name}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${(p.status||'').toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${countries.join(' → ')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">LENGTH</span><br/><span style="color:#A1887F;font-weight:700;font-variant-numeric:tabular-nums;">${Number(p.length_km).toLocaleString()} km</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">CAPACITY</span><br/><span style="color:#E8E6E0;font-weight:700;">${p.annual_teu || '—'}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:6px;">OPERATOR<br/><span style="color:#E8E6E0;">${p.operator || '—'}</span></div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Pipelines click ──
    const PIPE_STATUS_COLOR: Record<string,string> = {
      operating:'#00E676', partial:'#FFB300', suspended:'#FF6B00',
      damaged:'#FF1744', planned:'#448AFF', cancelled:'#9E9E9E',
    };
    const PIPE_TYPE_LABEL: Record<string,string> = {
      oil:'Crude oil', gas:'Natural gas', product:'Refined product',
    };
    map.on('click', 'pipelines-line', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const c = PIPE_STATUS_COLOR[p.status] || '#9E9E9E';
      const status = (p.status || '').toUpperCase();
      let countries: string[] = [];
      try { countries = typeof p.countries === 'string' ? JSON.parse(p.countries) : (p.countries || []); } catch {}
      popup(e.lngLat, `<div style="${pStyle}border:1px solid ${c}40;min-width:300px;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🛢️ ${p.name||'Pipeline'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${status}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${PIPE_TYPE_LABEL[p.type] || p.type} · ${countries.join(' → ')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">CAPACITY</span><br/><span style="color:${c};font-weight:700;">${p.capacity || '—'}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">LENGTH</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${Number(p.length_km).toLocaleString()} km</span></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator || '—'}</span></div>
          <div><span style="color:#5C5A54;">COMMISSIONED</span><br/><span style="color:#E8E6E0;">${p.commissioned > 0 ? p.commissioned : '—'}</span></div>
        </div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Submarine cable click — lazy detail fetch with cyan-themed popup ──
    map.on('click', 'subcables-line', async e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const id = String(p.id || '');
      const name = String(p.name || 'Submarine Cable');
      const color = String(p.color || '#80DEEA');
      // Show a loading popup at the click location immediately so users get feedback.
      popup(e.lngLat, `<div style="${pStyle}border:1px solid ${color}40;min-width:260px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="color:${color};font-size:13px;font-weight:700;letter-spacing:0.05em;">🔌 ${name}</span>
          <span style="color:${color};font-size:9px;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${color}80;border-radius:3px;">CABLE</span>
        </div>
        <div style="font-size:10px;color:#5C5A54;font-style:italic;padding:8px 0;">Loading cable detail...</div>
      </div>`);
      try {
        const res = await fetch(`/api/infra/submarine-cables/cable/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        const isPlanned = !!d.is_planned;
        const rfsBadge = d.rfs ? `<span style="color:${isPlanned ? '#FFD500' : '#00E676'};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${isPlanned ? '#FFD50080' : '#00E67680'};border-radius:3px;">${isPlanned ? 'PLANNED ' : 'RFS '}${d.rfs}</span>` : '';
        const lps: any[] = Array.isArray(d.landing_points) ? d.landing_points : [];
        const lpRows = lps.slice(0, 8).map(lp => `<div style="font-size:9px;color:#E8E6E0;padding:1px 0;display:flex;justify-content:space-between;"><span>${lp.name||lp.id||'?'}</span><span style="color:#5C5A54;">${lp.country||''}</span></div>`).join('');
        const more = lps.length > 8 ? `<div style="font-size:8px;color:#5C5A54;font-style:italic;">+ ${lps.length - 8} more</div>` : '';
        // Re-render popup with full content
        popup(e.lngLat, `<div style="${pStyle}border:1px solid ${color}40;min-width:280px;max-width:340px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
            <span style="color:${color};font-size:13px;font-weight:700;letter-spacing:0.05em;">🔌 ${d.name || name}</span>
            ${rfsBadge}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
            <div><span style="color:#5C5A54;font-size:9px;">LENGTH</span><br/><span style="color:${color};font-weight:700;">${d.length || '—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">SUPPLIER</span><br/><span style="color:#E8E6E0;">${d.suppliers || '—'}</span></div>
          </div>
          <div style="margin-bottom:8px;font-size:10px;">
            <span style="color:#5C5A54;font-size:9px;">OWNERS</span><br/>
            <span style="color:#E8E6E0;line-height:1.4;">${d.owners || '—'}</span>
          </div>
          ${lpRows ? `<div style="margin-bottom:8px;">
            <div style="font-size:9px;color:#5C5A54;margin-bottom:3px;">LANDING POINTS (${lps.length})</div>
            ${lpRows}${more}
          </div>` : ''}
          ${d.notes ? `<div style="font-size:9px;color:#aaa;line-height:1.5;margin-bottom:8px;font-style:italic;">${d.notes}</div>` : ''}
          ${d.url ? `<a href="${d.url}" target="_blank" rel="noopener" style="${linkStyle}color:${color};border:1px solid ${color}80;background:${color}15;">↗ OPERATOR PAGE</a>` : ''}
          <a href="https://www.submarinecablemap.com/submarine-cable/${id}" target="_blank" rel="noopener" style="${linkStyle}color:#80DEEA;border:1px solid rgba(128,222,234,0.4);background:rgba(128,222,234,0.1);margin-left:6px;">📡 TELEGEOGRAPHY</a>
        </div>`);
      } catch (err) {
        popup(e.lngLat, `<div style="${pStyle}border:1px solid ${color}40;min-width:240px;">
          <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🔌 ${name}</div>
          <div style="font-size:10px;color:#FF6B6B;">Detail fetch failed: ${err instanceof Error ? err.message : String(err)}</div>
          <a href="https://www.submarinecablemap.com/submarine-cable/${id}" target="_blank" rel="noopener" style="${linkStyle}color:#80DEEA;border:1px solid rgba(128,222,234,0.4);background:rgba(128,222,234,0.1);">View on Telegeography</a>
        </div>`);
      }
    });

    // Cable landing-point click — small dot, summary popup
    map.on('click', 'subcable-landings', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(128,222,234,0.4);">
        <div style="color:#80DEEA;font-size:12px;font-weight:700;margin-bottom:4px;">📍 ${p.name || 'Landing Station'}</div>
        <div style="font-size:9px;color:#aaa;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}° · click an attached cable for details</div>
      </div>`);
    });

    // ── Power Plants ──
    const POWER_LABEL: Record<string,string> = {
      hydro:'Hydroelectric', nuclear:'Nuclear', coal:'Coal-fired', gas:'Gas-fired',
      solar:'Solar PV', wind:'Wind', geothermal:'Geothermal', 'pumped-storage':'Pumped Storage',
    };
    const POWER_C: Record<string,string> = {
      hydro:'#00BCD4', nuclear:'#76FF03', coal:'#37474F', gas:'#FFB300',
      solar:'#FDD835', wind:'#B3E5FC', geothermal:'#FF5722', 'pumped-storage':'#9C27B0',
    };
    const PLANT_STATUS_COLOR: Record<string,string> = {
      operating:'#00E676', partial:'#FFD500', construction:'#448AFF', retired:'#9E9E9E', disputed:'#FF1744',
    };
    map.on('click', 'power-plants-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = POWER_C[p.type] || '#FFEB3B';
      const typeLabel = POWER_LABEL[p.type] || (p.type || '').toUpperCase();
      const mw = Number(p.capacity_mw) || 0;
      const statusC = PLANT_STATUS_COLOR[p.status] || '#aaa';
      // Capacity factor estimate by type (rule of thumb)
      const cf: Record<string,number> = { nuclear: 0.92, geothermal: 0.85, coal: 0.55, gas: 0.50, hydro: 0.45, 'pumped-storage': 0.20, wind: 0.35, solar: 0.20 };
      const f = cf[p.type] ?? 0.40;
      const annualGwh = mw * 8.76 * f; // MW * hours/yr/1000 * CF
      // Household equivalent at ~10 MWh/year per US household
      const households = Math.round(annualGwh * 1000 / 10);
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">⚡ ${p.name||'Power Plant'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${typeLabel.toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · ${p.region||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">NAMEPLATE</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${mw.toLocaleString()} MW</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">~ANNUAL</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${Math.round(annualGwh).toLocaleString()} GWh</span></div>
        </div>
        <div style="margin-bottom:8px;font-size:9px;color:#5C5A54;">
          Powers roughly <span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${(households/1_000_000).toFixed(1)}M households</span> at ~${Math.round(f*100)}% capacity factor
        </div>
        <div style="margin-bottom:8px;font-size:9px;color:#aaa;line-height:1.5;">${p.notes||''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:6px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator||'—'}</span></div>
          <div><span style="color:#5C5A54;">COMMISSIONED</span><br/><span style="color:#E8E6E0;">${p.year||'—'}</span></div>
        </div>
        <div style="font-size:9px;color:#5C5A54;">STATUS <span style="color:${statusC};font-weight:700;">${(p.status||'').toUpperCase()}</span></div>
      </div>`);
    });

    // ── Military bases ──
    const BLOC_C: Record<string,string> = {
      US:'#448AFF', NATO:'#1E88E5', UK:'#1A237E', France:'#7986CB',
      Russia:'#E53935', China:'#FF6E40', India:'#FF9800', Iran:'#7B1FA2', Israel:'#00897B', Other:'#9E9E9E',
    };
    const TYPE_LABEL: Record<string,string> = {
      army:'Army', navy:'Naval', air:'Air', marine:'Marine',
      joint:'Joint', space:'Space', sigint:'SIGINT', 'special-forces':'Special Forces',
    };
    const BASE_STATUS_COLOR: Record<string,string> = {
      active:'#00E676', reduced:'#FFD500', contested:'#FF1744',
      'recent-departure':'#9E9E9E', new:'#448AFF',
    };
    map.on('click', 'military-bases-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = BLOC_C[p.bloc] || '#9E9E9E';
      const sC = BASE_STATUS_COLOR[p.status] || '#aaa';
      const ppl = Number(p.personnel) || 0;
      const hostDifferent = p.host && p.operator && p.host !== p.operator;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🛡️ ${p.name||'Base'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${(p.bloc||'').toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">
          ${p.city||''} · ${hostDifferent ? `host <span style="color:#E8E6E0;">${p.host}</span> · operator <span style="color:${c};font-weight:700;">${p.operator}</span>` : `<span style="color:${c};">${p.operator||''}</span>`} · ${TYPE_LABEL[p.type] || p.type || ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">PERSONNEL (approx)</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${ppl.toLocaleString()}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${sC};font-weight:700;">${(p.status||'').toUpperCase().replace('-',' ')}</span></div>
        </div>
        <div style="margin-bottom:8px;font-size:10px;">
          <span style="color:#5C5A54;font-size:9px;">FUNCTION</span><br/>
          <span style="color:#E8E6E0;line-height:1.4;">${p.function||'—'}</span>
        </div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Spaceports ──
    const SP_C: Record<string,string> = {
      US:'#448AFF', China:'#FF6E40', Russia:'#E53935', ESA:'#FFC107', Japan:'#EC407A',
      India:'#FF9800', Iran:'#7B1FA2', NK:'#616161', Israel:'#00897B', UK:'#1A237E', Other:'#80DEEA',
    };
    const SP_CLASS_LABEL: Record<string,string> = {
      heavy:'Heavy lift', medium:'Medium lift', small:'Small lift', suborbital:'Suborbital',
    };
    const SP_STATUS_COLOR: Record<string,string> = {
      active:'#00E676', dormant:'#9E9E9E', construction:'#448AFF', planned:'#FFD500', leased:'#FF9800',
    };
    map.on('click', 'spaceports-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = SP_C[p.bloc] || '#80DEEA';
      const sC = SP_STATUS_COLOR[p.status] || '#aaa';
      const cad = Number(p.cadence_2024) || 0;
      const firstYr = Number(p.first_launch) || 0;
      const heritage = firstYr > 0 ? (new Date().getFullYear() - firstYr) : null;
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🚀 ${p.name||'Spaceport'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${(p.bloc||'').toUpperCase()}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city||''} · ${p.country||''} · ${SP_CLASS_LABEL[p.class] || p.class || ''}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;font-size:9px;">2024 LAUNCHES</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${cad}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${sC};font-weight:700;">${(p.status||'').toUpperCase()}</span></div>
        </div>
        <div style="margin-bottom:8px;font-size:10px;">
          <span style="color:#5C5A54;font-size:9px;">ACTIVE ROCKETS</span><br/>
          <span style="color:#E8E6E0;line-height:1.4;">${p.rockets||'—'}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:6px;">
          <div><span style="color:#5C5A54;">OPERATOR</span><br/><span style="color:#E8E6E0;">${p.operator||'—'}</span></div>
          <div><span style="color:#5C5A54;">FIRST LAUNCH</span><br/><span style="color:#E8E6E0;">${firstYr || '—'}${heritage != null ? ` <span style="color:#5C5A54;">(${heritage}y)</span>` : ''}</span></div>
        </div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;">${p.notes||''}</div>
      </div>`);
    });

    // ── Air quality ──
    const AQ_CAT_COLOR: Record<string,string> = {
      good:'#00E676', moderate:'#FFEB3B', usg:'#FF9800', unhealthy:'#FF1744',
      'very-unhealthy':'#AA00FF', hazardous:'#7B1FA2', unknown:'#9E9E9E',
    };
    const AQ_CAT_LABEL: Record<string,string> = {
      good:'GOOD', moderate:'MODERATE', usg:'USG', unhealthy:'UNHEALTHY',
      'very-unhealthy':'VERY UNHEALTHY', hazardous:'HAZARDOUS', unknown:'NO DATA',
    };
    const AQ_ADVICE: Record<string,string> = {
      good: 'Air is satisfactory for all groups.',
      moderate: 'Acceptable; unusually sensitive people may want to limit prolonged outdoor exertion.',
      usg: 'Sensitive groups (children, elderly, lung/heart conditions) should reduce prolonged outdoor exertion.',
      unhealthy: 'Everyone may begin to experience health effects; sensitive groups should avoid outdoor exertion.',
      'very-unhealthy': 'Health alert: serious effects possible for the general population. Stay indoors.',
      hazardous: 'Emergency conditions; entire population at risk of serious effects.',
      unknown: '',
    };
    const POLLUTANT_LABEL: Record<string,string> = {
      pm25:'PM2.5 (fine particulate)', pm10:'PM10 (coarse particulate)',
      no2:'NO₂ (vehicle/industrial)', so2:'SO₂ (industrial)', ozone:'O₃ (photochemical)',
    };
    map.on('click', 'air-quality-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const cat = p.category || 'unknown';
      const c = AQ_CAT_COLOR[cat] || '#9E9E9E';
      const aqi = Number.isFinite(Number(p.us_aqi)) ? Number(p.us_aqi) : null;
      const pm25 = Number.isFinite(Number(p.pm25)) ? Number(p.pm25) : null;
      const pm10 = Number.isFinite(Number(p.pm10)) ? Number(p.pm10) : null;
      const dom = p.dominant || null;
      // PM2.5 vs WHO 24h guideline = 15 µg/m³, scale to a 0-100% bar
      const pmBarPct = pm25 != null ? Math.min(100, (pm25 / 75) * 100) : 0;
      const measured = p.measured_at ? String(p.measured_at).replace('T', ' ') + ' UTC' : '—';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:280px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🌫️ ${p.name||'City'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${AQ_CAT_LABEL[cat]}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.country||''} · ${p.region||''}${p.population_m ? ` · ~${p.population_m}M people` : ''}</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;">
          <span style="color:${c};font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;">${aqi != null ? aqi : '—'}</span>
          <span style="color:#aaa;font-size:11px;">US AQI</span>
          ${pm25 != null ? `<span style="color:#5C5A54;font-size:10px;margin-left:auto;">PM2.5 <span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${pm25.toFixed(1)}</span> µg/m³</span>` : ''}
        </div>
        ${pm25 != null ? `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:9px;color:#5C5A54;margin-bottom:3px;">
            <span>PM2.5 vs WHO 24h guideline (15 µg/m³)</span>
            <span style="color:${c};font-weight:700;">${(pm25 / 15).toFixed(1)}×</span>
          </div>
          <div style="width:100%;height:5px;background:#1a1a24;border-radius:3px;overflow:hidden;position:relative;">
            <div style="width:${pmBarPct}%;height:100%;background:${c};border-radius:3px;"></div>
            <div style="position:absolute;left:20%;top:-1px;width:1px;height:7px;background:#999;"></div>
          </div>
        </div>` : ''}
        ${dom && POLLUTANT_LABEL[dom] ? `<div style="font-size:9px;color:#aaa;margin-bottom:8px;">Dominant load: <span style="color:${c};font-weight:700;">${POLLUTANT_LABEL[dom]}</span></div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          ${pm10 != null ? `<div><span style="color:#5C5A54;">PM10</span><br/><span style="color:#E8E6E0;">${pm10.toFixed(1)} µg/m³</span></div>` : ''}
          ${p.no2 != null && p.no2 !== 'null' ? `<div><span style="color:#5C5A54;">NO₂</span><br/><span style="color:#E8E6E0;">${Number(p.no2).toFixed(1)} µg/m³</span></div>` : ''}
          ${p.ozone != null && p.ozone !== 'null' ? `<div><span style="color:#5C5A54;">O₃</span><br/><span style="color:#E8E6E0;">${Number(p.ozone).toFixed(1)} µg/m³</span></div>` : ''}
          ${p.so2 != null && p.so2 !== 'null' ? `<div><span style="color:#5C5A54;">SO₂</span><br/><span style="color:#E8E6E0;">${Number(p.so2).toFixed(1)} µg/m³</span></div>` : ''}
        </div>
        <div style="font-size:9px;color:#aaa;line-height:1.5;margin-bottom:6px;">${AQ_ADVICE[cat]}</div>
        ${p.note && p.note !== 'undefined' ? `<div style="font-size:9px;color:#aaa;line-height:1.5;font-style:italic;margin-bottom:6px;">${p.note}</div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Open-Meteo (CAMS model) · ${measured}</div>
      </div>`);
    });

    // ── Disease outbreaks ──
    const OUTBREAK_C: Record<string,string> = {
      vhf:'#FF1744', respiratory:'#FF6B00', vector:'#AB47BC', bacterial:'#26A69A',
      vpd:'#FFEB3B', mpox:'#42A5F5', other:'#9E9E9E',
    };
    const OUTBREAK_FAMILY_LABEL: Record<string,string> = {
      vhf:'Viral hemorrhagic fever', respiratory:'Respiratory / influenza',
      vector:'Vector-borne', bacterial:'Bacterial', vpd:'Vaccine-preventable',
      mpox:'Mpox', other:'Other',
    };
    map.on('click', 'outbreaks-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const fam = p.dominant_family || 'other';
      const c = OUTBREAK_C[fam] || '#9E9E9E';
      const cnt = Number(p.count) || 0;
      const daysAgo = Number(p.most_recent_days_ago) || 0;
      const recencyLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1 day ago' :
                           daysAgo < 30 ? `${daysAgo} days ago` :
                           daysAgo < 365 ? `${Math.round(daysAgo/30)} months ago` :
                           `${(daysAgo/365).toFixed(1)} years ago`;
      let entries: any[] = [];
      try { entries = typeof p.entries === 'string' ? JSON.parse(p.entries) : (p.entries || []); } catch {}
      let diseases: string[] = [];
      try { diseases = typeof p.diseases === 'string' ? JSON.parse(p.diseases) : (p.diseases || []); } catch {}

      const familyChip = (f: string) => `<span style="display:inline-block;color:${OUTBREAK_C[f] || '#aaa'};background:${OUTBREAK_C[f] || '#aaa'}15;border:1px solid ${OUTBREAK_C[f] || '#aaa'}50;font-size:8px;padding:1px 5px;border-radius:3px;margin-right:3px;">${(f==='vhf'?'VHF':f.toUpperCase())}</span>`;

      const entryRows = entries.slice(0, 6).map((en: any) => {
        const recent = en.days_ago === 0 ? 'today' :
                       en.days_ago < 30 ? `${en.days_ago}d` :
                       en.days_ago < 365 ? `${Math.round(en.days_ago/30)}mo` :
                       `${(en.days_ago/365).toFixed(1)}y`;
        const efam = en.family || 'other';
        return `<div style="font-size:9px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;justify-content:space-between;gap:6px;">
            <a href="${en.url}" target="_blank" rel="noopener" style="color:${OUTBREAK_C[efam] || '#E8E6E0'};text-decoration:none;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${en.title}</a>
            <span style="color:#5C5A54;font-variant-numeric:tabular-nums;flex-shrink:0;">${recent}</span>
          </div>
        </div>`;
      }).join('');
      const moreEntries = entries.length > 6 ? `<div style="font-size:8px;color:#5C5A54;padding-top:3px;font-style:italic;">+ ${entries.length - 6} older reports</div>` : '';

      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:320px;max-width:380px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">☣️ ${p.name||'Outbreak'}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${cnt} REPORT${cnt===1?'':'S'}</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.region||''} · last update ${recencyLabel} (${(p.most_recent_date||'').slice(0,10)})</div>
        <div style="margin-bottom:8px;font-size:9px;color:#5C5A54;">
          Dominant family: <span style="color:${c};font-weight:700;">${OUTBREAK_FAMILY_LABEL[fam] || fam}</span>
        </div>
        ${diseases.length ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">DISEASES IN ROLLING WINDOW</div>
          ${diseases.slice(0, 6).map((dz: string) => `<span style="display:inline-block;color:#E8E6E0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:2px 6px;border-radius:3px;margin:1px 3px 1px 0;font-size:9px;">${dz}</span>`).join('')}
        </div>` : ''}
        ${entryRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:4px;">WHO DON REPORTS (click to open)</div>
          ${entryRows}${moreEntries}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Source: WHO Disease Outbreak News</div>
      </div>`);
    });

    // ── Influence Ops (named campaigns) ──
    const BLOC_INF_C: Record<string,string> = {
      Russia:'#E53935', China:'#FF6E40', Iran:'#7B1FA2', NK:'#616161',
      Israel:'#00897B', Turkey:'#FFB300', Saudi:'#43A047', UAE:'#FFD700',
      India:'#FF9800', US:'#448AFF', UK:'#1A237E', Other:'#9E9E9E',
    };
    map.on('click', 'influence-ops-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = BLOC_INF_C[p.bloc] || '#9E9E9E';
      let ops: any[] = [];
      try { ops = typeof p.ops === 'string' ? JSON.parse(p.ops) : (p.ops || []); } catch {}
      let targets: string[] = [];
      try { targets = typeof p.all_targets === 'string' ? JSON.parse(p.all_targets) : (p.all_targets || []); } catch {}
      const opsRows = ops.slice(0, 8).map((op: any) => {
        const active = op.active ? '<span style="color:#00E676;font-size:8px;">●</span>' : '<span style="color:#5C5A54;font-size:8px;">○</span>';
        return `<div style="font-size:9px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
            <span style="color:${c};font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${active} ${op.name}</span>
            <span style="color:#5C5A54;flex-shrink:0;">${op.era}</span>
          </div>
          <div style="color:#aaa;font-size:8px;margin-top:1px;line-height:1.3;">${op.description}</div>
          <div style="color:#5C5A54;font-size:8px;margin-top:2px;">Targets: <span style="color:#E8E6E0;">${(op.targets||[]).join(', ') || '—'}</span> · scale: <span style="color:#E8E6E0;">${op.scale}</span> · attr: <span style="color:#E8E6E0;">${op.confidence}</span></div>
        </div>`;
      }).join('');
      const more = ops.length > 8 ? `<div style="font-size:8px;color:#5C5A54;padding-top:3px;font-style:italic;">+ ${ops.length - 8} more</div>` : '';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:340px;max-width:420px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">📡 ${p.operator} INFLUENCE OPERATIONS</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${p.bloc}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:10px;">
          <div><span style="color:#5C5A54;font-size:9px;">NAMED OPS</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${p.total_count} (${p.active_count} active)</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">UNIQUE TARGETS</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${targets.length}</span></div>
        </div>
        ${targets.length ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">TARGETS</div>
          ${targets.slice(0, 14).map(t => `<span style="display:inline-block;color:#E8E6E0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);padding:1px 5px;border-radius:3px;margin:1px 2px 1px 0;font-size:9px;">${t}</span>`).join('')}
        </div>` : ''}
        ${opsRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:4px;">CAMPAIGNS</div>
          ${opsRows}${more}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">EUvsDisinfo · DFRLab · Stanford SIO · Mandiant · Meta ATR · Microsoft MTAC</div>
      </div>`);
    });

    // ── Influence Ops (takedowns) ──
    map.on('click', 'influence-takedowns-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = BLOC_INF_C[p.bloc] || '#9E9E9E';
      let events: any[] = [];
      try { events = typeof p.events === 'string' ? JSON.parse(p.events) : (p.events || []); } catch {}
      let byPlatform: Record<string, number> = {};
      try { byPlatform = typeof p.by_platform === 'string' ? JSON.parse(p.by_platform) : (p.by_platform || {}); } catch {}
      const totalAssets = Number(p.total_assets) || 0;
      const platRows = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([plat, n]) => `
        <div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:#E8E6E0;">${plat}</span>
          <span style="color:${c};font-variant-numeric:tabular-nums;">${(n as number).toLocaleString()} assets</span>
        </div>`).join('');
      const evRows = events.slice(0, 6).map((ev: any) => `
        <div style="font-size:9px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
            <span style="color:${c};font-weight:700;">${ev.date} · ${ev.platform}</span>
            <span style="color:#E8E6E0;font-variant-numeric:tabular-nums;">${(ev.assets||0).toLocaleString()} assets</span>
          </div>
          <div style="color:#aaa;font-size:8px;margin-top:1px;line-height:1.4;">
            <a href="${ev.source_url}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">${ev.description}</a>
          </div>
          ${ev.campaign ? `<div style="color:#5C5A54;font-size:8px;margin-top:1px;">linked to <span style="color:${c};">${ev.campaign}</span></div>` : ''}
        </div>`).join('');
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:320px;max-width:420px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🚫 ${p.operator} TAKEDOWNS</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${p.bloc}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;font-size:10px;">
          <div><span style="color:#5C5A54;font-size:9px;">TOTAL ASSETS</span><br/><span style="color:${c};font-weight:700;font-variant-numeric:tabular-nums;">${totalAssets.toLocaleString()}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">EVENTS</span><br/><span style="color:#E8E6E0;font-weight:700;font-variant-numeric:tabular-nums;">${p.event_count}</span></div>
        </div>
        ${platRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:3px;">BY PLATFORM</div>
          ${platRows}
        </div>` : ''}
        ${evRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:4px;">RECENT EVENTS</div>
          ${evRows}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">Meta Adversarial Threat Reports · X/YouTube/TikTok/OpenAI transparency disclosures</div>
      </div>`);
    });

    // ── Cyber attacks ──
    const CYBER_BLOC_C: Record<string,string> = {
      Russia:'#E53935', China:'#FF6E40', NK:'#9E9E9E', Iran:'#7B1FA2',
      Israel:'#00897B', US:'#448AFF', Criminal:'#FF1744', Hacktivist:'#FFEB3B', Other:'#9E9E9E',
    };
    const SECTOR_LABEL: Record<string,string> = {
      gov:'Government', military:'Military', 'critical-infra':'Critical Infrastructure',
      energy:'Energy', finance:'Finance', healthcare:'Healthcare', tech:'Tech',
      telecom:'Telecom', media:'Media', transport:'Transport', retail:'Retail',
      crypto:'Crypto', industrial:'Industrial',
    };
    map.on('click', 'cyber-targets-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const c = CYBER_BLOC_C[p.dominant_bloc] || '#9E9E9E';
      let attacks: any[] = [];
      try { attacks = typeof p.attacks === 'string' ? JSON.parse(p.attacks) : (p.attacks || []); } catch {}
      let blocCount: Record<string, number> = {};
      try { blocCount = typeof p.bloc_count === 'string' ? JSON.parse(p.bloc_count) : (p.bloc_count || {}); } catch {}
      const blocChips = Object.entries(blocCount).sort((a, b) => b[1] - a[1]).map(([bloc, n]) =>
        `<span style="display:inline-block;color:${CYBER_BLOC_C[bloc] || '#aaa'};background:${CYBER_BLOC_C[bloc] || '#aaa'}15;border:1px solid ${CYBER_BLOC_C[bloc] || '#aaa'}50;font-size:9px;padding:1px 5px;border-radius:3px;margin:1px 2px 1px 0;">${bloc} ×${n}</span>`).join('');
      const attackRows = attacks.slice(0, 8).map((a: any) => {
        const ac = CYBER_BLOC_C[a.operator_bloc] || '#9E9E9E';
        return `<div style="font-size:9px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
            <span style="color:${ac};font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.name}</span>
            <span style="color:#5C5A54;flex-shrink:0;font-variant-numeric:tabular-nums;">${a.date}</span>
          </div>
          <div style="color:#aaa;font-size:8px;margin-top:1px;line-height:1.4;">${a.impact_summary}</div>
          <div style="color:#5C5A54;font-size:8px;margin-top:2px;">
            <span style="color:${ac};">${a.threat_actor}</span> · ${SECTOR_LABEL[a.target_sector] || a.target_sector} · impact ${a.impact_score}/100
          </div>
        </div>`;
      }).join('');
      const more = attacks.length > 8 ? `<div style="font-size:8px;color:#5C5A54;padding-top:3px;font-style:italic;">+ ${attacks.length - 8} more</div>` : '';
      popup(coords, `<div style="${pStyle}border:1px solid ${c}40;min-width:340px;max-width:420px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:${c};font-size:13px;font-weight:700;letter-spacing:0.05em;">🔓 ${p.target_label || p.target_country}</span>
          <span style="color:${c};font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid ${c}80;border-radius:3px;">${p.total_count} ATTACKS</span>
        </div>
        ${blocChips ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">ATTRIBUTED ATTACKERS</div>
          ${blocChips}
        </div>` : ''}
        ${attackRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:4px;">INCIDENTS (most recent first)</div>
          ${attackRows}${more}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">MITRE ATT&CK · Mandiant · CrowdStrike · MSTIC · Recorded Future · US DOJ indictments · CFR Cyber Operations Tracker</div>
      </div>`);
    });

    // ── Ransomware tracker ──
    map.on('click', 'ransomware-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const cnt = Number(p.victim_count) || 0;
      const recentDays = Number(p.most_recent_days_ago) || 0;
      const recentLabel = recentDays === 0 ? 'today' : recentDays === 1 ? '1 day ago' : `${recentDays} days ago`;
      let topGroups: any[] = [];
      try { topGroups = typeof p.top_groups === 'string' ? JSON.parse(p.top_groups) : (p.top_groups || []); } catch {}
      let topSectors: any[] = [];
      try { topSectors = typeof p.top_sectors === 'string' ? JSON.parse(p.top_sectors) : (p.top_sectors || []); } catch {}
      let victims: any[] = [];
      try { victims = typeof p.victims === 'string' ? JSON.parse(p.victims) : (p.victims || []); } catch {}

      const groupChips = topGroups.slice(0, 5).map((g: any) => `<span style="display:inline-block;color:#FF80AB;background:rgba(236,64,122,0.08);border:1px solid rgba(236,64,122,0.4);font-size:9px;padding:1px 5px;border-radius:3px;margin:1px 2px 1px 0;">${g.group} ×${g.count}</span>`).join('');
      const sectorChips = topSectors.slice(0, 5).map((s: any) => `<span style="display:inline-block;color:#E8E6E0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:9px;padding:1px 5px;border-radius:3px;margin:1px 2px 1px 0;">${s.sector} ×${s.count}</span>`).join('');

      const victimRows = victims.slice(0, 10).map((v: any) => {
        const rec = v.days_ago === 0 ? 'today' : v.days_ago === 1 ? '1d' :
                    v.days_ago < 30 ? `${v.days_ago}d` :
                    v.days_ago < 365 ? `${Math.round(v.days_ago/30)}mo` :
                    `${(v.days_ago/365).toFixed(1)}y`;
        const claim = v.claim_url ? `<a href="${v.claim_url}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;">${v.victim}</a>` : v.victim;
        return `<div style="font-size:9px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
            <span style="color:#FF80AB;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${claim}</span>
            <span style="color:#5C5A54;font-variant-numeric:tabular-nums;flex-shrink:0;">${rec}</span>
          </div>
          <div style="color:#aaa;font-size:8px;margin-top:1px;">${v.group} · ${v.sector}${v.domain ? ` · ${v.domain}` : ''}</div>
        </div>`;
      }).join('');
      const more = victims.length > 10 ? `<div style="font-size:8px;color:#5C5A54;padding-top:3px;font-style:italic;">+ ${victims.length - 10} more victims</div>` : '';

      popup(coords, `<div style="${pStyle}border:1px solid rgba(236,64,122,0.4);min-width:340px;max-width:420px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#EC407A;font-size:13px;font-weight:700;letter-spacing:0.05em;">🔒 ${p.name || p.iso}</span>
          <span style="color:#EC407A;font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid rgba(236,64,122,0.5);border-radius:3px;">${cnt} VICTIMS</span>
        </div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">Most recent leak posted <span style="color:#EC407A;">${recentLabel}</span></div>
        ${groupChips ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">TOP GROUPS HITTING THIS COUNTRY</div>
          ${groupChips}
        </div>` : ''}
        ${sectorChips ? `<div style="margin-bottom:8px;font-size:9px;">
          <div style="color:#5C5A54;margin-bottom:3px;">SECTORS</div>
          ${sectorChips}
        </div>` : ''}
        ${victimRows ? `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:#5C5A54;margin-bottom:4px;">RECENT VICTIMS (click for leak-site post)</div>
          ${victimRows}${more}
        </div>` : ''}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;">ransomware.live · aggregates Tor-hosted leak-site postings</div>
      </div>`);
    });

    // ── US Macro Indicators ──
    const GROUP_LABEL: Record<string,string> = {
      inflation:'INFLATION', labor:'LABOR', growth:'GROWTH',
      liquidity:'LIQUIDITY', credit:'CREDIT', fx:'FX',
    };
    const GROUP_COLOR: Record<string,string> = {
      inflation:'#FF6B00', labor:'#00E676', growth:'#448AFF',
      liquidity:'#FFD500', credit:'#FF1744', fx:'#1DE9B6',
    };
    map.on('click', 'macro-us-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      let indicators: any[] = [];
      try { indicators = typeof p.indicators === 'string' ? JSON.parse(p.indicators) : (p.indicators || []); } catch {}
      const builtAt = p.built_at ? String(p.built_at).slice(0, 16).replace('T', ' ') : '';

      // SVG sparkline helper — small, no axes, just shape + endpoint dot
      const spark = (history: any[], color: string): string => {
        if (history.length < 2) return '';
        const W = 130, H = 26, PAD = 2;
        const vals = history.map(h => h.value);
        const minV = Math.min(...vals);
        const maxV = Math.max(...vals);
        const range = (maxV - minV) || 1;
        const pts = history.map((h, i) => {
          const x = PAD + (i / (history.length - 1)) * (W - 2 * PAD);
          const y = PAD + (1 - (h.value - minV) / range) * (H - 2 * PAD);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const lastX = PAD + (W - 2 * PAD);
        const lastY = PAD + (1 - (history[history.length - 1].value - minV) / range) * (H - 2 * PAD);
        return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;">
          <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.2" stroke-opacity="0.85" />
          <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="1.6" fill="${color}" />
        </svg>`;
      };

      // Render one card per indicator
      const formatHeadline = (ind: any): string => {
        const u = ind.unit;
        const v = ind.current_value;
        if (v == null) return '—';
        if (ind.computed === 'yoy_pct' && ind.yoy_pct != null) return `${ind.yoy_pct.toFixed(2)}<span style="font-size:8px;color:#aaa;"> ${u}</span>`;
        if (ind.computed === 'mom_change' && ind.mom_change != null) {
          const sign = ind.mom_change >= 0 ? '+' : '';
          return `${sign}${Math.round(ind.mom_change).toLocaleString()}<span style="font-size:8px;color:#aaa;"> ${u}</span>`;
        }
        // Level — format based on unit
        if (u === '$T') return `${(v / 1_000_000).toFixed(2)}<span style="font-size:8px;color:#aaa;"> $T</span>`;
        if (u === '$B') return `${(v / 1_000).toFixed(0)}<span style="font-size:8px;color:#aaa;"> $B</span>`;
        if (u === 'bps') return `${Math.round(v * 100)}<span style="font-size:8px;color:#aaa;"> bps</span>`;
        if (u === '%') return `${v.toFixed(2)}<span style="font-size:8px;color:#aaa;"> %</span>`;
        if (u === 'pp') return `${v.toFixed(2)}<span style="font-size:8px;color:#aaa;"> pp</span>`;
        if (u === 'index') return `${v.toFixed(1)}`;
        return `${v.toFixed(2)}`;
      };

      // Group indicators by their `group` field
      const byGroup = new Map<string, any[]>();
      for (const ind of indicators) {
        const g = ind.group;
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g)!.push(ind);
      }

      const groupOrder = ['inflation','labor','growth','liquidity','credit','fx'];
      const sections = groupOrder.filter(g => byGroup.has(g)).map(g => {
        const items = byGroup.get(g)!;
        const c = GROUP_COLOR[g] || '#FFD700';
        const cards = items.map((ind: any) => `
          <div style="background:rgba(0,0,0,0.3);border:1px solid ${c}30;border-radius:5px;padding:6px 8px;">
            <div style="font-size:9px;color:#5C5A54;margin-bottom:2px;">${ind.display_name}</div>
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;">
              <span style="color:${c};font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1;">${formatHeadline(ind)}</span>
              <span style="font-size:8px;color:#5C5A54;text-align:right;">${(ind.current_date||'').slice(0,7)}</span>
            </div>
            <div style="margin-top:4px;">${spark(ind.history || [], c)}</div>
          </div>`).join('');
        return `<div style="margin-bottom:8px;">
          <div style="font-size:9px;color:${c};font-weight:700;letter-spacing:0.15em;margin-bottom:4px;">${GROUP_LABEL[g] || g.toUpperCase()}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">${cards}</div>
        </div>`;
      }).join('');

      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,196,0,0.4);min-width:320px;max-width:340px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;">
          <span style="color:#FFC400;font-size:13px;font-weight:700;letter-spacing:0.05em;">🏛️ US MACRO INDICATORS</span>
          <span style="color:#FFC400;font-size:9px;font-weight:700;letter-spacing:0.15em;padding:2px 6px;border:1px solid rgba(255,196,0,0.5);border-radius:3px;">${indicators.length}</span>
        </div>
        <div style="font-size:9px;color:#5C5A54;margin-bottom:10px;">Live snapshot · built ${builtAt} UTC</div>
        ${sections}
        <div style="font-size:8px;color:#5C5A54;font-style:italic;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;">Source: algo-fund FRED+BLS backfill</div>
      </div>`);
    });

  // ─────────────────────────── HOVER CURSORS ───────────────────────────
  HOVER_LAYERS.forEach(layer => {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });
}
