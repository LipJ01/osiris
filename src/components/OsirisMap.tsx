'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import maplibregl from 'maplibre-gl';
import mqtt from 'mqtt';
import 'maplibre-gl/dist/maplibre-gl.css';

interface OsirisMapProps {
  data: any;
  activeLayers: Record<string, boolean>;
  onEntityClick?: (entity: any) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  flyToLocation?: { lat: number; lng: number; ts: number } | null;
  projection?: 'mercator' | 'globe';
  mapStyle?: string;
  wallMonitorMode?: boolean;
}

function computeSolarTerminator(): [number, number][] {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const decRad = declination * Math.PI / 180;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = (12 - utcHours) * 15;
  const points: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lngRad = (lng - subsolarLng) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lng, lat]);
  }
  const darkSide = declination >= 0 ? -90 : 90;
  points.push([180, darkSide]);
  points.push([-180, darkSide]);
  points.push(points[0]);
  return points;
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function OsirisMap({ data, activeLayers, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, flyToLocation, projection = 'globe', mapStyle = 'dark', wallMonitorMode = false }: OsirisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedShark, setSelectedShark] = useState<{ id: number; name: string; bucket: string; color: string } | null>(null);
  const prevStyleRef = useRef(mapStyle);

  const SHARK_BUCKET_COLOR: Record<string, string> = {
    white: '#E0F7FA', tiger: '#FF9500', mako: '#448AFF', blue: '#1DE9B6',
    hammerhead: '#AB47BC', whale: '#FFD700', bull: '#FF3D3D', other: '#80CBC4',
  };

  const getSubsolarLongitude = useCallback(() => {
    const now = new Date();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600 + now.getUTCMilliseconds() / 3600000;
    return ((12 - utcHours) * 15 + 540) % 360 - 180;
  }, []);

  const getSubsolarLatitude = useCallback(() => {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    return -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  }, []);

  const sliderPitchToZoom = useCallback((pitch: number) => {
    const clamped = Math.max(-8192, Math.min(8191, pitch));
    const topness = (clamped + 8192) / 16383;
    return 1.5 + topness * 6.25;
  }, []);

  // Create aircraft icon on canvas (for WebGL symbol layer)
  const createIcon = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  const createDot = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: wallMonitorMode ? [getSubsolarLongitude(), getSubsolarLatitude()] : [25.48, 42.70],
      zoom: 6.5, minZoom: 1.5, maxZoom: 18,
      attributionControl: false,
      maxPitch: 85,
    });

    map.on('load', () => {
      mapRef.current = map;
      // Create icons
      createIcon(map, 'plane-cyan', '#00E5FF', 24);
      createIcon(map, 'plane-green', '#00E676', 24);
      createIcon(map, 'plane-pink', '#FF69B4', 24);
      createIcon(map, 'plane-red', '#FF3D3D', 24);
      createIcon(map, 'plane-grey', '#555555', 24);
      createDot(map, 'dot-gold', '#D4AF37', 8);
      createDot(map, 'dot-red', '#FF3D3D', 10);
      createDot(map, 'dot-orange', '#FF9500', 10);
      createDot(map, 'dot-green', '#00E676', 10);
      createDot(map, 'dot-fire', '#FF6B00', 10);
      createDot(map, 'dot-cctv', '#39FF14', 10);

      // Sources
      const sources = ['flights','military','jets','private-fl','satellites','earthquakes','gdelt','gps-jamming','gps-jamming-daily','day-night','cctv','fires','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','conflict-zones', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'radiation', 'sharks', 'shark-track', 'shark-track-pings', 'fish-stocks', 'fishing-effort', 'fish-landings', 'oil-gas', 'mines', 'refineries', 'forests', 'cb-rates', 'submarine-cables', 'submarine-cable-landings', 'power-plants', 'military-bases', 'spaceports', 'air-quality', 'outbreaks', 'influence-arcs', 'influence-ops', 'influence-takedowns', 'cyber-arcs', 'cyber-targets', 'ransomware', 'macro-us', 'pipelines', 'mineral-arcs', 'mineral-nodes', 'refugee-arcs', 'refugee-asylum', 'storms', 'storm-tracks', 'coral-reefs', 'shipping-lanes', 'air-cargo', 'rail-corridors', 'data-centers', 'gpu-clusters', 'volcanoes', 'network-interference', 'sea-ice', 'drug-seizures', 'sanctions'];
      sources.forEach(s => map.addSource(s, { type: 'geojson', data: EMPTY_FC }));

      // ── CONFLICT ZONES — small warning markers (not polygons) ──
      // Create warning triangle icon
      const warnSize = 20;
      const warnCanvas = document.createElement('canvas');
      warnCanvas.width = warnSize; warnCanvas.height = warnSize;
      const warnCtx = warnCanvas.getContext('2d')!;
      // Triangle
      warnCtx.fillStyle = '#FF1744';
      warnCtx.beginPath();
      warnCtx.moveTo(warnSize/2, 1);
      warnCtx.lineTo(warnSize - 1, warnSize - 1);
      warnCtx.lineTo(1, warnSize - 1);
      warnCtx.closePath();
      warnCtx.fill();
      // Exclamation mark
      warnCtx.fillStyle = '#000';
      warnCtx.font = 'bold 11px sans-serif';
      warnCtx.textAlign = 'center';
      warnCtx.fillText('!', warnSize/2, warnSize - 4);
      map.addImage('warn-icon', { width: warnSize, height: warnSize, data: new Uint8Array(warnCtx.getImageData(0, 0, warnSize, warnSize).data) });

      // Orange warning
      const warnOCanvas = document.createElement('canvas');
      warnOCanvas.width = warnSize; warnOCanvas.height = warnSize;
      const warnOCtx = warnOCanvas.getContext('2d')!;
      warnOCtx.fillStyle = '#FF9500';
      warnOCtx.beginPath();
      warnOCtx.moveTo(warnSize/2, 1);
      warnOCtx.lineTo(warnSize - 1, warnSize - 1);
      warnOCtx.lineTo(1, warnSize - 1);
      warnOCtx.closePath();
      warnOCtx.fill();
      warnOCtx.fillStyle = '#000';
      warnOCtx.font = 'bold 11px sans-serif';
      warnOCtx.textAlign = 'center';
      warnOCtx.fillText('!', warnSize/2, warnSize - 4);
      map.addImage('warn-orange', { width: warnSize, height: warnSize, data: new Uint8Array(warnOCtx.getImageData(0, 0, warnSize, warnSize).data) });

      // Yellow warning
      const warnYCanvas = document.createElement('canvas');
      warnYCanvas.width = warnSize; warnYCanvas.height = warnSize;
      const warnYCtx = warnYCanvas.getContext('2d')!;
      warnYCtx.fillStyle = '#FFD500';
      warnYCtx.beginPath();
      warnYCtx.moveTo(warnSize/2, 1);
      warnYCtx.lineTo(warnSize - 1, warnSize - 1);
      warnYCtx.lineTo(1, warnSize - 1);
      warnYCtx.closePath();
      warnYCtx.fill();
      warnYCtx.fillStyle = '#000';
      warnYCtx.font = 'bold 11px sans-serif';
      warnYCtx.textAlign = 'center';
      warnYCtx.fillText('!', warnSize/2, warnSize - 4);
      map.addImage('warn-yellow', { width: warnSize, height: warnSize, data: new Uint8Array(warnYCtx.getImageData(0, 0, warnSize, warnSize).data) });

      map.addLayer({ id: 'conflict-icons', type: 'symbol', source: 'conflict-zones', layout: {
        'icon-image': ['match', ['get','severity'], 'war','warn-icon', 'high','warn-orange', 'warn-yellow'],
        'icon-size': ['interpolate',['linear'],['zoom'], 1,0.6, 4,0.8, 8,1],
        'icon-allow-overlap': true,
        'text-field': ['get','label'],
        'text-size': ['interpolate',['linear'],['zoom'], 1,7, 4,9, 8,11],
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4],
        'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','severity'], 'war','#FF1744', 'high','#FF9500', '#FFD500'],
        'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});


      // Day/Night
      map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': '#000022', 'fill-opacity': 0.35 }});

      // ── Submarine Cables (drawn early so all point markers render on top) ──
      // Glow underlay for visual richness.
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

      // Earthquakes
      map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
        'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,4, 5,12, 7,24],
        'circle-color': ['interpolate',['linear'],['get','magnitude'], 2.5,'#FFD700', 4,'#FF9500', 6,'#FF1744'],
        'circle-opacity': 0.6, 'circle-blur': 0.3, 'circle-stroke-width': 1, 'circle-stroke-color': '#FFD700', 'circle-stroke-opacity': 0.3,
      }});
      map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', filter: ['>=',['get','magnitude'],4.5], layout: {
        'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0,1.5],
      }, paint: { 'text-color': '#FFD700', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Fires
      map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,8],
        'circle-color': '#FF6B00', 'circle-opacity': 0.5, 'circle-blur': 0.5,
      }});

      // CCTV — outer glow ring
      map.addLayer({ id: 'cctv-glow', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14, 14,20],
        'circle-color': '#39FF14', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      // CCTV — main dot
      map.addLayer({ id: 'cctv-dots', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8, 14,12],
        'circle-color': '#39FF14', 'circle-opacity': 0.8,
        'circle-stroke-width': 2, 'circle-stroke-color': '#39FF14', 'circle-stroke-opacity': 0.5,
      }});
      // CCTV — labels at zoom 10+
      map.addLayer({ id: 'cctv-label', type: 'symbol', source: 'cctv', minzoom: 10, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#39FF14', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // GDELT
      map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
        'circle-radius': 4, 'circle-color': '#FF3D3D', 'circle-opacity': 0.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.3,
      }});

      // GPS Jamming — daily aggregate (gpsjam.org, H3 res-4 polygons) — render UNDER live dots
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

      // GPS Jamming — live (per-refresh NACp clusters)
      map.addLayer({ id: 'jam-fill', type: 'circle', source: 'gps-jamming', paint: { 'circle-radius': 30, 'circle-color': '#FF0000', 'circle-opacity': 0.15, 'circle-blur': 1 }});
      map.addLayer({ id: 'jam-label', type: 'symbol', source: 'gps-jamming', layout: {
        'text-field': ['concat','GPS JAM ',['to-string',['get','severity']],'%'], 'text-size': 10, 'text-font': ['Open Sans Bold'], 'text-allow-overlap': true,
      }, paint: { 'text-color': '#FF4444', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Weather Events (NASA EONET — storms, volcanoes)
      map.addLayer({ id: 'weather-glow', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,20, 10,30],
        'circle-color': '#E040FB', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14],
        'circle-color': ['match', ['get','icon'], 'cyclone','#E040FB', 'volcano','#FF1744', '#E040FB'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2, 'circle-stroke-color': '#E040FB', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', layout: {
        'text-field': ['get','title'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#E040FB', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Nuclear Infrastructure
      map.addLayer({ id: 'infra-glow', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': '#76FF03', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'infra-dots', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': ['match', ['get','status'], 'Active Conflict Zone','#FF1744', 'Destroyed / Decommissioning','#757575', '#76FF03'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2, 'circle-stroke-color': '#76FF03', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'infra-label', type: 'symbol', source: 'infrastructure', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#76FF03', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Satellites
      map.addLayer({ id: 'sat-dots', type: 'circle', source: 'satellites', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,3], 'circle-color': ['get','color'], 'circle-opacity': 0.7,
      }});

      // Maritime — ports & naval bases
      map.addLayer({ id: 'maritime-glow', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': ['match', ['get','type'], 'naval','#FF3D3D', 'energy','#FF9500', '#00BCD4'],
        'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,9],
        'circle-color': ['match', ['get','type'], 'naval','#FF3D3D', 'energy','#FF9500', '#00BCD4'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2, 'circle-stroke-color': ['match', ['get','type'], 'naval','#FF3D3D', 'energy','#FF9500', '#00BCD4'], 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#00BCD4', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Maritime chokepoints — pulsing warning diamonds
      map.addLayer({ id: 'choke-glow', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,18, 10,28],
        'circle-color': '#FF9500', 'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'circle-color': ['match', ['get','risk'], 'CRITICAL','#FF1744', 'HIGH','#FF9500', 'ELEVATED','#FFD700', '#00E676'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF9500', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF9500', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9 }});

      // Live News — broadcast dots
      map.addLayer({ id: 'news-glow', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': '#FF4081', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': '#FF4081', 'circle-opacity': 0.85,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF4081', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF4081', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
      const flightLayers = [
        { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan' },
        { id: 'fl-private', src: 'private-fl', icon: 'plane-green' },
        { id: 'fl-jets', src: 'jets', icon: 'plane-pink' },
        { id: 'fl-military', src: 'military', icon: 'plane-red' },
      ];
      flightLayers.forEach(l => {
        map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
          'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.7, 10,1],
          'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        }, paint: { 'icon-opacity': 0.85 }});
      });

      // Balloons (moving entities)
      map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 4, layout: {
        'text-field': ['get','callsign'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Radiation (glow based on reading level)
      map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,40],
        'circle-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'],
        'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
        'circle-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'], 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 5, layout: {
        'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','status'], 'DANGER','#FF1744', 'WARNING','#FF9500', '#AB47BC'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Maritime Ships (moving entities)
      map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,6],
        'circle-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9500', 'cargo','#00BCD4', '#fff'],
        'circle-opacity': 0.8,
      }});
      map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','type'], 'military','#FF1744', 'tanker','#FF9500', 'cargo','#00BCD4', '#fff'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Shark track — historical ping polyline (rendered UNDER live dots so the
      // current position stays on top). Color is set per-feature at render time.
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
        'circle-radius': ['*', STAGE_RADIUS_MUL, ['interpolate',['linear'],['zoom'], 1, 8, 5, 14, 10, 20]],
        'circle-color': MINERAL_COLOR,
        'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'mineral-nodes-dots', type: 'circle', source: 'mineral-nodes', paint: {
        'circle-radius': ['*', STAGE_RADIUS_MUL, ['interpolate',['linear'],['zoom'], 1, 3.5, 5, 6, 10, 9]],
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

      setMapReady(true);
    });

    // Events
    let lastMove = 0;
    map.on('mousemove', e => {
      const now = Date.now();
      if (now - lastMove > 100) {
        lastMove = now;
        onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
    map.on('contextmenu', e => { e.preventDefault(); onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    map.on('moveend', () => { const c = map.getCenter(); onViewStateChange?.({ zoom: map.getZoom(), latitude: c.lat }); });

    // ── POPUP HELPER ──
    const popup = (coords: any, html: string) => {
      popupRef.current?.remove();
      const pop = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: 14 }).setLngLat(coords).setHTML(html).addTo(map);
      pop.on('close', () => { setSelectedShark(null); });
      popupRef.current = pop;
    };
    const pStyle = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
    const linkStyle = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

    // ── Flights (with FlightAware + ADS-B Exchange links) ──
    ['fl-commercial','fl-private','fl-jets','fl-military'].forEach(layer => {
      map.on('click', layer, e => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates;
        const cs = (p.callsign||'').trim();
        popup(coords, `<div style="${pStyle}border:1px solid rgba(212,175,55,0.3);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#D4AF37;font-size:16px;font-weight:700;letter-spacing:0.1em;">${cs}</span>
            <span style="color:#5C5A54;font-size:10px;">${p.icao24||''}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;">
            <div><span style="color:#5C5A54;font-size:9px;">MODEL</span><br/><span style="color:#E8E6E0;">${p.model||'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">ALT</span><br/><span style="color:#00E5FF;">${p.alt?Math.round(p.alt)+'m':'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">SPEED</span><br/><span style="color:#E8E6E0;">${p.speed_knots||'—'}kt</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">HDG</span><br/><span style="color:#E8E6E0;">${Math.round(p.heading||0)}°</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">REG</span><br/><span style="color:#E8E6E0;">${p.registration||'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">POS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(2)},${coords[0].toFixed(2)}</span></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;">
            <a href="https://www.flightaware.com/live/flight/${cs}" target="_blank" style="${linkStyle}color:#D4AF37;border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.1);">⚡ FLIGHTAWARE</a>
            <a href="https://globe.adsbexchange.com/?icao=${p.icao24||''}" target="_blank" style="${linkStyle}color:#00E5FF;border:1px solid rgba(0,229,255,0.4);background:rgba(0,229,255,0.1);">📡 ADS-B</a>
            <a href="https://www.radarbox.com/data/flights/${cs}" target="_blank" style="${linkStyle}color:#FF69B4;border:1px solid rgba(255,105,180,0.4);background:rgba(255,105,180,0.1);">📍 RADARBOX</a>
          </div>
        </div>`);
        onEntityClick?.(p);
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── CCTV (opens CameraViewer panel) ──
    map.on('click', 'cctv-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      // Emit the camera data so the CameraViewer opens
      onEntityClick?.({
        type: 'cctv',
        id: p.id,
        name: p.name,
        city: p.city,
        country: p.country,
        source: p.source,
        feed_url: p.feed_url,
        stream_url: p.stream_url,
        stream_type: p.stream_type,
        external_url: p.external_url,
        lat: coords[1],
        lng: coords[0],
      });
      // Also fly to the camera
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 1000 });
    });

    // ── Earthquakes (with USGS link) ──
    map.on('click', 'eq-circles', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.3);">
        <div style="color:#FF9500;font-size:14px;font-weight:700;margin-bottom:4px;">M${p.magnitude} EARTHQUAKE</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${p.place||'Unknown location'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">DEPTH</span><br/><span style="color:#E8E6E0;">${p.depth||'—'}km</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}</span></div>
        </div>
        <a href="https://earthquake.usgs.gov/earthquakes/eventpage/${p.id||''}" target="_blank" style="${linkStyle}color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">📊 USGS DETAILS</a>
      </div>`);
    });

    // ── Satellites (with N2YO tracking) ──
    map.on('click', 'sat-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(212,175,55,0.3);">
        <div style="color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🛰️ ${p.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">MISSION</span><br/><span style="color:${p.color||'#aaa'};">${p.mission||'Unknown'}</span></div>
          <div><span style="color:#5C5A54;">POS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°</span></div>
        </div>
        <a href="https://www.n2yo.com/?s=${encodeURIComponent(p.name||'')}" target="_blank" style="${linkStyle}color:#D4AF37;border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.1);">🔭 TRACK ON N2YO</a>
      </div>`);
    });

    // ── Fires (with NASA FIRMS link) ──
    map.on('click', 'fires-heat', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,107,0,0.3);">
        <div style="color:#FF6B00;font-size:12px;font-weight:700;margin-bottom:6px;">🔥 ACTIVE FIRE DETECTED</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">BRIGHTNESS</span><br/><span style="color:#FF6B00;">${p.brightness||'—'}K</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z" target="_blank" style="${linkStyle}color:#FF6B00;border:1px solid rgba(255,107,0,0.4);background:rgba(255,107,0,0.1);">🛰️ NASA FIRMS MAP</a>
      </div>`);
    });

    // ── GDELT Conflicts (with source article) ──
    map.on('click', 'gdelt-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,61,61,0.3);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ CONFLICT EVENT</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.name||'Unclassified incident'}</div>
        <div style="display:flex;gap:6px;">
          ${p.url ? `<a href="${p.url}" target="_blank" style="${linkStyle}color:#FF3D3D;border:1px solid rgba(255,61,61,0.4);background:rgba(255,61,61,0.1);">SOURCE</a>` : ''}
          <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},12z" target="_blank" style="${linkStyle}color:#448AFF;border:1px solid rgba(68,138,255,0.4);background:rgba(68,138,255,0.1);">MAP</a>
        </div>
      </div>`);
    });

    // ── Global Event / Conflict Markers ──
    map.on('click', 'conflict-icons', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.severity === 'war' ? '#FF1744' : p.severity === 'high' ? '#FF9500' : '#FFD500';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ ${p.label || 'WARNING EVENT'}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.description || 'Global event detected at this location.'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${color};">${(p.severity||'unknown').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
      </div>`);
    });


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

    // ── Generic hover for clickables ──
    ['conflict-icons','cctv-dots','eq-circles','sat-dots','fires-heat','gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots','balloon-dots','rad-dots','ship-dots','shark-dots','fish-stocks-dots','fishing-effort-ring','fish-landings-dots','oil-gas-dots','mines-dots','refineries-dots','forests-dots','cb-rates-dots','subcables-line','subcable-landings','power-plants-dots','military-bases-dots','spaceports-dots','air-quality-dots','outbreaks-dots','influence-ops-dots','influence-takedowns-dots','cyber-targets-dots','ransomware-dots','macro-us-dots','pipelines-line','mineral-nodes-dots','refugee-asylum-dots','storms-dots','coral-reefs-dots','shipping-lanes-line','air-cargo-dots','rail-corridors-line','data-centers-dots','gpu-clusters-dots','volcanoes-dots','network-interference-dots','sea-ice-dots','drug-seizures-dots','sanctions-dots'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── Balloons / Sondes ──
    map.on('click', 'balloon-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid ${p.color}40;">
        <div style="color:${p.color};font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🎈 ${p.callsign}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.type.toUpperCase()} / STATUS: ${p.status.toUpperCase()}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALTITUDE</span><br/><span style="color:#E8E6E0;">${p.altitude} m</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${Math.round(p.speed)} km/h</span></div>
          <div><span style="color:#5C5A54;">VERT RATE</span><br/><span style="color:${p.verticalRate > 0 ? '#00E676' : '#FF3D3D'};">${p.verticalRate.toFixed(1)} m/s</span></div>
          <div><span style="color:#5C5A54;">TEMP</span><br/><span style="color:#E8E6E0;">${p.temperature}°C</span></div>
        </div>
      </div>`);
    });

    // ── Radiation ──
    map.on('click', 'rad-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.status === 'DANGER' ? '#FF1744' : p.status === 'WARNING' ? '#FF9500' : '#AB47BC';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">☢️ ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city}, ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">READING</span><br/><span style="color:${color};font-weight:bold;">${p.reading} nSv/h</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${color};">${p.status}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">NETWORK</span><br/><span style="color:#E8E6E0;">${p.network}</span></div>
        </div>
      </div>`);
    });

    // ── Maritime Ships ──
    map.on('click', 'ship-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.type === 'military' ? '#FF1744' : p.type === 'tanker' ? '#FF9500' : '#00BCD4';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;">🚢 ${p.name}</span>
          <span style="color:#aaa;font-size:9px;">${p.flag}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">TYPE</span><br/><span style="color:${color};">${p.type.toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${p.speed} knots</span></div>
          <div><span style="color:#5C5A54;">HEADING</span><br/><span style="color:#E8E6E0;">${p.heading}°</span></div>
          <div><span style="color:#5C5A54;">DEST</span><br/><span style="color:#E8E6E0;">${p.destination || 'UNKNOWN'}</span></div>
        </div>
      </div>`);
    });

    // ── Weather Events (NASA EONET) ──
    map.on('click', 'weather-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const iconEmoji = p.icon === 'cyclone' ? '🌀' : p.icon === 'volcano' ? '🌋' : '⚡';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(224,64,251,0.3);">
        <div style="color:#E040FB;font-size:14px;font-weight:700;margin-bottom:6px;">${iconEmoji} ${p.type || 'Weather Event'}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.title || 'Unknown event'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FFD700'};">${(p.severity||'low').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.source ? `<a href="${p.source}" target="_blank" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">📡 SOURCE</a>` : ''}
          <a href="https://eonet.gsfc.nasa.gov/api/v3/events/${p.id || ''}" target="_blank" style="${linkStyle}color:#D4AF37;border:1px solid rgba(212,175,55,0.4);background:rgba(212,175,55,0.1);">🛰️ NASA EONET</a>
        </div>
      </div>`);
    });

    // ── Nuclear Infrastructure ──
    map.on('click', 'infra-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const statusColor = p.status === 'Active Conflict Zone' ? '#FF1744' : p.status === 'Operational' ? '#76FF03' : '#757575';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(118,255,3,0.3);">
        <div style="color:#76FF03;font-size:14px;font-weight:700;margin-bottom:4px;">☢️ ${p.name || 'Nuclear Facility'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">STATUS</span><br/><span style="color:${statusColor};">${p.status || '—'}</span></div>
          <div><span style="color:#5C5A54;">CITY</span><br/><span style="color:#E8E6E0;">${p.city || '—'}, ${p.country || ''}</span></div>
          <div><span style="color:#5C5A54;">REACTORS</span><br/><span style="color:#76FF03;">${p.reactors || '—'}</span></div>
          <div><span style="color:#5C5A54;">CAPACITY</span><br/><span style="color:#E8E6E0;">${p.capacityMW ? p.capacityMW.toLocaleString() + ' MW' : '—'}</span></div>
          <div><span style="color:#5C5A54;">OWNER</span><br/><span style="color:#E8E6E0;">${p.owner || '—'}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" style="${linkStyle}color:#76FF03;border:1px solid rgba(118,255,3,0.4);background:rgba(118,255,3,0.1);">SATELLITE VIEW</a>
      </div>`);
    });

    // ── Maritime Ports & Naval Bases ──
    map.on('click', 'maritime-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const typeColor = p.type === 'naval' ? '#FF3D3D' : p.type === 'energy' ? '#FF9500' : '#00BCD4';
      const typeLabel = p.type === 'naval' ? 'NAVAL BASE' : p.type === 'energy' ? 'ENERGY PORT' : 'CONTAINER PORT';
      popup(coords, `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="color:${typeColor};font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="color:#999;font-size:9px;margin-bottom:6px;">${typeLabel} — ${p.country}</div>
        ${p.volume ? `<div style="font-size:9px;color:#aaa;">Volume: <span style="color:${typeColor};font-weight:bold;">${p.volume}</span></div>` : ''}
        ${p.fleet ? `<div style="font-size:9px;color:#aaa;">Fleet: <span style="color:${typeColor};font-weight:bold;">${p.fleet}</span></div>` : ''}
        ${p.rank ? `<div style="font-size:9px;color:#aaa;">Global Rank: <span style="color:${typeColor};font-weight:bold;">#${p.rank}</span></div>` : ''}
      </div>`);
    });

    // ── Maritime Chokepoints ──
    map.on('click', 'choke-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const riskCol = p.risk === 'CRITICAL' ? '#FF1744' : p.risk === 'HIGH' ? '#FF9500' : p.risk === 'ELEVATED' ? '#FFD700' : '#00E676';
      popup(coords, `<div style="${pStyle}border:1px solid ${riskCol}40;">
        <div style="color:#FF9500;font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="font-size:9px;color:#aaa;">Traffic: <span style="color:#fff;">${p.traffic}</span></div>
        <div style="font-size:9px;color:#aaa;">Risk: <span style="color:${riskCol};font-weight:bold;">${p.risk}</span></div>
      </div>`);
    });

    // ── Live News (opens feed viewer) ──
    map.on('click', 'news-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      onEntityClick?.({
        type: 'live_news',
        name: p.name,
        city: p.city,
        country: p.country,
        url: p.url,
        category: p.category,
        embed_allowed: p.embed_allowed !== false && p.embed_allowed !== 'false',
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, [createDot, createIcon, getSubsolarLongitude, getSubsolarLatitude, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, wallMonitorMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !wallMonitorMode) return;
    const map = mapRef.current;
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (ts - last > 1000 && !map.isMoving()) {
        last = ts;
        map.jumpTo({
          center: [getSubsolarLongitude(), getSubsolarLatitude()],
          bearing: 0,
          pitch: 20,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getSubsolarLongitude, getSubsolarLatitude, mapReady, wallMonitorMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !wallMonitorMode) return;
    const map = mapRef.current;
    const client = mqtt.connect('ws://mqtt.lab/mqtt', {
      clientId: `osiris-wall-${Math.random().toString(36).slice(2, 8)}`,
      reconnectPeriod: 2000,
      keepalive: 30,
    });
    client.on('connect', () => {
      client.subscribe('lab/xtouch/slider');
    });
    client.on('message', (topic, payload) => {
      if (topic !== 'lab/xtouch/slider') return;
      const [, pitchRaw] = payload.toString().split(',', 2);
      const pitch = Number.parseInt(pitchRaw, 10);
      if (!Number.isFinite(pitch)) return;
      const zoom = sliderPitchToZoom(pitch);
      map.easeTo({ zoom, duration: 160, essential: true });
      const c = map.getCenter();
      onViewStateChange?.({ zoom, latitude: c.lat });
    });
    return () => {
      client.end(true);
    };
  }, [mapReady, onViewStateChange, sliderPitchToZoom, wallMonitorMode]);

  // Day/Night
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const update = () => {
      const src = map.getSource('day-night') as any;
      if (!src) return;
      if (!activeLayers.day_night) { src.setData(EMPTY_FC); return; }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [computeSolarTerminator()] }, properties: {} }] });
    };
    update();
    const iv = setInterval(update, 300000); // 5 min (was 1 min — shadow barely moves)
    return () => clearInterval(iv);
  }, [mapReady, activeLayers.day_night]);

  // Helper to set GeoJSON
  const setGeo = useCallback((source: string, features: any[]) => {
    const src = mapRef.current?.getSource(source) as any;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  // Flight data → GeoJSON (GPU rendered)
  useEffect(() => {
    if (!mapReady) return;
    const toFeatures = (arr: any[]) => (arr || []).map((f: any) => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
      properties: { callsign: f.callsign, heading: f.heading || 0, alt: f.alt, model: f.model, speed_knots: f.speed_knots, registration: f.registration, icao24: f.icao24 },
    }));
    setGeo('flights', activeLayers.flights ? toFeatures(data.commercial_flights) : []);
    setGeo('private-fl', activeLayers.private ? toFeatures(data.private_flights) : []);
    setGeo('jets', activeLayers.jets ? toFeatures(data.private_jets) : []);
    setGeo('military', activeLayers.military ? toFeatures(data.military_flights) : []);
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, activeLayers.flights, activeLayers.private, activeLayers.jets, activeLayers.military]);

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEffect(() => {
    if (!mapReady) return;
    setGeo('earthquakes', activeLayers.earthquakes && data.earthquakes ? data.earthquakes.map((eq: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] }, properties: { magnitude: eq.magnitude, place: eq.place } })) : []);
  }, [mapReady, data.earthquakes, activeLayers.earthquakes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('satellites', activeLayers.satellites && data.satellites ? data.satellites.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: s.color, mission: s.mission } })) : []);
  }, [mapReady, data.satellites, activeLayers.satellites, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('gdelt', activeLayers.global_incidents && data.gdelt ? data.gdelt.map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { name: e.name } })) : []);
  }, [mapReady, data.gdelt, activeLayers.global_incidents, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('gps-jamming', activeLayers.gps_jamming && data.gps_jamming ? data.gps_jamming.map((z: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [z.lng, z.lat] }, properties: { severity: z.severity } })) : []);
  }, [mapReady, data.gps_jamming, activeLayers.gps_jamming, setGeo]);

  // GPS Jamming — daily aggregate from gpsjam.org (FeatureCollection passes straight through)
  useEffect(() => {
    if (!mapReady) return;
    const fc = data.gps_jamming_daily as any;
    setGeo('gps-jamming-daily', activeLayers.gps_jamming_daily && fc?.features ? fc.features : []);
  }, [mapReady, data.gps_jamming_daily, activeLayers.gps_jamming_daily, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('cctv', activeLayers.cctv && data.cameras ? data.cameras.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { id: c.id, name: c.name, city: c.city, country: c.country, source: c.source, feed_url: c.feed_url, stream_url: c.stream_url, stream_type: c.stream_type, external_url: c.external_url } })) : []);
  }, [mapReady, data.cameras, activeLayers.cctv, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('fires', activeLayers.fires && data.fires ? data.fires.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { brightness: f.brightness } })) : []);
  }, [mapReady, data.fires, activeLayers.fires, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('weather', activeLayers.weather && data.weather_events ? data.weather_events.map((w: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { title: w.title, type: w.type, icon: w.icon, severity: w.severity, source: w.source, id: w.id } })) : []);
  }, [mapReady, data.weather_events, activeLayers.weather, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('infrastructure', activeLayers.infrastructure && data.infrastructure ? data.infrastructure.map((i: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { name: i.name, city: i.city, country: i.country, status: i.status, reactors: i.reactors, capacityMW: i.capacityMW, owner: i.owner } })) : []);
  }, [mapReady, data.infrastructure, activeLayers.infrastructure, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('maritime', activeLayers.maritime && data.maritime_ports ? data.maritime_ports.map((p: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, country: p.country, type: p.type, volume: p.volume, fleet: p.fleet, rank: p.rank } })) : []);
    setGeo('maritime-choke', activeLayers.maritime && data.maritime_chokepoints ? data.maritime_chokepoints.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { name: c.name, traffic: c.traffic, risk: c.risk } })) : []);
    setGeo('maritime-ships', activeLayers.maritime && data.maritime_ships ? data.maritime_ships.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, type: s.type, speed: s.speed, heading: s.heading, destination: s.destination, flag: s.flag } })) : []);
  }, [mapReady, data.maritime_ports, data.maritime_chokepoints, data.maritime_ships, activeLayers.maritime, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('balloons', activeLayers.balloons && data.balloons ? data.balloons.map((b: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lng, b.lat] }, properties: { callsign: b.callsign, type: b.type, status: b.status, altitude: b.altitude, speed: b.speed, verticalRate: b.verticalRate, temperature: b.temperature, color: b.color } })) : []);
  }, [mapReady, data.balloons, activeLayers.balloons, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('radiation', activeLayers.radiation && data.radiation ? data.radiation.map((r: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { name: r.name, city: r.city, country: r.country, reading: r.reading, status: r.status, network: r.network } })) : []);
  }, [mapReady, data.radiation, activeLayers.radiation, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('live-news', activeLayers.live_news && data.live_feeds ? data.live_feeds.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { name: f.name, city: f.city, country: f.country, url: f.url, category: f.category, embed_allowed: f.embed_allowed !== false } })) : []);
  }, [mapReady, data.live_feeds, activeLayers.live_news, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('sharks', activeLayers.sharks && data.sharks ? data.sharks.map((s: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id, slug: s.slug, name: s.name, species: s.species, bucket: s.bucket,
        length: s.length, weight: s.weight, gender: s.gender, stage_of_life: s.stage_of_life,
        tag_location: s.tag_location, last_ping: s.last_ping, image: s.image,
      },
    })) : []);
  }, [mapReady, data.sharks, activeLayers.sharks, setGeo]);

  // Quadratic bezier between two lng/lat points; bulge proportional to distance
  // so short arcs stay subtle and intercontinental arcs become readable curves.
  const arcPoints = useCallback((startLng: number, startLat: number, endLng: number, endLat: number, segments = 24): number[][] => {
    const dx = endLng - startLng;
    const dy = endLat - startLat;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return [[startLng, startLat], [endLng, endLat]];
    const mx = (startLng + endLng) / 2;
    const my = (startLat + endLat) / 2;
    const offset = Math.min(dist * 0.25, 25);
    // Perpendicular to the start→end vector, bulging "northward" if going east
    const cx = mx - (dy / dist) * offset;
    const cy = my + (dx / dist) * offset;
    const pts: number[][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * cx + t * t * endLng;
      const y = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * cy + t * t * endLat;
      pts.push([x, y]);
    }
    return pts;
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const payload = (activeLayers.macro_us && data.macro_us) ? data.macro_us : null;
    if (!payload) {
      setGeo('macro-us', []);
      return;
    }
    setGeo('macro-us', [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [payload.lng, payload.lat] },
      properties: {
        city: payload.city, country: payload.country,
        indicator_count: (payload.indicators || []).length,
        indicators: JSON.stringify(payload.indicators || []),
        built_at: payload.built_at,
      },
    }]);
  }, [mapReady, data.macro_us, activeLayers.macro_us, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const countries = (activeLayers.ransomware && data.ransomware_countries) ? data.ransomware_countries : [];
    const maxCount = countries.reduce((m: number, c: any) => Math.max(m, c.victim_count || 0), 0) || 1;
    setGeo('ransomware', countries.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        iso: c.iso, name: c.name, victim_count: c.victim_count,
        most_recent_date: c.most_recent_date,
        most_recent_days_ago: c.most_recent_days_ago,
        top_groups: JSON.stringify(c.top_groups || []),
        top_sectors: JSON.stringify(c.top_sectors || []),
        victims: JSON.stringify(c.victims || []),
        intensity: Math.min(1, Math.sqrt((c.victim_count || 0) / maxCount)),
      },
    })));
  }, [mapReady, data.ransomware_countries, activeLayers.ransomware, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const arcs = (activeLayers.cyber_attacks && data.cyber_arcs) ? data.cyber_arcs : [];
    const targets = (activeLayers.cyber_attacks && data.cyber_targets) ? data.cyber_targets : [];

    // Cyber arc features
    setGeo('cyber-arcs', arcs.map((a: any) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arcPoints(a.operator_lng, a.operator_lat, a.target_lng, a.target_lat) },
      properties: { bloc: a.operator_bloc, attack_name: a.attack_name, threat_actor: a.threat_actor },
    })));

    // Target country markers
    const maxCount = targets.reduce((m: number, t: any) => Math.max(m, t.total_count || 0), 0) || 1;
    setGeo('cyber-targets', targets.map((t: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: {
        target_country: t.target_country, target_label: t.target_label,
        total_count: t.total_count, dominant_bloc: t.dominant_bloc,
        total_impact: t.total_impact, most_recent_date: t.most_recent_date,
        bloc_count: JSON.stringify(t.bloc_count || {}),
        attacks: JSON.stringify(t.attacks || []),
        intensity: Math.min(1, Math.sqrt((t.total_count || 0) / maxCount)),
      },
    })));
  }, [mapReady, data.cyber_arcs, data.cyber_targets, activeLayers.cyber_attacks, setGeo, arcPoints]);

  useEffect(() => {
    if (!mapReady) return;
    const ops = (activeLayers.influence_campaigns && data.influence_campaigns_ops) ? data.influence_campaigns_ops : [];
    const operators = (activeLayers.influence_campaigns && data.influence_campaigns_operators) ? data.influence_campaigns_operators : [];

    // Arc features — one per (op, target). Pre-compute geometry.
    const arcFeatures: any[] = [];
    for (const op of ops) {
      for (const arc of (op.arcs || [])) {
        if (!Number.isFinite(arc.lat) || !Number.isFinite(arc.lng)) continue;
        arcFeatures.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: arcPoints(op.operator_lng, op.operator_lat, arc.lng, arc.lat) },
          properties: { bloc: op.operator_bloc, op_name: op.name, target: arc.iso },
        });
      }
    }
    setGeo('influence-arcs', arcFeatures);

    // Operator markers
    const maxOps = operators.reduce((m: number, o: any) => Math.max(m, o.total_count || 0), 0) || 1;
    setGeo('influence-ops', operators.map((o: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
      properties: {
        operator: o.operator, bloc: o.operator_bloc,
        total_count: o.total_count, active_count: o.active_count,
        all_targets: JSON.stringify(o.all_targets || []),
        ops: JSON.stringify(o.ops || []),
        intensity: Math.min(1, Math.sqrt((o.total_count || 0) / maxOps)),
      },
    })));
  }, [mapReady, data.influence_campaigns_ops, data.influence_campaigns_operators, activeLayers.influence_campaigns, setGeo, arcPoints]);

  useEffect(() => {
    if (!mapReady) return;
    const takedowns = (activeLayers.influence_takedowns && data.influence_takedowns_operators) ? data.influence_takedowns_operators : [];
    // Log-scale intensity by total assets (range ~5..50000)
    const maxLog = Math.log10(takedowns.reduce((m: number, t: any) => Math.max(m, t.total_assets || 0), 1) + 1) || 1;
    const compact = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n);
    setGeo('influence-takedowns', takedowns.map((t: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: {
        operator: t.operator, bloc: t.operator_bloc,
        total_assets: t.total_assets, event_count: t.event_count,
        assets_display: compact(t.total_assets || 0),
        recent_date: t.recent_date, recent_days_ago: t.recent_days_ago,
        events: JSON.stringify(t.events || []),
        by_platform: JSON.stringify(t.by_platform || {}),
        intensity: Math.min(1, Math.log10((t.total_assets || 0) + 1) / maxLog),
      },
    })));
  }, [mapReady, data.influence_takedowns_operators, activeLayers.influence_takedowns, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const markers = (activeLayers.outbreaks && data.outbreaks) ? data.outbreaks : [];
    const maxCount = markers.reduce((m: number, x: any) => Math.max(m, x.count || 0), 0) || 1;
    setGeo('outbreaks', markers.map((m: any) => {
      const days = Number(m.most_recent_days_ago) || 999;
      const recency = Math.max(0, 1 - days / 365); // 0..1, recent=1
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        properties: {
          iso: m.iso, name: m.name, region: m.region,
          is_regional: m.is_regional,
          count: m.count,
          most_recent_days_ago: m.most_recent_days_ago,
          most_recent_date: m.most_recent_date,
          dominant_family: m.dominant_family,
          diseases: JSON.stringify(m.diseases || []),
          entries: JSON.stringify(m.entries || []),
          intensity: Math.min(1, Math.sqrt((m.count || 0) / maxCount)),
          recency,
        },
      };
    }));
  }, [mapReady, data.outbreaks, activeLayers.outbreaks, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const cities = (activeLayers.air_quality && data.air_quality) ? data.air_quality : [];
    setGeo('air-quality', cities.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        name: c.name, country: c.country, region: c.region,
        population_m: c.population_m, note: c.note || null,
        pm25: c.pm25, pm10: c.pm10, us_aqi: c.us_aqi, european_aqi: c.european_aqi,
        no2: c.no2, so2: c.so2, ozone: c.ozone, co: c.co,
        category: c.category, dominant: c.dominant, measured_at: c.measured_at,
      },
    })));
  }, [mapReady, data.air_quality, activeLayers.air_quality, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const ports = (activeLayers.spaceports && data.spaceports) ? data.spaceports : [];
    setGeo('spaceports', ports.map((s: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        name: s.name, city: s.city, country: s.country, bloc: s.bloc,
        region: s.region, class: s.class, status: s.status,
        first_launch: s.first_launch, cadence_2024: s.cadence_2024,
        rockets: s.rockets, operator: s.operator, notes: s.notes,
        intensity: s.intensity,
      },
    })));
  }, [mapReady, data.spaceports, activeLayers.spaceports, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const bases = (activeLayers.military_bases && data.military_bases) ? data.military_bases : [];
    setGeo('military-bases', bases.map((b: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      properties: {
        name: b.name, city: b.city, host: b.host, operator: b.operator, bloc: b.bloc,
        region: b.region, type: b.type, personnel: b.personnel, status: b.status,
        function: b.function, notes: b.notes, intensity: b.intensity,
      },
    })));
  }, [mapReady, data.military_bases, activeLayers.military_bases, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const plants = (activeLayers.power_plants && data.power_plants) ? data.power_plants : [];
    setGeo('power-plants', plants.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name: p.name, country: p.country, region: p.region, type: p.type,
        capacity_mw: p.capacity_mw, operator: p.operator, status: p.status,
        year: p.year, notes: p.notes, intensity: p.intensity,
      },
    })));
  }, [mapReady, data.power_plants, activeLayers.power_plants, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const reefs = (activeLayers.coral_reefs && data.coral_reefs) ? data.coral_reefs : [];
    setGeo('coral-reefs', reefs.map((r: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, country: r.country, region: r.region, status: r.status,
        area_km2: r.area_km2, last_bleaching: r.last_bleaching,
        bleaching_events_since_2000: r.bleaching_events_since_2000,
        threats: JSON.stringify(r.threats || []),
        notable_species: r.notable_species, notes: r.notes,
        intensity: r.intensity,
      },
    })));
  }, [mapReady, data.coral_reefs, activeLayers.coral_reefs, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const sanc = (activeLayers.sanctions && data.sanctions) ? data.sanctions : [];
    // Square-root scale across the dataset so US-vs-Russia spread is readable
    const maxCount = sanc.reduce((m: number, c: any) => Math.max(m, c.target_count || 0), 0) || 1;
    const compact = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
    setGeo('sanctions', sanc.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        iso: c.iso, name: c.name,
        target_count: c.target_count, thing_count: c.thing_count,
        severity: c.severity,
        count_display: compact(c.target_count),
        intensity: Math.min(1, Math.sqrt(c.target_count / maxCount)),
      },
    })));
  }, [mapReady, data.sanctions, activeLayers.sanctions, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const seiz = (activeLayers.drug_seizures && data.drug_seizures) ? data.drug_seizures : [];
    setGeo('drug-seizures', seiz.map((s: any) => {
      const kg = s.quantity_kg || 0;
      const qtyDisplay = kg >= 1000 ? `${(kg/1000).toFixed(1)}t` : `${kg}kg`;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: {
          name: s.name, date: s.date, city: s.city, country: s.country, region: s.region,
          drug: s.drug, quantity_kg: s.quantity_kg, quantity_display: qtyDisplay,
          street_value_usd_millions: s.street_value_usd_millions,
          agency: s.agency, origin_country: s.origin_country, destination_country: s.destination_country,
          attributed_org: s.attributed_org, notes: s.notes, intensity: s.intensity,
        },
      };
    }));
  }, [mapReady, data.drug_seizures, activeLayers.drug_seizures, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const poles = (activeLayers.sea_ice && data.sea_ice) ? data.sea_ice : [];
    setGeo('sea-ice', poles.map((p: any) => {
      const anomalySign = p.anomaly_mkm2 >= 0 ? '+' : '';
      const headline = `${p.current_extent_mkm2.toFixed(1)} Mkm² (${anomalySign}${p.anomaly_pct.toFixed(0)}%)`;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          pole: p.pole,
          current_extent_mkm2: p.current_extent_mkm2,
          current_date: p.current_date,
          climatology_mean_mkm2: p.climatology_mean_mkm2,
          climatology_std_mkm2: p.climatology_std_mkm2,
          anomaly_mkm2: p.anomaly_mkm2,
          anomaly_pct: p.anomaly_pct,
          z_score: p.z_score,
          percentile: p.percentile_estimate,
          headline,
          recent_year: JSON.stringify(p.recent_year || []),
          climatology_band: JSON.stringify(p.climatology_band || []),
        },
      };
    }));
  }, [mapReady, data.sea_ice, activeLayers.sea_ice, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const niCountries = (activeLayers.network_interference && data.network_interference) ? data.network_interference : [];
    setGeo('network-interference', niCountries.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        iso: c.iso, name: c.name,
        measurement_count: c.measurement_count,
        anomaly_count: c.anomaly_count,
        confirmed_count: c.confirmed_count,
        failure_count: c.failure_count,
        ok_count: c.ok_count,
        anomaly_rate: c.anomaly_rate,
        rate_display: (c.anomaly_rate * 100).toFixed(0) + '%',
        severity: c.severity,
      },
    })));
  }, [mapReady, data.network_interference, activeLayers.network_interference, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const volcs = (activeLayers.volcanoes && data.volcanoes) ? data.volcanoes : [];
    setGeo('volcanoes', volcs.map((v: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
      properties: {
        id: v.id, name: v.name, country: v.country,
        last_update: v.last_update, days_ago: v.days_ago,
        smithsonian_url: v.smithsonian_url, eonet_url: v.eonet_url,
        sources: JSON.stringify(v.sources || []),
        raw_title: v.raw_title,
      },
    })));
  }, [mapReady, data.volcanoes, activeLayers.volcanoes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const storms = (activeLayers.storms && data.storms) ? data.storms : [];
    setGeo('storms', storms.map((s: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id, name: s.name, title: s.title, basin: s.basin,
        classification: s.classification, category: s.category,
        max_wind_mph: s.max_wind_mph, pressure_mbar: s.pressure_mbar,
        movement: s.movement, source: s.source, source_url: s.source_url,
      },
    })));
    // Track polylines for storms that have a track history (mostly EONET)
    const trackFeats = storms
      .filter((s: any) => Array.isArray(s.track) && s.track.length >= 2)
      .map((s: any) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: s.track.map((p: any) => [p.lng, p.lat]) },
        properties: { id: s.id, name: s.name },
      }));
    setGeo('storm-tracks', trackFeats);
  }, [mapReady, data.storms, activeLayers.storms, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const corridors = (activeLayers.refugees && data.refugee_corridors) ? data.refugee_corridors : [];
    const asylum = (activeLayers.refugees && data.refugee_asylum) ? data.refugee_asylum : [];
    const compactM = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : (n / 1000).toFixed(0) + 'k';
    setGeo('refugee-arcs', corridors.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arcPoints(c.origin_lng, c.origin_lat, c.asylum_lng, c.asylum_lat) },
      properties: {
        origin: c.origin, origin_name: c.origin_name,
        asylum: c.asylum, asylum_name: c.asylum_name,
        refugees: c.refugees,
      },
    })));
    setGeo('refugee-asylum', asylum.map((m: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
      properties: {
        iso: m.iso, name: m.name,
        total_refugees: m.total_refugees, origin_count: m.origin_count,
        total_display: compactM(m.total_refugees),
        origins: JSON.stringify(m.origins || []),
        year: data.refugee_year || '',
      },
    })));
  }, [mapReady, data.refugee_corridors, data.refugee_asylum, data.refugee_year, activeLayers.refugees, setGeo, arcPoints]);

  useEffect(() => {
    if (!mapReady) return;
    const nodes = (activeLayers.mineral_chains && data.mineral_nodes) ? data.mineral_nodes : [];
    const edges = (activeLayers.mineral_chains && data.mineral_edges) ? data.mineral_edges : [];
    setGeo('mineral-arcs', edges.map((e: any) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arcPoints(e.from_lng, e.from_lat, e.to_lng, e.to_lat) },
      properties: {
        from: e.from, to: e.to,
        from_name: e.from_name, to_name: e.to_name,
        from_bloc: e.from_bloc, to_bloc: e.to_bloc,
        commodity: e.commodity, weight: e.weight, notes: e.notes || null,
      },
    })));
    setGeo('mineral-nodes', nodes.map((n: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
      properties: {
        id: n.id, name: n.name, city: n.city, country: n.country,
        stage: n.stage, commodity: n.commodity, bloc: n.bloc,
        operator: n.operator, capacity: n.capacity, notes: n.notes,
      },
    })));
  }, [mapReady, data.mineral_nodes, data.mineral_edges, activeLayers.mineral_chains, setGeo, arcPoints]);

  useEffect(() => {
    if (!mapReady) return;
    const dcs = (activeLayers.data_centers && data.data_centers) ? data.data_centers : [];
    setGeo('data-centers', dcs.map((d: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: {
        name: d.name, city: d.city, country: d.country, region: d.region,
        type: d.type, operator: d.operator, capacity_mw: d.capacity_mw,
        scale: d.scale, notes: d.notes, intensity: d.intensity,
      },
    })));
  }, [mapReady, data.data_centers, activeLayers.data_centers, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const cls = (activeLayers.gpu_clusters && data.gpu_clusters) ? data.gpu_clusters : [];
    // Compute label headline per cluster: chip-count if known, else MW
    const compactChip = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
    setGeo('gpu-clusters', cls.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        name: c.name, city: c.city, country: c.country, region: c.region,
        operator: c.operator, partner: c.partner,
        chips: c.chips, chip_count: c.chip_count, power_mw: c.power_mw,
        status: c.status, workload: c.workload, announced: c.announced, notes: c.notes,
        intensity: c.intensity,
        headline: c.chip_count > 0 ? `${compactChip(c.chip_count)} ${c.chips}` : `${c.power_mw} MW ${c.chips}`,
      },
    })));
  }, [mapReady, data.gpu_clusters, activeLayers.gpu_clusters, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const lanes = (activeLayers.shipping_lanes && data.shipping_lanes) ? data.shipping_lanes : [];
    setGeo('shipping-lanes', lanes.map((l: any) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: l.geometry || [] },
      properties: {
        name: l.name, type: l.type, status: l.status, traffic: l.traffic,
        importance: l.importance, notes: l.notes,
      },
    })));
  }, [mapReady, data.shipping_lanes, activeLayers.shipping_lanes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const hubs = (activeLayers.air_cargo && data.air_cargo) ? data.air_cargo : [];
    setGeo('air-cargo', hubs.map((h: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
      properties: {
        name: h.name, city: h.city, country: h.country, region: h.region,
        iata: h.iata, cargo_tonnes_yr: h.cargo_tonnes_yr,
        cargo_display: (h.cargo_tonnes_yr / 1_000_000).toFixed(1),
        primary_operator: h.primary_operator, operator_type: h.operator_type,
        notes: h.notes, intensity: h.intensity,
      },
    })));
  }, [mapReady, data.air_cargo, activeLayers.air_cargo, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const rails = (activeLayers.rail_corridors && data.rail_corridors) ? data.rail_corridors : [];
    setGeo('rail-corridors', rails.map((r: any) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: r.geometry || [] },
      properties: {
        name: r.name, countries: JSON.stringify(r.countries || []),
        status: r.status, length_km: r.length_km, annual_teu: r.annual_teu,
        operator: r.operator, notes: r.notes,
      },
    })));
  }, [mapReady, data.rail_corridors, activeLayers.rail_corridors, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const pipes = (activeLayers.pipelines && data.pipelines) ? data.pipelines : [];
    setGeo('pipelines', pipes.map((p: any) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: p.geometry || [] },
      properties: {
        name: p.name, type: p.type, operator: p.operator,
        countries: JSON.stringify(p.countries || []),
        capacity: p.capacity, length_km: p.length_km,
        commissioned: p.commissioned, status: p.status,
        notes: p.notes,
      },
    })));
  }, [mapReady, data.pipelines, activeLayers.pipelines, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const cables = (activeLayers.submarine_cables && data.submarine_cables) ? data.submarine_cables : [];
    setGeo('submarine-cables', cables.map((c: any) => ({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: c.segments || [] },
      properties: { id: c.id, name: c.name, color: c.color },
    })));
    const lps = (activeLayers.submarine_cables && data.submarine_cable_landings) ? data.submarine_cable_landings : [];
    setGeo('submarine-cable-landings', lps.map((lp: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lp.lng, lp.lat] },
      properties: { id: lp.id, name: lp.name },
    })));
  }, [mapReady, data.submarine_cables, data.submarine_cable_landings, activeLayers.submarine_cables, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const banks = (activeLayers.cb_rates && data.cb_rates) ? data.cb_rates : [];
    setGeo('cb-rates', banks.map((b: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      properties: {
        iso: b.iso, name: b.name, country: b.country, city: b.city,
        series_code: b.series_code, series_name: b.series_name, frequency: b.frequency,
        current_rate: b.current_rate,
        current_rate_display: Number(b.current_rate).toFixed(2),
        current_rate_date: b.current_rate_date,
        change_bps: b.change_bps,
        yoy_change_bps: b.yoy_change_bps,
        history: JSON.stringify(b.history || []),
      },
    })));
  }, [mapReady, data.cb_rates, activeLayers.cb_rates, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const forests = (activeLayers.forests && data.forests) ? data.forests : [];
    setGeo('forests', forests.map((f: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
      properties: {
        name: f.name, country: f.country, region: f.region, status: f.status,
        area_kha: f.area_kha, annual_loss_kha: f.annual_loss_kha, loss_pct_yr: f.loss_pct_yr,
        carbon_gt: f.carbon_gt, threats: JSON.stringify(f.threats || []),
        notes: f.notes, intensity: f.intensity,
      },
    })));
  }, [mapReady, data.forests, activeLayers.forests, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const refs = (activeLayers.refineries && data.refineries) ? data.refineries : [];
    setGeo('refineries', refs.map((r: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, city: r.city, country: r.country, region: r.region,
        capacity_kbpd: r.capacity_kbpd, operator: r.operator, status: r.status,
        nelson: r.nelson, notes: r.notes, intensity: r.intensity,
      },
    })));
  }, [mapReady, data.refineries, activeLayers.refineries, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const mines = (activeLayers.mines && data.mines) ? data.mines : [];
    setGeo('mines', mines.map((m: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
      properties: {
        name: m.name, country: m.country, region: m.region, commodity: m.commodity,
        secondary: m.secondary || null, production: m.production, revenue_musd: m.revenue_musd,
        ore_grade: m.ore_grade, life_years: m.life_years, operator: m.operator, notes: m.notes,
        intensity: m.intensity,
      },
    })));
  }, [mapReady, data.mines, activeLayers.mines, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const fields = (activeLayers.oil_gas && data.oil_gas) ? data.oil_gas : [];
    const maxBoed = fields.reduce((m: number, f: any) => Math.max(m, f.boed_kbpd || 0), 0) || 1;
    setGeo('oil-gas', fields.map((f: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
      properties: {
        name: f.name, country: f.country, region: f.region, type: f.type,
        oil_kbpd: f.oil_kbpd, gas_mmcfd: f.gas_mmcfd, reserves: f.reserves,
        operator: f.operator, status: f.status, notes: f.notes,
        intensity: Math.min(1, (f.boed_kbpd || 0) / maxBoed),
      },
    })));
  }, [mapReady, data.oil_gas, activeLayers.oil_gas, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const states = (activeLayers.fish_landings && data.fish_landings) ? data.fish_landings : [];
    const maxDollars = states.reduce((m: number, s: any) => Math.max(m, s.total_dollars || 0), 0) || 1;
    const compact = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(0) + 'M' : (n / 1e3).toFixed(0) + 'k';
    setGeo('fish-landings', states.map((s: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        state: s.state, region: s.region, year: data.fish_landings_year || '',
        total_dollars: s.total_dollars, total_pounds: s.total_pounds,
        total_dollars_compact: compact(s.total_dollars || 0),
        species_count: s.species_count,
        top_species: JSON.stringify(s.top_species || []),
        intensity: Math.min(1, (s.total_dollars || 0) / maxDollars),
      },
    })));
  }, [mapReady, data.fish_landings, data.fish_landings_year, activeLayers.fish_landings, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const zones = (activeLayers.fishing_effort && data.fishing_effort) ? data.fishing_effort : [];
    // Normalise to 0..1 across visible zones — relative intensity beats raw
    // hours because absolute scale varies 100× across the world.
    const maxHours = zones.reduce((m: number, z: any) => Math.max(m, z.total_hours || 0), 0) || 1;
    setGeo('fishing-effort', zones
      .filter((z: any) => (z.total_hours || 0) > 0)
      .map((z: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
        properties: {
          name: z.name, region: z.region, total_hours: z.total_hours,
          total_vessels: z.total_vessels,
          top_gears: JSON.stringify(z.top_gears || []),
          intensity: Math.min(1, (z.total_hours || 0) / maxHours),
        },
      })));
  }, [mapReady, data.fishing_effort, activeLayers.fishing_effort, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('fish-stocks', activeLayers.fish_stocks && data.fish_stocks ? data.fish_stocks.map((s: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        name: s.name, species: s.species, scientific: s.scientific,
        status: s.status, biomass_pct: s.biomass_pct, notes: s.notes,
        fao_area: s.fao_area, source: s.source, year: s.year,
      },
    })) : []);
  }, [mapReady, data.fish_stocks, activeLayers.fish_stocks, setGeo]);

  // ── Per-shark historical track (loaded on dot click; cleared on popup close) ──
  useEffect(() => {
    if (!mapReady) return;
    if (!selectedShark || !activeLayers.sharks) {
      setGeo('shark-track', []);
      setGeo('shark-track-pings', []);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/sharks/track?id=${selectedShark.id}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = await res.json();
        const pings: { t: string; lng: number; lat: number }[] = json.pings || [];
        if (pings.length === 0) {
          setGeo('shark-track', []);
          setGeo('shark-track-pings', []);
          return;
        }
        const coords = pings.map(p => [p.lng, p.lat]);
        setGeo('shark-track', [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: { color: selectedShark.color, name: selectedShark.name },
        }] as any);
        setGeo('shark-track-pings', pings.map(p => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { color: selectedShark.color, t: p.t },
        })) as any);

        // Fit camera to the full track (with the side HUD panels padded).
        const map = mapRef.current;
        if (map && coords.length > 1) {
          const lngs = coords.map(c => c[0]);
          const lats = coords.map(c => c[1]);
          const bounds: [[number, number], [number, number]] = [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ];
          map.fitBounds(bounds, { padding: { top: 80, bottom: 100, left: 340, right: 340 }, duration: 1200, maxZoom: 8 });
        }
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') console.warn('[OSIRIS] shark track fetch failed:', e);
      }
    })();
    return () => ctrl.abort();
  }, [mapReady, selectedShark, activeLayers.sharks, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    // ── CONFLICT ZONES — center-point warning markers ──
    const CONFLICT_ZONES = [
      { label: 'UKRAINE WAR', severity: 'war', lat: 48.5, lng: 31.2 },
      { label: 'GAZA CONFLICT', severity: 'war', lat: 31.35, lng: 34.35 },
      { label: 'LEBANON BORDER', severity: 'high', lat: 33.4, lng: 35.8 },
      { label: 'SUDAN CIVIL WAR', severity: 'war', lat: 15.0, lng: 30.0 },
      { label: 'MYANMAR CONFLICT', severity: 'war', lat: 19.5, lng: 96.5 },
      { label: 'DRC EASTERN CONFLICT', severity: 'war', lat: -1.0, lng: 28.5 },
      { label: 'YEMEN WAR', severity: 'war', lat: 15.5, lng: 48.0 },
      { label: 'SYRIA', severity: 'high', lat: 35.0, lng: 38.5 },
      { label: 'TAIWAN STRAIT', severity: 'elevated', lat: 24.0, lng: 119.5 },
      { label: 'KOREAN DMZ', severity: 'elevated', lat: 38.3, lng: 127.0 },
      { label: 'SAHEL INSTABILITY', severity: 'high', lat: 14.0, lng: 5.0 },
      { label: 'SOMALIA', severity: 'high', lat: 5.0, lng: 46.0 },
      { label: 'RED SEA THREAT', severity: 'high', lat: 16.0, lng: 40.0 },
    ];
    const conflictFeatures = CONFLICT_ZONES.map(z => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
      properties: { label: z.label, severity: z.severity },
    }));
    setGeo('conflict-zones', conflictFeatures);
  }, [mapReady, setGeo]);


  // Visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(['eq-circles','eq-label'], activeLayers.earthquakes);
    setVis(['sat-dots'], activeLayers.satellites);
    setVis(['gdelt-dots'], activeLayers.global_incidents);
    setVis(['jam-fill','jam-label'], activeLayers.gps_jamming);
    setVis(['jam-daily-fill','jam-daily-outline'], activeLayers.gps_jamming_daily);
    setVis(['day-night-fill'], activeLayers.day_night);
    setVis(['fl-commercial'], activeLayers.flights);
    setVis(['fl-private'], activeLayers.private);
    setVis(['fl-jets'], activeLayers.jets);
    setVis(['fl-military'], activeLayers.military);
    setVis(['cctv-glow','cctv-dots','cctv-label'], activeLayers.cctv);
    setVis(['fires-heat'], activeLayers.fires);
    setVis(['weather-glow','weather-dots','weather-label'], activeLayers.weather);
    setVis(['infra-glow','infra-dots','infra-label'], activeLayers.infrastructure);
    setVis(['maritime-glow','maritime-dots','maritime-label'], activeLayers.maritime);
    setVis(['choke-glow','choke-dots','choke-label'], activeLayers.maritime);
    setVis(['ship-dots','ship-label'], activeLayers.maritime);
    setVis(['news-glow','news-dots','news-label'], activeLayers.live_news);
    setVis(['conflict-icons'], activeLayers.conflict_zones !== false);

    setVis(['balloon-dots','balloon-label'], activeLayers.balloons);
    setVis(['rad-glow','rad-dots','rad-label'], activeLayers.radiation);
    setVis(['shark-glow','shark-dots','shark-label'], activeLayers.sharks);
    setVis(['fish-stocks-glow','fish-stocks-dots','fish-stocks-label'], activeLayers.fish_stocks);
    setVis(['fishing-effort-glow','fishing-effort-ring','fishing-effort-dots','fishing-effort-label'], activeLayers.fishing_effort);
    setVis(['fish-landings-glow','fish-landings-dots','fish-landings-label'], activeLayers.fish_landings);
    setVis(['oil-gas-glow','oil-gas-dots','oil-gas-label'], activeLayers.oil_gas);
    setVis(['mines-glow','mines-dots','mines-label'], activeLayers.mines);
    setVis(['refineries-glow','refineries-dots','refineries-label'], activeLayers.refineries);
    setVis(['forests-glow','forests-dots','forests-label'], activeLayers.forests);
    setVis(['cb-rates-glow','cb-rates-dots','cb-rates-label'], activeLayers.cb_rates);
    setVis(['macro-us-glow','macro-us-ring','macro-us-dots','macro-us-label'], activeLayers.macro_us);
    setVis(['subcables-glow','subcables-line','subcable-landings','subcable-landing-label'], activeLayers.submarine_cables);
    setVis(['pipelines-glow','pipelines-line','pipelines-label'], activeLayers.pipelines);
    setVis(['shipping-lanes-glow','shipping-lanes-line','shipping-lanes-disrupted'], activeLayers.shipping_lanes);
    setVis(['air-cargo-glow','air-cargo-dots','air-cargo-label'], activeLayers.air_cargo);
    setVis(['rail-corridors-glow','rail-corridors-line'], activeLayers.rail_corridors);
    setVis(['data-centers-glow','data-centers-dots','data-centers-label'], activeLayers.data_centers);
    setVis(['gpu-clusters-glow','gpu-clusters-ring','gpu-clusters-dots','gpu-clusters-label'], activeLayers.gpu_clusters);
    setVis(['mineral-arcs-glow','mineral-arcs-line','mineral-nodes-glow','mineral-nodes-dots','mineral-nodes-label'], activeLayers.mineral_chains);
    setVis(['refugee-arcs-glow','refugee-arcs-line','refugee-asylum-glow','refugee-asylum-dots','refugee-asylum-label'], activeLayers.refugees);
    setVis(['storm-tracks-line','storms-glow','storms-dots','storms-label'], activeLayers.storms);
    setVis(['volcanoes-glow','volcanoes-dots','volcanoes-label'], activeLayers.volcanoes);
    setVis(['sea-ice-glow','sea-ice-ring','sea-ice-dots','sea-ice-label'], activeLayers.sea_ice);
    setVis(['drug-seizures-glow','drug-seizures-dots','drug-seizures-label'], activeLayers.drug_seizures);
    setVis(['sanctions-glow','sanctions-dots','sanctions-label'], activeLayers.sanctions);
    setVis(['network-interference-glow','network-interference-dots','network-interference-label'], activeLayers.network_interference);
    setVis(['coral-reefs-glow','coral-reefs-dots','coral-reefs-label'], activeLayers.coral_reefs);
    setVis(['power-plants-glow','power-plants-dots','power-plants-label'], activeLayers.power_plants);
    setVis(['military-bases-glow','military-bases-dots','military-bases-label'], activeLayers.military_bases);
    setVis(['spaceports-glow','spaceports-ring','spaceports-dots','spaceports-label'], activeLayers.spaceports);
    setVis(['air-quality-glow','air-quality-dots','air-quality-label'], activeLayers.air_quality);
    setVis(['outbreaks-glow','outbreaks-dots','outbreaks-label'], activeLayers.outbreaks);
    setVis(['influence-arcs-glow','influence-arcs-line','influence-ops-glow','influence-ops-dots','influence-ops-label'], activeLayers.influence_campaigns);
    setVis(['influence-takedowns-glow','influence-takedowns-ring','influence-takedowns-dots','influence-takedowns-label'], activeLayers.influence_takedowns);
    setVis(['cyber-arcs-glow','cyber-arcs-line','cyber-targets-glow','cyber-targets-dots','cyber-targets-label'], activeLayers.cyber_attacks);
    setVis(['ransomware-glow','ransomware-dots','ransomware-label'], activeLayers.ransomware);
  }, [mapReady, activeLayers, setVis]);

  // Fly-to
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    if (wallMonitorMode) return;
    mapRef.current.flyTo({ center: [flyToLocation.lng, flyToLocation.lat], zoom: 8, duration: 2000 });
  }, [mapReady, flyToLocation, wallMonitorMode]);

  // Dynamic projection switching (lightweight — no terrain DEM)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      (map as any).setProjection({ type: projection });
      if (projection === 'globe') {
        map.easeTo({ pitch: 20, duration: 1200 });
        try {
          (map as any).setSky({
            'sky-color': '#04040A',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a0a1a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#04040A',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        map.easeTo({ pitch: 0, duration: 800 });
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection]);

  // Satellite / Dark style switching
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (mapStyle === prevStyleRef.current) return;
    prevStyleRef.current = mapStyle;
    const map = mapRef.current;

    try {
      if (mapStyle !== 'dark') {
        // Add satellite raster tiles
        if (!map.getSource('satellite-tiles')) {
          map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
          });
          map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', paint: { 'raster-opacity': 0.85 } }, 'day-night-fill');
        } else {
          map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
      } else {
        if (map.getLayer('satellite-layer')) {
          map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
      }
    } catch (e) {
      console.warn('Style switch failed:', e);
    }
  }, [mapReady, mapStyle]);

  // ── Gamepad (desktop only): right stick pans, left stick Y zooms, A picks ──
  // Crosshair is a viewfinder that lock-snaps to nearby POIs via a critically
  // damped spring. A button targets the locked POI when one is in range,
  // falling back to the canvas center otherwise.
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const lockedLngLatRef = useRef<[number, number] | null>(null);
  const lockedScreenRef = useRef<{ x: number; y: number } | null>(null);
  // Cycle through every POI within the snap radius on repeated A presses.
  type Candidate = { lng: number; lat: number; key: string };
  const candidatesRef = useRef<Candidate[]>([]);
  const candidateIdxRef = useRef(0);
  // Mirror data + activeLayers into refs so the RAF loop always sees fresh
  // values without re-subscribing the effect on every prop change.
  const dataRef = useRef(data);
  const activeLayersRef = useRef(activeLayers);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { activeLayersRef.current = activeLayers; }, [activeLayers]);
  useEffect(() => {
    if (wallMonitorMode) return;
    if (typeof window === 'undefined' || !navigator.getGamepads) return;

    const hasAny = () => Array.from(navigator.getGamepads() || []).some(g => g);
    setGamepadConnected(hasAny());
    const onConn = () => setGamepadConnected(true);
    const onDisc = () => setGamepadConnected(hasAny());
    window.addEventListener('gamepadconnected', onConn);
    window.addEventListener('gamepaddisconnected', onDisc);

    // Every GeoJSON source on the map. We filter for Point geometries when we
    // walk them, so line/arc sources are silently skipped. Sources whose
    // layers are toggled off get emptied via setGeo([]) so querySourceFeatures
    // returns nothing for them. Kept in lockstep with the `sources` list in
    // the map-load handler above.
    const SNAP_SOURCES = [
      'flights','military','jets','private-fl','satellites','earthquakes',
      'gdelt','gps-jamming','gps-jamming-daily','cctv','fires','weather',
      'infrastructure','maritime','maritime-choke','maritime-ships',
      'live-news','conflict-zones','war-alerts-targets','war-alerts-lines',
      'balloons','radiation','sharks','shark-track','shark-track-pings',
      'fish-stocks','fishing-effort','fish-landings','oil-gas','mines',
      'refineries','forests','cb-rates','submarine-cables',
      'submarine-cable-landings','power-plants','military-bases','spaceports',
      'air-quality','outbreaks','influence-arcs','influence-ops',
      'influence-takedowns','cyber-arcs','cyber-targets','ransomware',
      'macro-us','pipelines','mineral-arcs','mineral-nodes','refugee-arcs',
      'refugee-asylum','storms','storm-tracks','coral-reefs','shipping-lanes',
      'air-cargo','rail-corridors','data-centers','gpu-clusters',
    ];
    const SNAP_RADIUS_PX = 90;
    const DEADZONE = 0.15;
    const PAN_PX_PER_FRAME = 9;
    // Critically-damped spring (ζ = 1). ω in rad/s — higher = snappier.
    const SPRING_OMEGA = 14;
    const apply = (v: number) => (Math.abs(v) < DEADZONE ? 0 : Math.sign(v) * (Math.abs(v) - DEADZONE) / (1 - DEADZONE));

    let raf = 0;
    let aWasDown = false;
    let bWasDown = false;
    let l3WasDown = false;
    let r3WasDown = false;
    let lastTs = performance.now();
    let lastSnapMs = 0;
    // Crosshair offset from canvas center (CSS px) + per-axis velocity.
    let ox = 0, oy = 0, vx = 0, vy = 0;
    // HUD focus + right-stick X gesture state
    let activeHud: 'left' | 'right' = 'left';
    let xGestureArmed = true;            // true → ready to fire a switch
    const GESTURE_FIRE = 0.7;            // |rx| threshold to commit a switch
    const GESTURE_REARM = 0.25;          // |rx| must fall below this to re-arm
    const SCROLL_PX_PER_FRAME = 18;      // at full right-stick Y deflection
    const TRIGGER_ZOOM_PER_FRAME = 0.06; // at full trigger pull

    const paintHudFocus = () => {
      const l = document.getElementById('hud-left');
      const r = document.getElementById('hud-right');
      if (l) l.dataset.gpActive = activeHud === 'left' ? '1' : '0';
      if (r) r.dataset.gpActive = activeHud === 'right' ? '1' : '0';
    };
    paintHudFocus();

    const tick = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      const map = mapRef.current;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads).find(g => g) || null;

      if (gp && map) {
        const lx = apply(gp.axes[0] ?? 0);
        const ly = apply(gp.axes[1] ?? 0);
        const rx = apply(gp.axes[2] ?? 0);
        const ry = apply(gp.axes[3] ?? 0);
        if (lx !== 0 || ly !== 0) {
          map.panBy([lx * PAN_PX_PER_FRAME, ly * PAN_PX_PER_FRAME], { duration: 0 }, { gamepad: true });
        }

        // ── Triggers (LT=6, RT=7) zoom ── analog .value if present
        const lt = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);
        const rt = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);
        const trigger = rt - lt;
        if (Math.abs(trigger) > 0.05) {
          map.setZoom(map.getZoom() + trigger * TRIGGER_ZOOM_PER_FRAME);
        }

        // ── Right stick Y → scroll the active HUD panel ──
        if (ry !== 0) {
          const el = document.getElementById(activeHud === 'left' ? 'hud-left' : 'hud-right');
          if (el) el.scrollTop += ry * SCROLL_PX_PER_FRAME;
        }

        // ── Right stick X gesture → switch active HUD ──
        // A "gesture" is a flick beyond GESTURE_FIRE that hasn't fired yet;
        // the stick must return below GESTURE_REARM before another can fire.
        if (xGestureArmed && Math.abs(rx) >= GESTURE_FIRE) {
          activeHud = rx > 0 ? 'right' : 'left';
          paintHudFocus();
          xGestureArmed = false;
        } else if (!xGestureArmed && Math.abs(rx) <= GESTURE_REARM) {
          xGestureArmed = true;
        }

        // Find nearest snappable POI to canvas center.
        // We iterate every snap-eligible map source via querySourceFeatures,
        // project Point geometries to screen, and pick the closest within
        // SNAP_RADIUS. Throttled to ~10Hz; the spring keeps interpolating
        // every frame between samples, and we re-project the cached locked
        // lng/lat each frame so the snap tracks the camera and moving
        // entities (flights, ships, sats).
        const canvas = map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        let tx = 0, ty = 0;
        let locked: { x: number; y: number } | null = null;
        if (ts - lastSnapMs >= 90) {
          lastSnapMs = ts;
          const R2 = SNAP_RADIUS_PX * SNAP_RADIUS_PX;
          const found: Array<{ lng: number; lat: number; d2: number }> = [];
          const seen = new Set<string>();
          try {
            for (const src of SNAP_SOURCES) {
              if (!map.getSource(src)) continue;
              const feats = map.querySourceFeatures(src);
              for (const f of feats) {
                const g = f.geometry as any;
                if (g?.type !== 'Point') continue;
                const c = g.coordinates as [number, number];
                if (!c || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue;
                // Dedup features that share a coordinate across sources (same
                // POI rendered twice into different layers).
                const key = `${c[0].toFixed(5)}:${c[1].toFixed(5)}`;
                if (seen.has(key)) continue;
                const p = map.project(c as maplibregl.LngLatLike);
                const dx = p.x - cx, dy = p.y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 <= R2) {
                  seen.add(key);
                  found.push({ lng: c[0], lat: c[1], d2 });
                }
              }
            }
          } catch { /* sources still warming up */ }
          found.sort((a, b) => a.d2 - b.d2);
          const newCandidates: Candidate[] = found.map(({ lng, lat }) => ({
            lng, lat, key: `${lng.toFixed(5)}:${lat.toFixed(5)}`,
          }));

          // Preserve cycle position when the candidate set changes: keep the
          // cursor on the previously-selected POI if it's still in range; else
          // reset to the closest (index 0).
          const prev = candidatesRef.current;
          const prevKey = prev[candidateIdxRef.current]?.key;
          let nextIdx = 0;
          if (prevKey) {
            const found = newCandidates.findIndex(c => c.key === prevKey);
            if (found >= 0) nextIdx = found;
          }
          candidatesRef.current = newCandidates;
          candidateIdxRef.current = nextIdx;

          if (newCandidates.length > 0) {
            const sel = newCandidates[nextIdx];
            const p = map.project([sel.lng, sel.lat]);
            lockedLngLatRef.current = [sel.lng, sel.lat];
            lockedScreenRef.current = { x: p.x, y: p.y };
          } else {
            lockedLngLatRef.current = null;
            lockedScreenRef.current = null;
          }
        } else if (lockedLngLatRef.current) {
          // Re-project the cached target every frame so the lock follows the
          // camera/entity smoothly even between throttled scans.
          try {
            const p = map.project(lockedLngLatRef.current as maplibregl.LngLatLike);
            lockedScreenRef.current = { x: p.x, y: p.y };
          } catch { /* ignore */ }
        }
        const cachedScreen = lockedScreenRef.current;
        if (cachedScreen) {
          const dx = cachedScreen.x - cx, dy = cachedScreen.y - cy;
          if (dx * dx + dy * dy <= SNAP_RADIUS_PX * SNAP_RADIUS_PX) {
            tx = dx;
            ty = dy;
            locked = cachedScreen;
          } else {
            // Target has drifted outside the snap radius — release.
            lockedLngLatRef.current = null;
            lockedScreenRef.current = null;
            candidatesRef.current = [];
            candidateIdxRef.current = 0;
          }
        }

        // Critically-damped spring step (semi-implicit Euler).
        const w = SPRING_OMEGA;
        const ax = -2 * w * vx - w * w * (ox - tx);
        const ay = -2 * w * vy - w * w * (oy - ty);
        vx += ax * dt; vy += ay * dt;
        ox += vx * dt; oy += vy * dt;

        if (reticleRef.current) {
          reticleRef.current.style.transform = `translate(-50%, -50%) translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px) scale(${locked ? 0.72 : 1})`;
          reticleRef.current.dataset.locked = locked ? '1' : '0';
        }

        const aDown = !!gp.buttons[0]?.pressed;
        if (aDown && !aWasDown) {
          // Cycle: click the current candidate, then advance the cursor so
          // the next A press lands on the next POI in the cluster. Fall back
          // to the canvas center when nothing's in range.
          const candidates = candidatesRef.current;
          let target: { x: number; y: number };
          if (candidates.length > 0) {
            const sel = candidates[candidateIdxRef.current % candidates.length];
            const p = map.project([sel.lng, sel.lat]);
            target = { x: p.x, y: p.y };
            candidateIdxRef.current = (candidateIdxRef.current + 1) % candidates.length;
            // Move the visual lock to the newly-selected POI so the user can
            // see which one the next press will pick.
            const nextSel = candidates[candidateIdxRef.current];
            const np = map.project([nextSel.lng, nextSel.lat]);
            lockedLngLatRef.current = [nextSel.lng, nextSel.lat];
            lockedScreenRef.current = { x: np.x, y: np.y };
          } else {
            target = { x: cx, y: cy };
          }
          const clientX = rect.left + target.x;
          const clientY = rect.top + target.y;
          const mk = (type: string) => new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true, button: 0, view: window });
          canvas.dispatchEvent(mk('mousedown'));
          canvas.dispatchEvent(mk('mouseup'));
          canvas.dispatchEvent(mk('click'));
        }
        aWasDown = aDown;

        // B button (index 1): close anything open — map popup + any Escape-aware UI.
        const bDown = !!gp.buttons[1]?.pressed;
        if (bDown && !bWasDown) {
          popupRef.current?.remove();
          popupRef.current = null;
          const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
          window.dispatchEvent(esc);
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
        bWasDown = bDown;

        // L3 (left stick press, index 10): show/hide the left data-layers side panel.
        const l3Down = !!gp.buttons[10]?.pressed;
        if (l3Down && !l3WasDown) {
          window.dispatchEvent(new CustomEvent('osiris:toggle-left-panel'));
        }
        l3WasDown = l3Down;

        // R3 (right stick press, index 11): expand/shrink the right-hand UI panes.
        const r3Down = !!gp.buttons[11]?.pressed;
        if (r3Down && !r3WasDown) {
          window.dispatchEvent(new CustomEvent('osiris:toggle-right-panel'));
        }
        r3WasDown = r3Down;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', onConn);
      window.removeEventListener('gamepaddisconnected', onDisc);
      // Clear HUD focus marker so the gold ring vanishes on unmount/disconnect.
      const l = document.getElementById('hud-left');
      const r = document.getElementById('hud-right');
      if (l) delete l.dataset.gpActive;
      if (r) delete r.dataset.gpActive;
    };
  }, [wallMonitorMode]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {gamepadConnected && !wallMonitorMode && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            ref={reticleRef}
            data-locked="0"
            className="osiris-reticle absolute left-1/2 top-1/2"
            style={{ transform: 'translate(-50%, -50%)', willChange: 'transform', transition: 'filter 180ms cubic-bezier(.2,.8,.2,1)' }}
          >
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ mixBlendMode: 'difference', display: 'block' }}>
              {/* Four rounded L-corners forming a viewfinder box */}
              <path d="M6 16 V10 a4 4 0 0 1 4 -4 H16" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M40 6 H46 a4 4 0 0 1 4 4 V16" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M50 40 V46 a4 4 0 0 1 -4 4 H40" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M16 50 H10 a4 4 0 0 1 -4 -4 V40" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(OsirisMap);
