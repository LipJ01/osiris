import { useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type maplibregl from 'maplibre-gl';

/**
 * OSIRIS — Extended intelligence map layers (data sync).
 *
 * Holds the per-layer effects that push fetched `data` into the maplibre
 * geojson sources installed by installExtendedLayers. Extracted from OsirisMap
 * as a custom hook so the map component stays focused on the base layers.
 */
export interface SelectedShark { id: number; name: string; bucket: string; color: string; }

export interface ExtendedSyncParams {
  mapReady: boolean;
  data: any;
  activeLayers: any;
  setGeo: (source: string, features: any[]) => void;
  selectedShark: SelectedShark | null;
  mapRef: RefObject<maplibregl.Map | null>;
}

export function useExtendedLayerSync({ mapReady, data, activeLayers, setGeo, selectedShark, mapRef }: ExtendedSyncParams) {
  // GPS Jamming — daily aggregate from gpsjam.org (FeatureCollection passes straight through)
  useEffect(() => {
    if (!mapReady) return;
    const fc = data.gps_jamming_daily as any;
    setGeo('gps-jamming-daily', activeLayers.gps_jamming_daily && fc?.features ? fc.features : []);
  }, [mapReady, data.gps_jamming_daily, activeLayers.gps_jamming_daily, setGeo]);
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

}
