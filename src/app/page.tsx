'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, BarChart3, Newspaper, Search, Share2, Map as MapIcon, X, Globe, MapPinned, Radar, Satellite, Moon, ExternalLink, AlertTriangle, Building2, RadioTower, Activity, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import IntelFeed from '@/components/IntelFeed';
import MarketsPanel from '@/components/MarketsPanel';
import SearchBar from '@/components/SearchBar';
import ScaleBar from '@/components/ScaleBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import SharePanel from '@/components/SharePanel';
import ViewPresets from '@/components/ViewPresets';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import GlobalStatusBar from '@/components/GlobalStatusBar';
import LiveAlerts from '@/components/LiveAlerts';

const OsirisMap = dynamic(() => import('@/components/OsirisMap'), { ssr: false });
const LayerPanel = dynamic(() => import('@/components/LayerPanel'));
const CameraViewer = dynamic(() => import('@/components/CameraViewer'));
const OsintPanel = dynamic(() => import('@/components/OsintPanel'));

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Mobile if narrow, OR landscape phone (short height + moderate width)
      setIsMobile(w < 768 || (h < 500 && w < 1024));
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return isMobile;
}
const UptimeClock = () => {
  const [uptime, setUptime] = useState('00:00:00');
  const startTime = useRef(Date.now());
  useEffect(() => {
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - startTime.current) / 1000);
      setUptime(`${String(Math.floor(e/3600)).padStart(2,'0')}:${String(Math.floor((e%3600)/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="hidden lg:inline">UPTIME: <span className="text-[var(--gold-primary)]">{uptime}</span></span>;
};

const WORLD_POPULATION_BASE = 8_293_639_584;
const WORLD_POPULATION_BASE_TS = Date.UTC(2026, 4, 25, 12, 0, 0);
const WORLD_POPULATION_NET_GROWTH_PER_SECOND = 2.2;
const WORLD_POPULATION_UPDATE_MS = 1200;
const OTHER_MAMMALS_ESTIMATE = 137_000_000_000;

const FlipDigit = ({ value, previous }: { value: string; previous: string }) => {
  const changed = value !== previous;

  return (
    <span className="live-population__flap" data-changed={changed ? 'true' : 'false'}>
      <span className="live-population__flap-static live-population__flap-static--top">{value}</span>
      <span className="live-population__flap-static live-population__flap-static--bottom">{value}</span>
      <AnimatePresence initial={false}>
        {changed && (
          <motion.span
            key={`top-${previous}-${value}`}
            className="live-population__flap-blade live-population__flap-blade--top"
            initial={{ rotateX: 0, filter: 'brightness(1.18)' }}
            animate={{ rotateX: [0, -64, -104], filter: ['brightness(1.24)', 'brightness(0.75)', 'brightness(0.36)'] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, times: [0, 0.66, 1], ease: [0.74, 0, 0.84, 0] }}
          >
            {previous}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {changed && (
          <motion.span
            key={`bottom-${previous}-${value}`}
            className="live-population__flap-blade live-population__flap-blade--bottom"
            initial={{ rotateX: 96, filter: 'brightness(0.42)' }}
            animate={{ rotateX: [96, -9, 0], filter: ['brightness(0.46)', 'brightness(1.32)', 'brightness(1.08)'] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.44, delay: 0.14, times: [0, 0.72, 1], ease: [0.16, 1, 0.3, 1] }}
          >
            {value}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

const SplitFlapNumber = ({ value, previous }: { value: string; previous: string }) => (
  <span className="live-population__odometer" aria-label={value}>
    {value.split('').map((char, index) => (
      char === ',' ? (
        <span className="live-population__separator" key={`${char}-${index}`}>,</span>
      ) : (
        <FlipDigit value={char} previous={previous[index] || char} key={index} />
      )
    ))}
  </span>
);

const LivePopulationClock = () => {
  const estimatePopulation = useCallback(() => {
    const elapsedSeconds = (Date.now() - WORLD_POPULATION_BASE_TS) / 1000;
    return Math.round(WORLD_POPULATION_BASE + elapsedSeconds * WORLD_POPULATION_NET_GROWTH_PER_SECOND);
  }, []);
  const [population, setPopulation] = useState(() => estimatePopulation());
  const previousPopulation = useRef(population);

  useEffect(() => {
    const iv = setInterval(() => setPopulation(estimatePopulation()), WORLD_POPULATION_UPDATE_MS);
    return () => clearInterval(iv);
  }, [estimatePopulation]);

  useEffect(() => {
    previousPopulation.current = population;
  }, [population]);

  const populationChars = population.toLocaleString('en-GB').split('');
  const previousChars = previousPopulation.current.toLocaleString('en-GB').split('');
  const populationValue = populationChars.join('');
  const previousPopulationValue = previousChars.join('');
  const otherMammalsValue = OTHER_MAMMALS_ESTIMATE.toLocaleString('en-GB');

  return (
    <span
      className="live-population hidden md:inline-flex pointer-events-auto"
      title="Humans are an interpolated live estimate. Other mammals is a rough headcount estimate: wild mammals plus domesticated non-human mammals."
    >
      <span className="live-population__rows">
        <span className="live-population__row">
          <span className="live-population__pulse" />
          <span className="live-population__label">HUMANS</span>
          <SplitFlapNumber value={populationValue} previous={previousPopulationValue} />
        </span>
        <span className="live-population__row">
          <span className="live-population__pulse live-population__pulse--muted" />
          <span className="live-population__label">OTHER MAMMALS</span>
          <SplitFlapNumber value={otherMammalsValue} previous={otherMammalsValue} />
        </span>
      </span>
    </span>
  );
};

export default function Dashboard() {
  const dataRef = useRef<any>({});
  const [dataVersion, setDataVersion] = useState(0);
  const data = dataRef.current;

  const [backendStatus, setBackendStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [mapView, setMapView] = useState({ zoom: 2.5, latitude: 20 });
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [regionDossier, setRegionDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [spaceWeather, setSpaceWeather] = useState<any>(null);
  const [showLayers, setShowLayers] = useState(true);
  const [showMarkets, setShowMarkets] = useState(true);
  const [showIntel, setShowIntel] = useState(true);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'layers'|'markets'|'intel'|'search'|'recon'|null>(null);
  const [mapProjection, setMapProjection] = useState<'globe'|'mercator'>('globe');
  const [mapStyle, setMapStyle] = useState<'dark'|'satellite'>('dark');
  const [wallMonitorMode, setWallMonitorMode] = useState(false);

  const isMobile = useIsMobile();
  const startTime = useRef(Date.now());
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedPos = useRef<{ lat: number; lng: number } | null>(null);

  // ── DEFAULT: Most layers OFF — fast initial load ──
  const [activeLayers, setActiveLayers] = useState({
    flights: false,
    private: false,
    jets: false,
    military: false,
    maritime: false,
    sharks: false,
    fish_stocks: false,
    fishing_effort: false,
    fish_landings: false,
    oil_gas: false,
    refineries: false,
    mines: false,
    mineral_chains: false,
    forests: false,
    coral_reefs: false,
    cb_rates: false,
    macro_us: false,
    submarine_cables: false,
    pipelines: false,
    data_centers: false,
    gpu_clusters: false,
    shipping_lanes: false,
    air_cargo: false,
    rail_corridors: false,
    power_plants: false,
    military_bases: false,
    spaceports: false,
    air_quality: false,
    storms: false,
    volcanoes: false,
    sea_ice: false,
    outbreaks: false,
    refugees: false,
    influence_campaigns: false,
    influence_takedowns: false,
    cyber_attacks: false,
    ransomware: false,
    drug_seizures: false,
    sanctions: false,
    network_interference: false,
    satellites: false,
    balloons: false,
    cctv: true,
    live_news: true,
    earthquakes: true,
    fires: false,
    weather: false,
    radiation: false,
    infrastructure: false,
    global_incidents: true,
    war_alerts: false,
    gps_jamming: false,
    gps_jamming_daily: false,
    day_night: true,
  });
  const [liveFeedUrl, setLiveFeedUrl] = useState<string | null>(null);
  const [liveFeedName, setLiveFeedName] = useState('');
  const [liveFeedEmbedAllowed, setLiveFeedEmbedAllowed] = useState(true);

  // Splash screen
  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  // URL state: parse on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const lat = parseFloat(p.get('lat') || '');
    const lon = parseFloat(p.get('lon') || '');
    const zoom = parseFloat(p.get('zoom') || '');
    const wallMode = ['1', 'true', 'yes', 'on'].includes((p.get('wall') || p.get('monitor') || p.get('wallMonitor') || '').toLowerCase());
    setWallMonitorMode(wallMode);
    if (!isNaN(lat) && !isNaN(lon)) {
      setFlyToLocation({ lat, lng: lon, ts: Date.now() });
      if (!isNaN(zoom)) setMapView(v => ({ ...v, zoom }));
    }
    const layers = p.get('layers');
    if (layers) {
      const active = layers.split(',');
      setActiveLayers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { (next as any)[k] = active.includes(k); });
        return next;
      });
    }
  }, []);

  // URL state: update URL on view change (debounced)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (wallMonitorMode) return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const p = new URLSearchParams();
      p.set('lat', (mouseCoords?.lat ?? mapView.latitude ?? 20).toFixed(4));
      p.set('lon', (mouseCoords?.lng ?? 0).toFixed(4));
      p.set('zoom', mapView.zoom.toFixed(2));
      const active = Object.entries(activeLayers).filter(([,v]) => v).map(([k]) => k).join(',');
      p.set('layers', active);
      const url = `${window.location.pathname}?${p.toString()}`;
      window.history.replaceState(null, '', url);
    }, 1500);
  }, [mapView, activeLayers, mouseCoords, wallMonitorMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === 'f' && !e.ctrlKey) {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        setIsFullscreen(!!document.fullscreenElement);
      }
      if (e.key === 'l') setShowLayers(p => !p);
      if (e.key === 'm') setShowMarkets(p => !p);
      if (e.key === 'i') setShowIntel(p => !p);
      if (e.key === 'r') setFlyToLocation({ lat: 20, lng: 0, ts: Date.now() });
      if (e.key === 'g') setMapProjection(p => p === 'globe' ? 'mercator' : 'globe');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Gamepad stick-press toggles (dispatched from OsirisMap's gamepad loop):
  // L3 → left data-layers side panel, R3 → right-hand UI panes.
  useEffect(() => {
    const onLeft = () => setLeftPanelOpen(p => !p);
    const onRight = () => setRightPanelOpen(p => !p);
    window.addEventListener('osiris:toggle-left-panel', onLeft);
    window.addEventListener('osiris:toggle-right-panel', onRight);
    return () => {
      window.removeEventListener('osiris:toggle-left-panel', onLeft);
      window.removeEventListener('osiris:toggle-right-panel', onRight);
    };
  }, []);

  // Mouse coords + reverse geocode
  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    setMouseCoords(coords);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const d = Math.abs(coords.lat - lastGeocodedPos.current.lat) + Math.abs(coords.lng - lastGeocodedPos.current.lng);
        if (d < 0.5) return; // increased threshold — fewer geocode calls
      }
      const gk = `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`; // coarser grid = more cache hits
      if (geocodeCache.current.has(gk)) { setLocationLabel(geocodeCache.current.get(gk)!); lastGeocodedPos.current = coords; return; }
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=10&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
        if (res.ok) {
          const d = await res.json();
          const a = d.address || {};
          const label = [a.city||a.town||a.village||a.county, a.state||a.region, a.country].filter(Boolean).join(', ') || 'Unknown';
          if (geocodeCache.current.size > 500) { const it = geocodeCache.current.keys(); for (let i=0;i<100;i++) { const k = it.next().value; if(k) geocodeCache.current.delete(k); }}
          geocodeCache.current.set(gk, label);
          setLocationLabel(label);
          lastGeocodedPos.current = coords;
        }
      } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 3000); // 3s debounce (was 1.5s)
  }, []);

  // Region dossier (right-click)
  const handleRightClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setDossierLoading(true); setRegionDossier(null);
    try {
      const res = await fetch(`/api/region-dossier?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) setRegionDossier(await res.json());
    } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); } finally { setDossierLoading(false); }
  }, []);

  // Entity click handler (hoisted from JSX to comply with Rules of Hooks — Fixes #113)
  const handleEntityClick = useCallback((entity: any) => {
    if (entity?.type === 'cctv') setActiveCamera(entity);
    if (entity?.type === 'live_news' && entity.url) {
      setLiveFeedUrl(entity.url);
      setLiveFeedName(entity.name);
      setLiveFeedEmbedAllowed(entity.embed_allowed !== false);
    }
  }, []);

  // ── SHARED FETCH UTILITY (Fixes #107 — single definition, not 3 copies) ──
  const fetchEndpoint = useCallback(async (url: string, transform?: (d: any) => any, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        const json = await res.json();
        const d = transform ? transform(json) : json;
        dataRef.current = { ...dataRef.current, ...d };
        setDataVersion(v => v + 1);
        setBackendStatus('connected');
      }
    } catch (e) {
      console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e);
      setBackendStatus('error');
    }
  }, []);

  // ── PROGRESSIVE DATA LOADING (request-optimized) ──
  useEffect(() => {
    // Priority 1: Core feeds (always needed for panels)
    fetchEndpoint('/api/earthquakes');
    fetchEndpoint('/api/news');
    const marketTimer = setTimeout(() => fetchEndpoint('/api/markets', d => ({ markets: d })), 800);

    // Priority 2: Space Weather (needed for MarketsPanel)
    const spaceTimer = setTimeout(async () => {
      try {
        const r = await fetch('/api/space-weather');
        if (r.ok) setSpaceWeather(await r.json());
      } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 5000);

    // Polling — OPTIMIZED intervals to minimize edge requests
    const intervals = [
      setInterval(() => fetchEndpoint('/api/earthquakes'), 900000),  // 15 min (was 5)
      setInterval(() => fetchEndpoint('/api/news'), 1800000),        // 30 min (was 10)
      setInterval(() => fetchEndpoint('/api/markets', d => ({ markets: d })), 900000), // 15 min (was 5)
    ];
    return () => {
      clearTimeout(marketTimer);
      clearTimeout(spaceTimer);
      intervals.forEach(clearInterval);
    };
  }, [fetchEndpoint]);

  // ── LAYER-AWARE DATA LOADING — only fetch when layer is toggled ON ──
  const layerFetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {

    // Flights
    if (activeLayers.flights || activeLayers.military || activeLayers.jets || activeLayers.private) {
      if (!layerFetchedRef.current.has('flights')) {
        fetchEndpoint('/api/flights');
        layerFetchedRef.current.add('flights');
      }
    }
    // Satellites
    if (activeLayers.satellites && !layerFetchedRef.current.has('satellites')) {
      fetchEndpoint('/api/satellites');
      layerFetchedRef.current.add('satellites');
    }
    // Fires
    if (activeLayers.fires && !layerFetchedRef.current.has('fires')) {
      fetchEndpoint('/api/fires');
      layerFetchedRef.current.add('fires');
    }
    // CCTV
    if (activeLayers.cctv && !layerFetchedRef.current.has('cctv')) {
      fetchEndpoint('/api/cctv?region=all');
      layerFetchedRef.current.add('cctv');
    }
    // Maritime
    if (activeLayers.maritime && !layerFetchedRef.current.has('maritime')) {
      fetchEndpoint('/api/maritime', d => ({ maritime_ports: d.ports, maritime_chokepoints: d.chokepoints, maritime_ships: d.ships }));
      layerFetchedRef.current.add('maritime');
    }
    // Sharks (OCEARCH) — pings move slowly; no polling needed beyond first fetch
    if (activeLayers.sharks && !layerFetchedRef.current.has('sharks')) {
      fetchEndpoint('/api/sharks', d => ({ sharks: d.sharks }));
      layerFetchedRef.current.add('sharks');
    }
    // Fish stock health — static curated dataset
    if (activeLayers.fish_stocks && !layerFetchedRef.current.has('fish_stocks')) {
      fetchEndpoint('/api/fisheries', d => ({ fish_stocks: d.stocks }));
      layerFetchedRef.current.add('fish_stocks');
    }
    // Fishing effort — Global Fishing Watch zone aggregates (6h cached server-side)
    if (activeLayers.fishing_effort && !layerFetchedRef.current.has('fishing_effort')) {
      fetchEndpoint('/api/fisheries/effort', d => ({ fishing_effort: d.zones, fishing_effort_range: d.date_range }));
      layerFetchedRef.current.add('fishing_effort');
    }
    // US commercial landings — NOAA FOSS (24h cached server-side)
    if (activeLayers.fish_landings && !layerFetchedRef.current.has('fish_landings')) {
      fetchEndpoint('/api/fisheries/landings', d => ({ fish_landings: d.states, fish_landings_year: d.year, fish_landings_total: d.total_dollars }));
      layerFetchedRef.current.add('fish_landings');
    }
    // Oil & Gas upstream — curated dataset
    if (activeLayers.oil_gas && !layerFetchedRef.current.has('oil_gas')) {
      fetchEndpoint('/api/resources/oil-gas', d => ({ oil_gas: d.fields }));
      layerFetchedRef.current.add('oil_gas');
    }
    // Tier-1 mines — curated dataset
    if (activeLayers.mines && !layerFetchedRef.current.has('mines')) {
      fetchEndpoint('/api/resources/mines', d => ({ mines: d.mines }));
      layerFetchedRef.current.add('mines');
    }
    // Critical mineral supply chains — nodes + edges, EV decoupling story
    if (activeLayers.mineral_chains && !layerFetchedRef.current.has('mineral_chains')) {
      fetchEndpoint('/api/resources/minerals', d => ({ mineral_nodes: d.nodes, mineral_edges: d.edges }));
      layerFetchedRef.current.add('mineral_chains');
    }
    // Refineries (downstream) — curated dataset
    if (activeLayers.refineries && !layerFetchedRef.current.has('refineries')) {
      fetchEndpoint('/api/resources/refineries', d => ({ refineries: d.refineries }));
      layerFetchedRef.current.add('refineries');
    }
    // Forests — curated dataset
    if (activeLayers.forests && !layerFetchedRef.current.has('forests')) {
      fetchEndpoint('/api/biomes/forests', d => ({ forests: d.forests }));
      layerFetchedRef.current.add('forests');
    }
    // Coral reefs — curated dataset, BIOMES sibling of Forests
    if (activeLayers.coral_reefs && !layerFetchedRef.current.has('coral_reefs')) {
      fetchEndpoint('/api/biomes/coral-reefs', d => ({ coral_reefs: d.reefs }));
      layerFetchedRef.current.add('coral_reefs');
    }
    // Central Bank Rates — algo-fund backfill via SQLite cache
    if (activeLayers.cb_rates && !layerFetchedRef.current.has('cb_rates')) {
      fetchEndpoint('/api/macro/cb-rates', d => ({ cb_rates: d.banks, cb_rates_built_at: d.built_at }));
      layerFetchedRef.current.add('cb_rates');
    }
    // US Macro Indicators — algo-fund FRED/BLS backfill, dense single-marker
    if (activeLayers.macro_us && !layerFetchedRef.current.has('macro_us')) {
      fetchEndpoint('/api/macro/indicators', d => ({ macro_us: d, macro_us_indicators: d.indicators }));
      layerFetchedRef.current.add('macro_us');
    }
    // Submarine Cables — Telegeography (24h cached, per-cable detail loads on click)
    if (activeLayers.submarine_cables && !layerFetchedRef.current.has('submarine_cables')) {
      fetchEndpoint('/api/infra/submarine-cables', d => ({ submarine_cables: d.cables, submarine_cable_landings: d.landings }));
      layerFetchedRef.current.add('submarine_cables');
    }
    // Pipelines — curated upstream/midstream geometry
    if (activeLayers.pipelines && !layerFetchedRef.current.has('pipelines')) {
      fetchEndpoint('/api/infra/pipelines', d => ({ pipelines: d.pipelines }));
      layerFetchedRef.current.add('pipelines');
    }
    // Data centers — hyperscale regions + colos + IXPs
    if (activeLayers.data_centers && !layerFetchedRef.current.has('data_centers')) {
      fetchEndpoint('/api/infra/data-centers', d => ({ data_centers: d.facilities }));
      layerFetchedRef.current.add('data_centers');
    }
    // GPU clusters — frontier AI training fleets
    if (activeLayers.gpu_clusters && !layerFetchedRef.current.has('gpu_clusters')) {
      fetchEndpoint('/api/infra/gpu-clusters', d => ({ gpu_clusters: d.clusters }));
      layerFetchedRef.current.add('gpu_clusters');
    }
    // Freight: shipping lanes
    if (activeLayers.shipping_lanes && !layerFetchedRef.current.has('shipping_lanes')) {
      fetchEndpoint('/api/freight/shipping-lanes', d => ({ shipping_lanes: d.lanes }));
      layerFetchedRef.current.add('shipping_lanes');
    }
    // Freight: air cargo hubs
    if (activeLayers.air_cargo && !layerFetchedRef.current.has('air_cargo')) {
      fetchEndpoint('/api/freight/air-cargo', d => ({ air_cargo: d.hubs }));
      layerFetchedRef.current.add('air_cargo');
    }
    // Freight: rail freight corridors
    if (activeLayers.rail_corridors && !layerFetchedRef.current.has('rail_corridors')) {
      fetchEndpoint('/api/freight/rail-corridors', d => ({ rail_corridors: d.corridors }));
      layerFetchedRef.current.add('rail_corridors');
    }
    // Tier-1 power plants — curated dataset
    if (activeLayers.power_plants && !layerFetchedRef.current.has('power_plants')) {
      fetchEndpoint('/api/infra/power-plants', d => ({ power_plants: d.plants }));
      layerFetchedRef.current.add('power_plants');
    }
    // Major military bases — curated dataset (strategic posture)
    if (activeLayers.military_bases && !layerFetchedRef.current.has('military_bases')) {
      fetchEndpoint('/api/threats/military-bases', d => ({ military_bases: d.bases }));
      layerFetchedRef.current.add('military_bases');
    }
    // Spaceports — curated dataset
    if (activeLayers.spaceports && !layerFetchedRef.current.has('spaceports')) {
      fetchEndpoint('/api/space/spaceports', d => ({ spaceports: d.spaceports }));
      layerFetchedRef.current.add('spaceports');
    }
    // Air quality — Open-Meteo CAMS for ~80 megacities (30m cached server-side)
    if (activeLayers.air_quality && !layerFetchedRef.current.has('air_quality')) {
      fetchEndpoint('/api/environment/air-quality', d => ({ air_quality: d.cities, air_quality_built_at: d.built_at }));
      layerFetchedRef.current.add('air_quality');
    }
    // Active tropical cyclones — NOAA NHC + NASA EONET (30m cached)
    if (activeLayers.storms && !layerFetchedRef.current.has('storms')) {
      fetchEndpoint('/api/environment/storms', d => ({ storms: d.storms, storms_built_at: d.built_at }));
      layerFetchedRef.current.add('storms');
    }
    // Active volcanoes — NASA EONET (Smithsonian GVP, 2h cached)
    if (activeLayers.volcanoes && !layerFetchedRef.current.has('volcanoes')) {
      fetchEndpoint('/api/environment/volcanoes', d => ({ volcanoes: d.volcanoes, volcanoes_built_at: d.built_at }));
      layerFetchedRef.current.add('volcanoes');
    }
    // Sea ice extent — NSIDC daily Arctic + Antarctic (12h cached)
    if (activeLayers.sea_ice && !layerFetchedRef.current.has('sea_ice')) {
      fetchEndpoint('/api/environment/sea-ice', d => ({ sea_ice: d.poles, sea_ice_built_at: d.built_at }));
      layerFetchedRef.current.add('sea_ice');
    }
    // Disease outbreaks — WHO Disease Outbreak News (4h cached)
    if (activeLayers.outbreaks && !layerFetchedRef.current.has('outbreaks')) {
      fetchEndpoint('/api/health/outbreaks', d => ({ outbreaks: d.markers, outbreaks_built_at: d.built_at, outbreaks_total: d.total_reports }));
      layerFetchedRef.current.add('outbreaks');
    }
    // Refugee corridors — UNHCR top 60 cross-border flows (7d cached server-side)
    if (activeLayers.refugees && !layerFetchedRef.current.has('refugees')) {
      fetchEndpoint('/api/humanitarian/refugees', d => ({ refugee_corridors: d.corridors, refugee_asylum: d.asylum_markers, refugee_year: d.year }));
      layerFetchedRef.current.add('refugees');
    }
    // Named influence campaigns — curated dataset with operator→target arcs
    if (activeLayers.influence_campaigns && !layerFetchedRef.current.has('influence_campaigns')) {
      fetchEndpoint('/api/influence/campaigns', d => ({ influence_campaigns_ops: d.operations, influence_campaigns_operators: d.operators }));
      layerFetchedRef.current.add('influence_campaigns');
    }
    // Platform takedowns — curated Meta/X/YouTube/TikTok/OpenAI CIB events
    if (activeLayers.influence_takedowns && !layerFetchedRef.current.has('influence_takedowns')) {
      fetchEndpoint('/api/influence/takedowns', d => ({ influence_takedowns_operators: d.operators, influence_takedowns_total: d.total_events }));
      layerFetchedRef.current.add('influence_takedowns');
    }
    // Named cyberattacks — curated dataset with attacker→target arcs
    if (activeLayers.cyber_attacks && !layerFetchedRef.current.has('cyber_attacks')) {
      fetchEndpoint('/api/cyber/attacks', d => ({ cyber_attacks: d.attacks, cyber_targets: d.targets, cyber_arcs: d.arcs }));
      layerFetchedRef.current.add('cyber_attacks');
    }
    // Ransomware tracker — ransomware.live live leak-site postings (1h cached server)
    if (activeLayers.ransomware && !layerFetchedRef.current.has('ransomware')) {
      fetchEndpoint('/api/cyber/ransomware', d => ({ ransomware_countries: d.countries, ransomware_total: d.total_victims, ransomware_window: d.window_days, ransomware_groups: d.groups_seen }));
      layerFetchedRef.current.add('ransomware');
    }
    // Major drug seizures — curated 2021-2026 high-profile events
    if (activeLayers.drug_seizures && !layerFetchedRef.current.has('drug_seizures')) {
      fetchEndpoint('/api/narcotics/seizures', d => ({ drug_seizures: d.seizures, drug_seizures_total_kg: d.total_kg, drug_seizures_by_drug: d.by_drug }));
      layerFetchedRef.current.add('drug_seizures');
    }
    // Sanctions geography — OpenSanctions consolidated stats (24h cached)
    if (activeLayers.sanctions && !layerFetchedRef.current.has('sanctions')) {
      fetchEndpoint('/api/sanctions/geography', d => ({ sanctions: d.countries, sanctions_total_targets: d.total_targets, sanctions_schema_totals: d.schema_totals, sanctions_last_change: d.last_change }));
      layerFetchedRef.current.add('sanctions');
    }
    // Network interference — OONI rolling 7d (6h cached server-side)
    if (activeLayers.network_interference && !layerFetchedRef.current.has('network_interference')) {
      fetchEndpoint('/api/connectivity/network-interference', d => ({ network_interference: d.countries, network_interference_built_at: d.built_at, network_interference_total: d.total_measurements }));
      layerFetchedRef.current.add('network_interference');
    }
    // Balloons
    if (activeLayers.balloons && !layerFetchedRef.current.has('balloons')) {
      fetchEndpoint('/api/balloons', d => ({ balloons: d.balloons }));
      layerFetchedRef.current.add('balloons');
    }
    // Radiation
    if (activeLayers.radiation && !layerFetchedRef.current.has('radiation')) {
      fetchEndpoint('/api/radiation', d => ({ radiation: d.stations }));
      layerFetchedRef.current.add('radiation');
    }
    // Live News
    if (activeLayers.live_news && !layerFetchedRef.current.has('live_news')) {
      fetchEndpoint('/api/live-news', d => ({ live_feeds: d.feeds }));
      layerFetchedRef.current.add('live_news');
    }
    // Weather
    if (activeLayers.weather && !layerFetchedRef.current.has('weather')) {
      fetchEndpoint('/api/weather', d => ({ weather_events: d.events }));
      layerFetchedRef.current.add('weather');
    }
    // Infrastructure
    if (activeLayers.infrastructure && !layerFetchedRef.current.has('infrastructure')) {
      fetchEndpoint('/api/infrastructure', d => ({ infrastructure: d.infrastructure }));
      layerFetchedRef.current.add('infrastructure');
    }
    // Global Incidents (GDELT)
    if (activeLayers.global_incidents && !layerFetchedRef.current.has('gdelt')) {
      fetchEndpoint('/api/gdelt', d => ({ gdelt: d.events }));
      layerFetchedRef.current.add('gdelt');
    }
    // GPS Jamming — 24h aggregate from gpsjam.org (H3-res-4 hex polygons)
    if (activeLayers.gps_jamming_daily && !layerFetchedRef.current.has('gps_jamming_daily')) {
      fetchEndpoint('/api/gps-jamming', d => ({ gps_jamming_daily: d }));
      layerFetchedRef.current.add('gps_jamming_daily');
    }

  }, [activeLayers]);

  // ── LAYER-AWARE POLLING — only poll data for active layers ──
  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [];
    if (activeLayers.flights || activeLayers.military || activeLayers.jets || activeLayers.private) {
      intervals.push(setInterval(() => fetchEndpoint('/api/flights'), 300000)); // 5 min (was 2 min)
    }

    if (activeLayers.balloons) {
      intervals.push(setInterval(() => fetchEndpoint('/api/balloons', d => ({ balloons: d.balloons })), 30000)); // 30s
    }
    if (activeLayers.radiation) {
      intervals.push(setInterval(() => fetchEndpoint('/api/radiation', d => ({ radiation: d.stations })), 60000)); // 1m
    }
    if (activeLayers.maritime) {
      intervals.push(setInterval(() => fetchEndpoint('/api/maritime', d => ({ maritime_ports: d.ports, maritime_chokepoints: d.chokepoints, maritime_ships: d.ships })), 60000)); // 1m
    }
    if (activeLayers.air_quality) {
      // Server caches 30 min, so client poll every 15 min is plenty fresh
      intervals.push(setInterval(() => fetchEndpoint('/api/environment/air-quality', d => ({ air_quality: d.cities, air_quality_built_at: d.built_at })), 900000));
    }
    if (activeLayers.ransomware) {
      // Server caches 1h, client refresh every 30 min
      intervals.push(setInterval(() => fetchEndpoint('/api/cyber/ransomware', d => ({ ransomware_countries: d.countries, ransomware_total: d.total_victims, ransomware_window: d.window_days, ransomware_groups: d.groups_seen })), 1800000));
    }
    if (activeLayers.storms) {
      // Storm positions update every ~6h; client refresh every 30 min
      intervals.push(setInterval(() => fetchEndpoint('/api/environment/storms', d => ({ storms: d.storms, storms_built_at: d.built_at })), 1800000));
    }
    if (activeLayers.volcanoes) {
      // EONET updates daily; client refresh every 2h
      intervals.push(setInterval(() => fetchEndpoint('/api/environment/volcanoes', d => ({ volcanoes: d.volcanoes, volcanoes_built_at: d.built_at })), 7200000));
    }
    // Fires: no polling needed (data changes very slowly, initial fetch is enough)
    return () => intervals.forEach(clearInterval);
  }, [activeLayers, fetchEndpoint]);

  // CCTV: loaded once on layer toggle via layerFetchedRef (no viewport polling)

  // Reactive layer fetch: handled by layerFetchedRef above (no duplicate)

  const totalFlights = useMemo(() => (
    (data.commercial_flights?.length||0)+(data.private_flights?.length||0)+(data.private_jets?.length||0)+(data.military_flights?.length||0)
  ), [data.commercial_flights, data.private_flights, data.private_jets, data.military_flights]);

  // Dynamic Threat Level based on active global incidents
  const majorQuakes = data.earthquakes?.filter((e: any) => e.magnitude >= 5).length || 0;
  const severeWeather = data.weather_events?.filter((w: any) => w.severity === 'high').length || 0;
  const conflictEvents = data.gdelt?.length || 0;
  const activeFires = data.fires?.length || 0;
  const threatScore = useMemo(() => (
    majorQuakes + severeWeather * 2 + conflictEvents * 0.1 + activeFires * 0.01
  ), [majorQuakes, severeWeather, conflictEvents, activeFires]);
  const threatLevel = threatScore >= 10 ? 'CRITICAL' : threatScore >= 5 ? 'HIGH' : threatScore >= 2 ? 'ELEVATED' : 'NOMINAL';
  const threatColor = threatLevel === 'CRITICAL' ? '#FF1744' : threatLevel === 'HIGH' ? '#FF9500' : threatLevel === 'ELEVATED' ? '#FFD700' : '#00E676';
  const [threatHovered, setThreatHovered] = useState(false);

  return (
    <main className="fixed inset-0 w-full h-full bg-[var(--bg-void)] overflow-hidden">

      {/* ── SPLASH ── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0 z-[999] bg-[var(--bg-void)] flex flex-col items-center justify-center">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="w-16 h-16 rounded-full border-2 border-[var(--gold-primary)] flex items-center justify-center mb-4 animate-glow-pulse">
              <div className="w-8 h-8 rounded-full bg-[var(--gold-primary)]/20 border border-[var(--gold-primary)]/40" />
            </motion.div>
            <motion.h1 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-3xl font-bold tracking-[0.6em] text-[var(--text-heading)] font-mono">JACKS WORLD</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[9px] text-[var(--gold-primary)] font-mono tracking-[0.3em] mt-2">MONITORING THE SITUATION...</motion.p>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.8, duration: 1.5 }} className="w-48 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold-primary)] to-transparent mt-6 origin-left" />
          </motion.div>
        )}
      </AnimatePresence>



      {/* ── MAP ── */}
      <ErrorBoundary name="Map">
        <OsirisMap 
          data={data} 
          activeLayers={activeLayers} 
          projection={mapProjection} 
          mapStyle={mapStyle === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'dark'} 
          wallMonitorMode={wallMonitorMode}
          onEntityClick={handleEntityClick} 
          onMouseCoords={handleMouseCoords} 
          onRightClick={handleRightClick} 
          onViewStateChange={setMapView} 
          flyToLocation={flyToLocation} 
        />
      </ErrorBoundary>

      {/* ── MAP VIEW CONTROLS (3D/2D + SATELLITE TOGGLE) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.5 }}
        className="absolute bottom-[75px] md:bottom-6 left-3 md:left-[315px] z-[200] flex items-center gap-2 pointer-events-none"
      >
        {/* 3D/2D Toggle */}
        <button
          onClick={() => setMapProjection(p => p === 'globe' ? 'mercator' : 'globe')}
          className="glass-panel p-2.5 pointer-events-auto hover:border-[var(--gold-primary)]/40 transition-colors group relative"
          title={mapProjection === 'globe' ? 'Switch to 2D Map' : 'Switch to 3D Globe'}
        >
          {mapProjection === 'globe' ? (
            <MapPinned className="w-4 h-4 text-[var(--gold-primary)] group-hover:scale-110 transition-transform" />
          ) : (
            <Globe className="w-4 h-4 text-[var(--cyan-primary)] group-hover:scale-110 transition-transform" />
          )}
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-muted)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity glass-panel px-2 py-1 z-[300]">
            {mapProjection === 'globe' ? '2D MAP' : '3D GLOBE'}
          </span>
        </button>

        {/* Map Style Toggle */}
        <button
          onClick={() => setMapStyle(s => s === 'dark' ? 'satellite' : 'dark')}
          className="glass-panel p-2.5 pointer-events-auto hover:border-[var(--gold-primary)]/40 transition-colors group relative"
          title={mapStyle === 'dark' ? 'Satellite View' : 'Night View'}
        >
          {mapStyle === 'dark' ? (
            <Satellite className="w-4 h-4 text-[var(--alert-green)] group-hover:scale-110 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--cyan-primary)] group-hover:scale-110 transition-transform" />
          )}
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-[var(--text-muted)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity glass-panel px-2 py-1 z-[300]">
            {mapStyle === 'dark' ? 'SATELLITE' : 'NIGHT MODE'}
          </span>
        </button>
      </motion.div>

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 2.5 }} className={`absolute top-3 left-3 md:top-5 md:left-5 z-[200] pointer-events-none flex items-center gap-2 md:gap-3`}>
        <div className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center relative">
          {/* Ambient glow ring — slow rotating */}
          <div className="absolute inset-[-4px] md:inset-[-5px] rounded-full border border-[var(--gold-primary)]/20" style={{ animation: 'osiris-rotate 12s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[var(--gold-primary)] shadow-[0_0_6px_var(--gold-primary)]" />
          </div>
          <div className="absolute inset-[-8px] md:inset-[-10px] rounded-full border border-[var(--gold-primary)]/10" style={{ animation: 'osiris-rotate 20s linear infinite reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-0.5 h-0.5 rounded-full bg-[var(--gold-primary)]/60" />
          </div>
          <div className="w-5 h-5 md:w-7 md:h-7 rounded-full border-2 border-[var(--gold-primary)] flex items-center justify-center animate-glow-pulse">
            <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-[var(--gold-primary)]/30 border border-[var(--gold-primary)]/60" />
          </div>
          <div className="absolute w-[1px] h-full bg-[var(--gold-primary)]/30" />
          <div className="absolute w-full h-[1px] bg-[var(--gold-primary)]/30" />
        </div>
        <div>
          <h1 className="text-base md:text-xl font-bold tracking-[0.4em] md:tracking-[0.5em] text-[var(--text-heading)] font-mono">JACKS WORLD</h1>
          <span className="text-[8px] md:text-[9px] text-[var(--gold-primary)] font-mono tracking-[0.2em] md:tracking-[0.3em] opacity-80">MONITORING THE SITUATION</span>
        </div>
      </motion.div>

      {/* ── TOP-RIGHT STATUS (desktop) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }} className="status-bar-desktop absolute top-3 right-3 md:top-4 md:right-5 z-[200] pointer-events-none flex items-center justify-end gap-2 md:gap-3 text-[9px] md:text-[10px] font-mono tracking-widest text-[var(--text-muted)] whitespace-nowrap">
        {/* Threat Level Badge with hover breakdown */}
        <span
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full relative pointer-events-auto cursor-help"
          style={{ background: `${threatColor}12`, border: `1px solid ${threatColor}30` }}
          onMouseEnter={() => setThreatHovered(true)}
          onMouseLeave={() => setThreatHovered(false)}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-osiris-pulse" style={{ backgroundColor: threatColor, boxShadow: `0 0 6px ${threatColor}` }} />
          <span className="text-[9px] font-bold tracking-wider" style={{ color: threatColor }}>{threatLevel}</span>

          {/* Hover tooltip breakdown */}
          {threatHovered && (
            <div className="absolute top-full mt-2 right-0 z-[500] pointer-events-none" style={{ minWidth: 260 }}>
              <div className="glass-panel p-3 osiris-glow text-left" style={{ borderColor: `${threatColor}40` }}>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-secondary)]">
                  <span className="w-2 h-2 rounded-full animate-osiris-pulse" style={{ backgroundColor: threatColor }} />
                  <span className="text-[11px] font-mono font-bold tracking-wider" style={{ color: threatColor }}>THREAT LEVEL: {threatLevel}</span>
                </div>
                <div className="text-[9px] font-mono text-[var(--text-secondary)] mb-2">
                  Composite score: <span className="text-[var(--text-primary)] font-bold">{threatScore.toFixed(1)}</span>
                  <span className="text-[var(--text-muted)]"> / 10 threshold</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">🌍 M5.0+ Earthquakes</span>
                    <span className={`text-[10px] font-mono font-bold ${majorQuakes > 0 ? 'text-[var(--alert-red)]' : 'text-[var(--alert-green)]'}`}>{majorQuakes}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">⛈️ Severe Weather</span>
                    <span className={`text-[10px] font-mono font-bold ${severeWeather > 0 ? 'text-[var(--alert-orange)]' : 'text-[var(--alert-green)]'}`}>{severeWeather} <span className="text-[var(--text-muted)] font-normal">×2</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">⚔️ Conflict Events</span>
                    <span className={`text-[10px] font-mono font-bold ${conflictEvents > 20 ? 'text-[var(--alert-red)]' : conflictEvents > 0 ? 'text-[var(--alert-orange)]' : 'text-[var(--alert-green)]'}`}>{conflictEvents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">🔥 Active Fires</span>
                    <span className={`text-[10px] font-mono font-bold ${activeFires > 100 ? 'text-[var(--alert-orange)]' : 'text-[var(--alert-green)]'}`}>{activeFires.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[var(--border-secondary)] text-[8px] font-mono text-[var(--text-muted)] leading-relaxed">
                  {threatLevel === 'CRITICAL' ? 'Multiple severe global events detected. Elevated geopolitical and natural disaster risk across monitored regions.' :
                   threatLevel === 'HIGH' ? 'Significant global incidents active. Monitor regional developments closely.' :
                   threatLevel === 'ELEVATED' ? 'Moderate activity detected across intelligence feeds. Standard monitoring advised.' :
                   'All monitored feeds within normal parameters. No significant threats detected.'}
                </div>
              </div>
            </div>
          )}
        </span>
        <span>SYS: <span className={backendStatus === 'connected' ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}>{backendStatus.toUpperCase()}</span></span>

        {spaceWeather && <span className="hidden lg:inline">SOLAR: <span style={{ color: spaceWeather.storm_color, fontWeight: 700 }}>Kp{spaceWeather.kp_index}</span></span>}
        <UptimeClock />
        <span>V4.1</span>
        <LivePopulationClock />
      </motion.div>

      {/* ── MOBILE: Compact top status ── */}
      {isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="absolute top-3 right-3 z-[200] pointer-events-none flex items-center gap-2">
          <div className="glass-panel px-2.5 py-1.5 flex items-center gap-2 text-[8px] font-mono tracking-wider">
            <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'connected' ? 'bg-[var(--alert-green)]' : 'bg-[var(--alert-red)]'} animate-osiris-pulse`} />
            <span style={{ color: threatColor, fontWeight: 700 }}>{threatLevel}</span>
          </div>
        </motion.div>
      )}



      {/* ── LEFT HUD (desktop): Layers + Stats + Markets + Intel ── */}
      <motion.div
        id="hud-left"
        data-hud="left"
        className="desktop-panel absolute left-5 top-20 bottom-24 w-72 z-[200] pointer-events-none"
        animate={{ x: leftPanelOpen ? 0 : -304 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        drag="x"
        dragConstraints={{ left: -304, right: 0 }}
        dragElastic={0.04}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50 || info.velocity.x < -250) setLeftPanelOpen(false);
          if (info.offset.x > 50 || info.velocity.x > 250) setLeftPanelOpen(true);
        }}
      >
        <div className="h-full flex flex-col gap-3 pointer-events-auto overflow-y-auto styled-scrollbar pr-1">
          {showLayers && (
            <>
              <LayerPanel data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} />
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="glass-panel px-3 py-2.5 pointer-events-auto">
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div><div className="hud-label">AIRCRAFT</div><div className="hud-value text-[10px] animate-data-pulse">{totalFlights.toLocaleString()}</div></div>
                  <div><div className="hud-label">SATS</div><div className="hud-value text-[10px]">{(data.satellites?.length||0).toLocaleString()}</div></div>
                  <div><div className="hud-label">CCTV</div><div className="hud-value text-[10px]">{(data.cameras?.length||0).toLocaleString()}</div></div>
                  <div><div className="hud-label">WEATHER</div><div className="hud-value text-[10px]" style={{ color: '#E040FB' }}>{(data.weather_events?.length||0)}</div></div>
                  <div><div className="hud-label">NUCLEAR</div><div className="hud-value text-[10px]" style={{ color: '#76FF03' }}>{(data.infrastructure?.length||0)}</div></div>
                </div>
              </motion.div>
              <ViewPresets onNavigate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, ts: Date.now() }); setMapView(v => ({ ...v, zoom })); }} />
            </>
          )}
          {showMarkets && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
          {showIntel && <IntelFeed data={data} onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} />}
        </div>
        <button
          type="button"
          aria-label={leftPanelOpen ? 'Close data layers drawer' : 'Open data layers drawer'}
          aria-expanded={leftPanelOpen}
          onClick={() => setLeftPanelOpen(open => !open)}
          className="desktop-panel-toggle absolute top-1/2 -right-7 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center gap-1 hover:border-[var(--gold-primary)]/40 transition-colors"
          title={leftPanelOpen ? 'Close data layers' : 'Open data layers'}
        >
          <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          {leftPanelOpen ? (
            <ChevronLeft className="w-4 h-4 text-[var(--gold-primary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />
          )}
          <span className="sr-only">{leftPanelOpen ? 'Close' : 'Open'}</span>
        </button>
      </motion.div>

      {/* ── RIGHT HUD (desktop): Search + RECON + Live Alerts ── */}
      <motion.div
        className="desktop-panel absolute right-5 top-28 bottom-24 w-80 z-[200] pointer-events-none"
        animate={{ x: rightPanelOpen ? 0 : 360 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      >
        <div id="hud-right" data-hud="right" className="h-full flex flex-col gap-3 pointer-events-auto overflow-y-auto styled-scrollbar pr-1">
          <div className="flex gap-2 items-start">
            <div className="flex-1"><SearchBar onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} /></div>
            <div className="relative"><SharePanel mapView={mapView} activeLayers={activeLayers} mouseCoords={mouseCoords} /></div>
          </div>
          <OsintPanel />
          <LiveAlerts data={data} onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} onWatchFeed={(url, name) => { setLiveFeedUrl(url); setLiveFeedName(name); }} />
        </div>
        <button
          type="button"
          aria-label={rightPanelOpen ? 'Shrink side panes' : 'Expand side panes'}
          aria-expanded={rightPanelOpen}
          onClick={() => setRightPanelOpen(open => !open)}
          className="desktop-panel-toggle absolute top-1/2 -left-7 -translate-y-1/2 pointer-events-auto flex flex-col items-center justify-center gap-1 hover:border-[var(--gold-primary)]/40 transition-colors"
          title={rightPanelOpen ? 'Shrink panes' : 'Expand panes'}
        >
          <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          {rightPanelOpen ? (
            <ChevronRight className="w-4 h-4 text-[var(--gold-primary)]" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-[var(--gold-primary)]" />
          )}
          <span className="sr-only">{rightPanelOpen ? 'Shrink' : 'Expand'}</span>
        </button>
      </motion.div>

      {/* ── LIVE FEED VIEWER OVERLAY ── */}
      <AnimatePresence>
        {liveFeedUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setLiveFeedUrl(null)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="w-[90vw] max-w-[900px] flex flex-col relative rounded-xl overflow-hidden border border-[var(--border-primary)] shadow-2xl bg-black"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF4081] animate-osiris-pulse" />
                  <span className="text-[12px] font-mono font-bold text-white tracking-wider">{liveFeedName}</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[9px] font-bold">LIVE STREAM</span>
                  {!liveFeedEmbedAllowed && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px]">EXTERNAL ONLY</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={
                      liveFeedUrl.includes('channel=')
                        ? `https://www.youtube.com/channel/${liveFeedUrl.split('channel=')[1].split('&')[0]}/live`
                        : liveFeedUrl.includes('/embed/')
                        ? `https://www.youtube.com/watch?v=${liveFeedUrl.split('/embed/')[1].split('?')[0]}`
                        : liveFeedUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--border-primary)] hover:bg-[var(--gold-primary)] hover:text-black text-white transition-colors text-[11px] font-mono"
                  >
                    <span>Open in YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={() => setLiveFeedUrl(null)} className="text-white/70 hover:text-white transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body — iframe or external card */}
              {liveFeedEmbedAllowed ? (
                <div className="w-full aspect-video relative bg-black">
                  <iframe
                    src={liveFeedUrl}
                    className="w-full h-full absolute inset-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-black/95">
                  <div className="text-center px-8">
                    <div className="w-14 h-14 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/20 flex items-center justify-center mx-auto mb-4">
                      <ExternalLink className="w-6 h-6 text-[#39FF14]" />
                    </div>
                    <p className="text-[13px] font-mono font-bold text-white tracking-widest mb-2">EMBED RESTRICTED</p>
                    <p className="text-[11px] font-mono text-white/50 mb-6 max-w-xs">
                      {liveFeedName} does not allow third-party embedding. Click below to open the live stream directly.
                    </p>
                    <a
                      href={
                        liveFeedUrl.includes('channel=')
                          ? `https://www.youtube.com/channel/${liveFeedUrl.split('channel=')[1].split('&')[0]}/live`
                          : liveFeedUrl.includes('/embed/')
                          ? `https://www.youtube.com/watch?v=${liveFeedUrl.split('/embed/')[1].split('?')[0]}`
                          : liveFeedUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded border border-[#39FF14]/40 text-[#39FF14] font-mono text-[12px] hover:bg-[#39FF14]/10 transition-colors tracking-wider"
                    >
                      <ExternalLink className="w-4 h-4" />
                      OPEN LIVE STREAM
                    </a>
                  </div>
                </div>
              )}

              {/* Footer — only show for embeddable feeds */}
              {liveFeedEmbedAllowed && (
                <div className="bg-[#111]/90 px-4 py-2.5 border-t border-[var(--border-primary)] flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
                  <span className="text-[11px] font-mono text-white/70 leading-relaxed">
                    If you see &ldquo;Video unavailable&rdquo;, use <strong className="text-[var(--gold-primary)]">Open in YouTube</strong> above.
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MOBILE UI ═══ */}
      {isMobile && (
        <>
          {/* Mobile Bottom Navigation */}
          <div className="mobile-nav">
            <div className="glass-panel mobile-nav-inner">
              {[
                { id: 'layers' as const, icon: Layers, label: 'LAYERS' },
                { id: 'markets' as const, icon: BarChart3, label: 'MARKETS' },
                { id: 'intel' as const, icon: Newspaper, label: 'INTEL' },
                { id: 'recon' as const, icon: Radar, label: 'RECON' },
                { id: 'search' as const, icon: Search, label: 'SEARCH' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setMobilePanel(mobilePanel === tab.id ? null : tab.id)}
                  className={`mobile-nav-btn ${mobilePanel === tab.id ? 'active' : ''}`}>
                  <tab.icon className={`w-4 h-4 ${tab.id === 'recon' ? 'text-[var(--cyan-primary)]' : ''}`} />
                  <span className={tab.id === 'recon' ? 'text-[var(--cyan-primary)]' : ''}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Drawer */}
          <AnimatePresence>
            {mobilePanel && (
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-[52px] left-0 right-0 z-[400] glass-panel rounded-b-none overflow-y-auto styled-scrollbar"
                style={{ maxHeight: 'min(55vh, calc(100dvh - 100px))', paddingBottom: 'env(safe-area-inset-bottom, 4px)' }}
              >
                <div className="mobile-drawer-handle" />
                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hud-text text-[9px] text-[var(--text-primary)]">
                      {mobilePanel === 'layers' ? 'LAYERS & STATS' : mobilePanel === 'markets' ? 'MARKETS & INTEL' : mobilePanel === 'intel' ? 'INTEL FEED' : mobilePanel === 'recon' ? 'OSIRIS RECON' : 'SEARCH'}
                    </span>
                    <button onClick={() => setMobilePanel(null)} className="text-[var(--text-muted)] p-1"><X className="w-4 h-4" /></button>
                  </div>
                  {mobilePanel === 'layers' && (
                    <>
                      <div className="glass-panel-sm p-2 mb-2">
                        <div className="grid grid-cols-5 gap-1 text-center">
                          <div><div className="hud-label" style={{fontSize:'6px'}}>AIR</div><div className="hud-value text-[9px]">{totalFlights.toLocaleString()}</div></div>
                          <div><div className="hud-label" style={{fontSize:'6px'}}>SAT</div><div className="hud-value text-[9px]">{(data.satellites?.length||0)}</div></div>
                          <div><div className="hud-label" style={{fontSize:'6px'}}>CAM</div><div className="hud-value text-[9px]">{(data.cameras?.length||0)}</div></div>
                          <div><div className="hud-label" style={{fontSize:'6px'}}>WX</div><div className="hud-value text-[9px]" style={{color:'#E040FB'}}>{(data.weather_events?.length||0)}</div></div>
                          <div><div className="hud-label" style={{fontSize:'6px'}}>NUC</div><div className="hud-value text-[9px]" style={{color:'#76FF03'}}>{(data.infrastructure?.length||0)}</div></div>
                        </div>
                      </div>
                      <LayerPanel data={data} activeLayers={activeLayers} setActiveLayers={setActiveLayers} />
                      <div className="mt-2">
                        <ViewPresets onNavigate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, ts: Date.now() }); setMapView(v => ({ ...v, zoom })); setMobilePanel(null); }} />
                      </div>
                    </>
                  )}
                  {mobilePanel === 'markets' && <MarketsPanel data={data} spaceWeather={spaceWeather} />}
                  {mobilePanel === 'intel' && <IntelFeed data={data} onLocate={(lat, lng) => { setFlyToLocation({ lat, lng, ts: Date.now() }); setMobilePanel(null); }} />}
                  {mobilePanel === 'search' && (
                    <div className="space-y-2">
                      <SearchBar onLocate={(lat, lng) => { setFlyToLocation({ lat, lng, ts: Date.now() }); setMobilePanel(null); }} />
                      <SharePanel mapView={mapView} activeLayers={activeLayers} mouseCoords={mouseCoords} />
                    </div>
                  )}
                  {mobilePanel === 'recon' && (
                    <div className="space-y-2">
                      <OsintPanel isOpen={true} onClose={() => setMobilePanel(null)} isMobile={true} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── BOTTOM CENTER (desktop) ── */}
      {!isMobile && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3, duration: 0.8 }} className="desktop-only absolute bottom-5 left-1/2 -translate-x-1/2 z-[200] pointer-events-auto">
          <div className="glass-panel px-5 py-2.5 flex items-center gap-5 osiris-glow" style={{ borderImage: 'linear-gradient(90deg, rgba(212,175,55,0.05), rgba(212,175,55,0.2), rgba(212,175,55,0.05)) 1', borderImageSlice: 1, borderWidth: '1px', borderStyle: 'solid' }}>
            {/* Threat Level */}
            <div className="flex flex-col items-center min-w-[70px]">
              <div className="hud-label">THREAT</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-osiris-pulse" style={{ backgroundColor: threatColor, boxShadow: `0 0 6px ${threatColor}` }} />
                <span className="text-[10px] font-mono font-bold tracking-wide" style={{ color: threatColor }}>{threatLevel}</span>
              </div>
            </div>
            <div className="w-px h-7 bg-[var(--border-primary)]" />
            <div className="flex flex-col items-center min-w-[110px]">
              <div className="hud-label">COORDINATES</div>
              <div className="text-[10px] font-mono font-bold text-[var(--gold-primary)] tracking-wide">{mouseCoords ? `${mouseCoords.lat.toFixed(4)}, ${mouseCoords.lng.toFixed(4)}` : '—'}</div>
            </div>
            <div className="w-px h-7 bg-[var(--border-primary)]" />
            <div className="flex flex-col items-center min-w-[160px] max-w-[280px]">
              <div className="hud-label">LOCATION</div>
              <div className="text-[9px] text-[var(--text-secondary)] font-mono truncate max-w-[280px]">{locationLabel || 'Hover over map...'}</div>
            </div>
            <div className="w-px h-7 bg-[var(--border-primary)]" />
            <div className="flex flex-col items-center">
              <div className="hud-label">ZOOM</div>
              <div className="text-[10px] font-mono font-bold text-[var(--gold-primary)]">{mapView.zoom.toFixed(1)}</div>
            </div>
            <div className="w-px h-7 bg-[var(--border-primary)]" />
            {/* Data Feeds Count */}
            <div className="flex flex-col items-center min-w-[60px]">
              <div className="hud-label">FEEDS</div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-[var(--cyan-primary)]" />
                <span className="text-[10px] font-mono font-bold text-[var(--cyan-primary)]">{Object.values(activeLayers).filter(Boolean).length}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Scale Bar (desktop) ── */}
      <div className="desktop-only absolute bottom-[4.5rem] left-[20rem] z-[201] pointer-events-none">
        <ScaleBar zoom={mapView.zoom} latitude={mapView.latitude} />
      </div>

      {/* ── Region Dossier ── */}
      {(regionDossier || dossierLoading) && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute top-16 md:top-20 left-2 right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[300] md:w-[480px] max-h-[65vh] overflow-y-auto styled-scrollbar">
          <div className="glass-panel p-5 osiris-glow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono font-bold text-[var(--gold-primary)] tracking-wider">REGION DOSSIER</h2>
              <button onClick={() => { setRegionDossier(null); setDossierLoading(false); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">✕</button>
            </div>
            {dossierLoading ? (
              <div className="text-center py-8">
                <div className="w-5 h-5 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">COMPILING INTEL...</span>
              </div>
            ) : regionDossier && (
              <div className="space-y-3">
                <div><div className="hud-label mb-0.5">LOCATION</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.location?.display_name}</div></div>
                {regionDossier.country && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="hud-label mb-0.5">COUNTRY</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.flag} {regionDossier.country.name}</div></div>
                    <div><div className="hud-label mb-0.5">CAPITAL</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.capital}</div></div>
                    <div><div className="hud-label mb-0.5">POPULATION</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.population?.toLocaleString()}</div></div>
                    <div><div className="hud-label mb-0.5">REGION</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.subregion || regionDossier.country.region}</div></div>
                    <div><div className="hud-label mb-0.5">LANGUAGES</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.languages?.join(', ')}</div></div>
                    <div><div className="hud-label mb-0.5">AREA</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.area?.toLocaleString()} km²</div></div>
                  </div>
                )}
                {regionDossier.head_of_state && (<div><div className="hud-label mb-0.5">HEAD OF STATE</div><div className="text-xs text-[var(--gold-primary)]">{regionDossier.head_of_state.name}</div><div className="text-[8px] text-[var(--text-muted)]">{regionDossier.head_of_state.position}</div></div>)}
                {regionDossier.wikipedia && (<div><div className="hud-label mb-1">INTELLIGENCE BRIEF</div><div className="flex gap-3">{regionDossier.wikipedia.thumbnail && <img src={regionDossier.wikipedia.thumbnail} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />}<p className="text-[8px] text-[var(--text-secondary)] leading-relaxed">{regionDossier.wikipedia.extract}</p></div></div>)}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Camera Viewer ── */}
      <CameraViewer
        camera={activeCamera}
        onClose={() => setActiveCamera(null)}
        onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
      />

      {/* ── OVERLAYS ── */}
      <div className="vignette absolute inset-0 pointer-events-none z-[2]" />
      <div className="crt-scanlines absolute inset-0 pointer-events-none z-[3] opacity-[0.02]" />
      {/* Corner frames */}
      {['top-0 left-0','top-0 right-0','bottom-0 left-0','bottom-0 right-0'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} w-16 h-16 pointer-events-none z-[1]`}>
          <div className={`absolute ${pos.includes('top') ? 'top-0' : 'bottom-0'} ${pos.includes('left') ? 'left-0' : 'right-0'} w-full h-[1px] bg-gradient-to-${pos.includes('left') ? 'r' : 'l'} from-[var(--gold-primary)]/30 to-transparent`} />
          <div className={`absolute ${pos.includes('top') ? 'top-0' : 'bottom-0'} ${pos.includes('left') ? 'left-0' : 'right-0'} w-[1px] h-full bg-gradient-to-${pos.includes('top') ? 'b' : 't'} from-[var(--gold-primary)]/30 to-transparent`} />
        </div>
      ))}

      {/* Keyboard Shortcuts Overlay */}
      <KeyboardShortcuts />

      {/* ── GLOBAL STATUS TICKER (bottom) ── */}
      <GlobalStatusBar />

      {/* Shortcut hint */}
      <div className="desktop-only absolute bottom-[26px] right-5 z-[200] pointer-events-none text-[6px] font-mono text-[var(--text-muted)]/40 tracking-widest">
        [?] SHORTCUTS · [F] FULLSCREEN · [S] SHARE · [R] RESET VIEW
      </div>


    </main>
  );
}
