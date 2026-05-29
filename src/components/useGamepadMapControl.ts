import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type maplibregl from 'maplibre-gl';

/**
 * OSIRIS — Gamepad map control (desktop).
 *
 * Left stick pans, triggers (LT/RT) zoom, and a crosshair viewfinder lock-snaps
 * to the nearest POI via a critically-damped spring; A targets the locked POI
 * (cycling through a cluster on repeated presses), B closes the popup. Extracted
 * as a self-contained hook so it layers onto the map without touching the panel
 * UI. Returns the connected flag + the reticle ref to render the crosshair.
 *
 * Note: the HUD-scroll / panel-toggle / wall-monitor behaviours from the older
 * shell are intentionally omitted here — they depend on the draggable panels.
 */
type Candidate = { lng: number; lat: number; key: string };

export function useGamepadMapControl({
  mapRef,
  popupRef,
}: {
  mapRef: RefObject<maplibregl.Map | null>;
  popupRef: RefObject<maplibregl.Popup | null>;
}) {
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const lockedLngLatRef = useRef<[number, number] | null>(null);
  const lockedScreenRef = useRef<{ x: number; y: number } | null>(null);
  const candidatesRef = useRef<Candidate[]>([]);
  const candidateIdxRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.getGamepads) return;

    const hasAny = () => Array.from(navigator.getGamepads() || []).some(g => g);
    setGamepadConnected(hasAny());
    const onConn = () => setGamepadConnected(true);
    const onDisc = () => setGamepadConnected(hasAny());
    window.addEventListener('gamepadconnected', onConn);
    window.addEventListener('gamepaddisconnected', onDisc);

    // Snappable Point sources. Sources whose layers are toggled off are emptied
    // via setGeo([]), so querySourceFeatures returns nothing for them.
    const SNAP_SOURCES = [
      'flights', 'military', 'jets', 'private-fl', 'satellites', 'earthquakes',
      'gdelt', 'gps-jamming', 'gps-jamming-daily', 'cctv', 'fires', 'weather',
      'infrastructure', 'maritime', 'maritime-choke', 'maritime-ships',
      'live-news', 'conflict-zones', 'war-alerts-targets', 'war-alerts-lines',
      'balloons', 'radiation', 'sharks', 'shark-track', 'shark-track-pings',
      'fish-stocks', 'fishing-effort', 'fish-landings', 'oil-gas', 'mines',
      'refineries', 'forests', 'cb-rates', 'submarine-cables',
      'submarine-cable-landings', 'power-plants', 'military-bases', 'spaceports',
      'air-quality', 'outbreaks', 'influence-arcs', 'influence-ops',
      'influence-takedowns', 'cyber-arcs', 'cyber-targets', 'ransomware',
      'macro-us', 'pipelines', 'mineral-arcs', 'mineral-nodes', 'refugee-arcs',
      'refugee-asylum', 'storms', 'storm-tracks', 'coral-reefs', 'shipping-lanes',
      'air-cargo', 'rail-corridors', 'data-centers', 'gpu-clusters',
    ];
    const SNAP_RADIUS_PX = 90;
    const DEADZONE = 0.15;
    const PAN_PX_PER_FRAME = 9;
    const TRIGGER_ZOOM_PER_FRAME = 0.06; // at full trigger pull
    const SPRING_OMEGA = 14;             // critically-damped spring (ζ = 1)
    const apply = (v: number) => (Math.abs(v) < DEADZONE ? 0 : Math.sign(v) * (Math.abs(v) - DEADZONE) / (1 - DEADZONE));

    let raf = 0;
    let aWasDown = false;
    let bWasDown = false;
    let lastTs = performance.now();
    let lastSnapMs = 0;
    // Crosshair offset from canvas center (CSS px) + per-axis velocity.
    let ox = 0, oy = 0, vx = 0, vy = 0;

    const tick = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      const map = mapRef.current;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads).find(g => g) || null;

      if (gp && map) {
        const lx = apply(gp.axes[0] ?? 0);
        const ly = apply(gp.axes[1] ?? 0);
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

        // Find nearest snappable POI to canvas center, throttled to ~10Hz; the
        // spring interpolates every frame, and we re-project the cached lock so
        // it tracks the camera and moving entities.
        const canvas = map.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        let tx = 0, ty = 0;
        let locked: { x: number; y: number } | null = null;
        if (ts - lastSnapMs >= 90) {
          lastSnapMs = ts;
          const R2 = SNAP_RADIUS_PX * SNAP_RADIUS_PX;
          const foundPts: Array<{ lng: number; lat: number; d2: number }> = [];
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
                const key = `${c[0].toFixed(5)}:${c[1].toFixed(5)}`;
                if (seen.has(key)) continue;
                const p = map.project(c as maplibregl.LngLatLike);
                const dx = p.x - cx, dy = p.y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 <= R2) {
                  seen.add(key);
                  foundPts.push({ lng: c[0], lat: c[1], d2 });
                }
              }
            }
          } catch { /* sources still warming up */ }
          foundPts.sort((a, b) => a.d2 - b.d2);
          const newCandidates: Candidate[] = foundPts.map(({ lng, lat }) => ({
            lng, lat, key: `${lng.toFixed(5)}:${lat.toFixed(5)}`,
          }));

          // Preserve cycle position when the candidate set changes.
          const prev = candidatesRef.current;
          const prevKey = prev[candidateIdxRef.current]?.key;
          let nextIdx = 0;
          if (prevKey) {
            const idx = newCandidates.findIndex(c => c.key === prevKey);
            if (idx >= 0) nextIdx = idx;
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

        // A (index 0): click the locked POI, cycling through a cluster; fall
        // back to the canvas centre when nothing's in range.
        const aDown = !!gp.buttons[0]?.pressed;
        if (aDown && !aWasDown) {
          const candidates = candidatesRef.current;
          let target: { x: number; y: number };
          if (candidates.length > 0) {
            const sel = candidates[candidateIdxRef.current % candidates.length];
            const p = map.project([sel.lng, sel.lat]);
            target = { x: p.x, y: p.y };
            candidateIdxRef.current = (candidateIdxRef.current + 1) % candidates.length;
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

        // B (index 1): close the popup + any Escape-aware UI.
        const bDown = !!gp.buttons[1]?.pressed;
        if (bDown && !bWasDown) {
          popupRef.current?.remove();
          popupRef.current = null;
          const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
          window.dispatchEvent(esc);
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
        bWasDown = bDown;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', onConn);
      window.removeEventListener('gamepaddisconnected', onDisc);
    };
  }, [mapRef, popupRef]);

  return { gamepadConnected, reticleRef };
}
