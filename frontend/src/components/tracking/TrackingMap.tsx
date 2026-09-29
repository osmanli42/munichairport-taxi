'use client';

// Mapbox map shared by the customer tracking page, the driver app and the admin live board.
// - the car glides between GPS fixes and turns with its heading (derived from movement when
//   the device doesn't report one), so a 5-second poll still looks live;
// - optional traffic-aware route line from the car to its current target;
// - auto-fit that backs off for 20 s once the user pans or zooms, with a recenter button.

import { useCallback, useEffect, useRef, useState } from 'react';
import { LatLng, haversine } from '@/lib/tracking';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const MAPBOX_VERSION = 'v3.9.0';

export function loadMapbox(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.mapboxgl) return resolve(w.mapboxgl);
    if (!document.getElementById('mapboxgl-css')) {
      const css = document.createElement('link');
      css.id = 'mapboxgl-css';
      css.rel = 'stylesheet';
      css.href = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`;
      document.head.appendChild(css);
    }
    const existing = document.getElementById('mapboxgl-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).mapboxgl));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = 'mapboxgl-js';
    s.src = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;
    s.onload = () => resolve((window as any).mapboxgl);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export const hasMapboxToken = () => !!MAPBOX_TOKEN;

export interface MapCar extends LatLng {
  id: string;
  heading?: number | null;
  accuracy?: number | null;
  stale?: boolean;
  label?: string;
  color?: string;
}

export interface MapPin extends LatLng {
  id: string;
  kind: 'pickup' | 'dropoff' | 'customer' | 'point';
  label?: string;
}

export interface MapCircle extends LatLng { id: string; radius_m: number; color: string }

interface Props {
  theme?: 'light' | 'dark';
  cars?: MapCar[];
  pins?: MapPin[];
  circles?: MapCircle[];
  route?: { from: LatLng; to: LatLng } | null;
  fitKey?: string;
  follow?: boolean;              // keep the (first) car centred — driver view
  showAccuracy?: boolean;
  padding?: { top: number; bottom: number; left: number; right: number };
  onCarClick?: (id: string) => void;
  onMapClick?: (p: LatLng) => void;
  className?: string;
  style?: React.CSSProperties;
  recenterLabel?: string;
  controlsTop?: boolean;         // logo/attribution/recenter at the top (bottom holds overlays)
}

const CAR_SVG = (color: string) => `
<svg width="34" height="34" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-opacity=".35"/></filter></defs>
  <g filter="url(#s)">
    <rect x="17" y="6" width="30" height="52" rx="11" fill="${color}" stroke="#0f172a" stroke-width="2.2"/>
    <rect x="21" y="15" width="22" height="11" rx="3.5" fill="#0f172a" opacity=".82"/>
    <rect x="21" y="41" width="22" height="8" rx="3" fill="#0f172a" opacity=".6"/>
    <rect x="26" y="29" width="12" height="7" rx="1.5" fill="#fff" stroke="#0f172a" stroke-width="1.2"/>
    <text x="32" y="34.6" font-size="5.2" font-family="Arial" font-weight="700" text-anchor="middle" fill="#0f172a">TAXI</text>
  </g>
</svg>`;

function circlePolygon(c: LatLng, radius: number, steps = 48): number[][] {
  const coords: number[][] = [];
  const latR = radius / 111_320;
  const lngR = radius / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([c.lng + lngR * Math.cos(a), c.lat + latR * Math.sin(a)]);
  }
  return coords;
}

function bearing(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

type CarState = {
  marker: any;
  el: HTMLDivElement;
  rot: HTMLDivElement;
  pos: LatLng;
  from: LatLng;
  to: LatLng;
  t0: number;
  heading: number;
  headingFrom: number;
  headingTo: number;
};

export default function TrackingMap({
  theme = 'light', cars = [], pins = [], circles = [], route = null, fitKey = '', follow = false,
  showAccuracy = false, padding = { top: 60, bottom: 60, left: 50, right: 50 },
  onCarClick, onMapClick, className, style, recenterLabel = 'Zentrieren', controlsTop = false,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const glRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const carsRef = useRef<Map<string, CarState>>(new Map());
  const pinsRef = useRef<Map<string, any>>(new Map());
  const userMovedAt = useRef(0);
  const [userMoved, setUserMoved] = useState(false);
  const lastFitKey = useRef<string | null>(null);
  const routeFetch = useRef<{ at: number; from: LatLng | null; to: LatLng | null }>({ at: 0, from: null, to: null });
  const raf = useRef<number | null>(null);
  const latest = useRef({ cars, pins, circles, route, padding, follow, fitKey });
  latest.current = { cars, pins, circles, route, padding, follow, fitKey };
  const clickRef = useRef({ onCarClick, onMapClick });
  clickRef.current = { onCarClick, onMapClick };

  // ── init ──
  useEffect(() => {
    if (!MAPBOX_TOKEN || !el.current || mapRef.current) return;
    let cancelled = false;
    loadMapbox().then((gl) => {
      if (cancelled || !el.current) return;
      glRef.current = gl;
      gl.accessToken = MAPBOX_TOKEN;
      const first = latest.current.cars[0] || latest.current.pins[0];
      const map = new gl.Map({
        container: el.current,
        style: theme === 'dark' ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/navigation-day-v1',
        center: first ? [first.lng, first.lat] : [11.7861, 48.3538],
        zoom: first ? 13 : 10,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        logoPosition: controlsTop ? 'top-left' : 'bottom-left',
      });
      map.addControl(new gl.AttributionControl({ compact: true }), controlsTop ? 'top-right' : 'bottom-left');
      map.touchZoomRotate.disableRotation();
      const markUser = () => { userMovedAt.current = Date.now(); setUserMoved(true); };
      map.on('dragstart', markUser);
      map.on('wheel', markUser);
      map.on('touchstart', (e: any) => { if (e.originalEvent?.touches?.length > 1) markUser(); });
      map.on('click', (e: any) => clickRef.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      map.on('load', () => {
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': theme === 'dark' ? '#0b1220' : '#1e3a8a', 'line-width': 9, 'line-opacity': 0.35 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': theme === 'dark' ? '#facc15' : '#2563eb', 'line-width': 5 } });
        map.addSource('circles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'circles-fill', type: 'fill', source: 'circles', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'circles-line', type: 'line', source: 'circles', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [2, 2] } });
        mapRef.current = map;
        setReady(true);
      });
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (raf.current) cancelAnimationFrame(raf.current);
      mapRef.current?.remove();
      mapRef.current = null;
      carsRef.current.clear();
      pinsRef.current.clear();
    };
    // theme is fixed for the life of the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── fit / follow ──
  const fit = useCallback((force: boolean) => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    if (!force && Date.now() - userMovedAt.current < 20_000) return;
    const { cars: c, pins: p, route: r, padding: pad, follow: f } = latest.current;
    if (f && c[0]) {
      map.easeTo({ center: [c[0].lng, c[0].lat], zoom: Math.max(map.getZoom(), 14.5), padding: pad, duration: 900 });
      return;
    }
    const pts: LatLng[] = [...c, ...p.filter((x) => x.kind !== 'point')];
    if (r) pts.push(r.to);
    if (!pts.length) return;
    if (pts.length === 1) {
      map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, padding: pad, duration: 900 });
      return;
    }
    const b = new gl.LngLatBounds();
    pts.forEach((x) => b.extend([x.lng, x.lat]));
    map.fitBounds(b, { padding: pad, maxZoom: 16.5, duration: 900 });
  }, []);

  const recenter = () => {
    userMovedAt.current = 0;
    setUserMoved(false);
    fit(true);
  };

  // ── animation loop for cars ──
  const animate = useCallback(() => {
    const now = performance.now();
    let moving = false;
    carsRef.current.forEach((c) => {
      const k = Math.min(1, (now - c.t0) / 1000);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      c.pos = { lat: c.from.lat + (c.to.lat - c.from.lat) * e, lng: c.from.lng + (c.to.lng - c.from.lng) * e };
      const dh = ((c.headingTo - c.headingFrom + 540) % 360) - 180; // shortest turn
      c.heading = (c.headingFrom + dh * e + 360) % 360;
      c.marker.setLngLat([c.pos.lng, c.pos.lat]);
      c.rot.style.transform = `rotate(${c.heading}deg)`;
      if (k < 1) moving = true;
    });
    raf.current = moving ? requestAnimationFrame(animate) : null;
  }, []);

  // ── sync cars ──
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    const seen = new Set<string>();
    for (const car of cars) {
      seen.add(car.id);
      const target = { lat: car.lat, lng: car.lng };
      let st = carsRef.current.get(car.id);
      if (!st) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        const rot = document.createElement('div');
        rot.style.cssText = 'transition:none;will-change:transform;';
        rot.innerHTML = CAR_SVG(car.color || '#facc15');
        wrap.appendChild(rot);
        if (car.label) {
          const tag = document.createElement('div');
          tag.textContent = car.label;
          tag.style.cssText = 'position:absolute;top:38px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#0f172a;color:#fff;font:600 11px system-ui,sans-serif;padding:2px 7px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.3)';
          wrap.appendChild(tag);
        }
        wrap.addEventListener('click', (ev) => { ev.stopPropagation(); clickRef.current.onCarClick?.(car.id); });
        const marker = new gl.Marker({ element: wrap, anchor: 'center' }).setLngLat([car.lng, car.lat]).addTo(map);
        const h = car.heading ?? 0;
        st = { marker, el: wrap, rot, pos: target, from: target, to: target, t0: 0, heading: h, headingFrom: h, headingTo: h };
        rot.style.transform = `rotate(${h}deg)`;
        carsRef.current.set(car.id, st);
      } else if (haversine(st.to, target) > 0.5 || (car.heading != null && Math.abs(car.heading - st.headingTo) > 2)) {
        const moved = haversine(st.pos, target);
        const derived = moved > 6 ? bearing(st.pos, target) : st.headingTo;
        st.from = st.pos;
        st.to = target;
        st.headingFrom = st.heading;
        st.headingTo = car.heading ?? derived;
        st.t0 = performance.now();
        if (!raf.current) raf.current = requestAnimationFrame(animate);
      }
      st.el.style.opacity = car.stale ? '0.55' : '1';
      st.el.style.filter = car.stale ? 'grayscale(0.8)' : 'none';
    }
    carsRef.current.forEach((st, id) => {
      if (!seen.has(id)) { st.marker.remove(); carsRef.current.delete(id); }
    });

    // accuracy halo for the first car
    const acc = showAccuracy && cars[0]?.accuracy && cars[0].accuracy > 12 ? cars[0] : null;
    const circleFeatures = [
      ...circles.map((c) => ({ type: 'Feature', properties: { color: c.color }, geometry: { type: 'Polygon', coordinates: [circlePolygon(c, c.radius_m)] } })),
      ...(acc ? [{ type: 'Feature', properties: { color: '#3b82f6' }, geometry: { type: 'Polygon', coordinates: [circlePolygon(acc, acc.accuracy as number)] } }] : []),
    ];
    map.getSource('circles')?.setData({ type: 'FeatureCollection', features: circleFeatures });
  }, [cars, circles, ready, showAccuracy, animate]);

  // ── sync pins ──
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.id);
      let m = pinsRef.current.get(p.id);
      if (!m) {
        const node = document.createElement('div');
        if (p.kind === 'customer') {
          node.innerHTML = `<div style="position:relative;width:22px;height:22px">
            <span style="position:absolute;inset:-9px;border-radius:999px;background:rgba(37,99,235,.22);animation:trkpulse 2s ease-out infinite"></span>
            <span style="position:absolute;inset:0;border-radius:999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span></div>`;
        } else if (p.kind === 'point') {
          node.innerHTML = `<div style="width:14px;height:14px;border-radius:999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`;
        } else {
          const color = p.kind === 'pickup' ? '#16a34a' : '#0f172a';
          const letter = p.kind === 'pickup' ? 'A' : 'B';
          node.innerHTML = `<svg width="34" height="44" viewBox="0 0 34 44" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
            <path d="M17 1C8.2 1 1 8 1 16.7 1 28.5 17 43 17 43s16-14.5 16-26.3C33 8 25.8 1 17 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
            <text x="17" y="21.5" font-size="14" font-family="Arial" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
        }
        if (p.label) node.title = p.label;
        m = new gl.Marker({ element: node, anchor: p.kind === 'pickup' || p.kind === 'dropoff' ? 'bottom' : 'center' })
          .setLngLat([p.lng, p.lat]).addTo(map);
        pinsRef.current.set(p.id, m);
      } else {
        m.setLngLat([p.lng, p.lat]);
      }
    }
    pinsRef.current.forEach((m, id) => {
      if (!seen.has(id)) { m.remove(); pinsRef.current.delete(id); }
    });
  }, [pins, ready]);

  // ── route line (Mapbox Directions, traffic-aware; throttled) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const src = map.getSource('route');
    if (!route) {
      src?.setData({ type: 'FeatureCollection', features: [] });
      routeFetch.current = { at: 0, from: null, to: null };
      return;
    }
    const prev = routeFetch.current;
    const targetChanged = !prev.to || haversine(prev.to, route.to) > 30;
    const movedFar = !prev.from || haversine(prev.from, route.from) > 150;
    const old = Date.now() - prev.at > 60_000;
    if (!targetChanged && !(movedFar && old) && !(Date.now() - prev.at > 180_000)) return;
    routeFetch.current = { at: Date.now(), from: route.from, to: route.to };
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${route.from.lng},${route.from.lat};${route.to.lng},${route.to.lat}`
      + `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    fetch(url).then((r) => r.json()).then((d) => {
      const g = d?.routes?.[0]?.geometry;
      if (g && mapRef.current) mapRef.current.getSource('route')?.setData({ type: 'Feature', properties: {}, geometry: g });
    }).catch(() => {});
  }, [route, ready]);

  // ── fit on key change / follow ──
  useEffect(() => {
    if (!ready) return;
    if (lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      fit(true);
    } else {
      fit(false);
    }
  }, [ready, fitKey, cars, pins, route, fit]);

  if (!MAPBOX_TOKEN || failed) {
    return (
      <div className={className} style={{ ...style, background: theme === 'dark' ? '#111827' : '#e5e7eb' }}>
        <div className="w-full h-full flex items-center justify-center text-sm opacity-60">Karte nicht verfügbar</div>
      </div>
    );
  }

  return (
    // The caller positions/sizes the outer box (often `absolute inset-0`); the inner box is
    // the positioning context for the map canvas and the recenter button.
    <div className={className} style={style}>
      <style>{`@keyframes trkpulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.8);opacity:0}}
        .mapboxgl-ctrl-attrib{font-size:10px}`}</style>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {userMoved && (
        <button
          type="button"
          onClick={recenter}
          className={`absolute right-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}
          style={controlsTop ? { top: 44 } : { bottom: (padding?.bottom ?? 60) - 44 > 12 ? (padding?.bottom ?? 60) - 44 : 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          {recenterLabel}
        </button>
      )}
      </div>
    </div>
  );
}
