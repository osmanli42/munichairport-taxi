'use client';

import { useEffect, useRef, useState } from 'react';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const MAPBOX_VERSION = 'v3.9.0';

type Coords = { lat: number; lng: number };

interface RouteMapProps {
  pickup: string;
  dropoff: string;
  waypoint?: string;
  pickupCoords?: Coords | null;
  dropoffCoords?: Coords | null;
}

// Load Mapbox GL JS + CSS from CDN once (mirrors the existing Leaflet loader pattern).
function loadMapbox(): Promise<any> {
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
    const script = document.createElement('script');
    script.id = 'mapboxgl-js';
    script.src = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;
    script.onload = () => resolve((window as any).mapboxgl);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function resolveCoords(address: string, preset?: Coords | null): Promise<Coords | null> {
  if (preset && Number.isFinite(preset.lat) && Number.isFinite(preset.lng)) return preset;
  if (!address) return null;
  try {
    const res = await fetch(`${API_URL}/maps/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Number.isFinite(data?.lat) && Number.isFinite(data?.lng)) return { lat: data.lat, lng: data.lng };
    return null;
  } catch {
    return null;
  }
}

// Inline Mapbox route map for the booking summary. Renders nothing (falls back to the
// external link that lives beside it) when no token is configured or the route can't be built.
export default function RouteMap({ pickup, dropoff, waypoint, pickupCoords, dropoffCoords }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const [pCoords, dCoords, wCoords] = await Promise.all([
        resolveCoords(pickup, pickupCoords),
        resolveCoords(dropoff, dropoffCoords),
        waypoint ? resolveCoords(waypoint) : Promise.resolve(null),
      ]);
      if (cancelled || !pCoords || !dCoords) return;

      let mapboxgl: any;
      try {
        mapboxgl = await loadMapbox();
      } catch {
        return;
      }
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;
      const orderedStops: Coords[] = wCoords ? [pCoords, wCoords, dCoords] : [pCoords, dCoords];

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [pCoords.lng, pCoords.lat],
        zoom: 8,
        cooperativeGestures: true,
        attributionControl: false,
      });
      mapRef.current = map;
      setVisible(true);

      map.on('load', async () => {
        // Markers: green = pickup, blue = waypoint, red = dropoff
        new mapboxgl.Marker({ color: '#16a34a' }).setLngLat([pCoords.lng, pCoords.lat]).addTo(map);
        if (wCoords) new mapboxgl.Marker({ color: '#2563eb' }).setLngLat([wCoords.lng, wCoords.lat]).addTo(map);
        new mapboxgl.Marker({ color: '#dc2626' }).setLngLat([dCoords.lng, dCoords.lat]).addTo(map);

        // Driving route via Mapbox Directions API
        let routeGeometry: any = null;
        try {
          const coordStr = orderedStops.map(c => `${c.lng},${c.lat}`).join(';');
          const dirRes = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
          );
          const dirData = await dirRes.json();
          routeGeometry = dirData?.routes?.[0]?.geometry || null;
        } catch { /* no route line — markers + fitBounds still useful */ }

        if (cancelled) return;

        if (routeGeometry) {
          map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: routeGeometry } });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#1a365d', 'line-width': 4, 'line-opacity': 0.85 },
          });
        }

        // Frame the whole route/stops
        const bounds = new mapboxgl.LngLatBounds();
        const framePoints = routeGeometry?.coordinates?.length ? routeGeometry.coordinates : orderedStops.map(c => [c.lng, c.lat]);
        framePoints.forEach((c: [number, number]) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 14 });
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pickup, dropoff, waypoint, pickupCoords, dropoffCoords]);

  if (!MAPBOX_TOKEN) return null;

  return (
    <div
      ref={containerRef}
      className="mt-3 rounded-xl overflow-hidden border border-gray-200"
      style={{ height: 200, display: visible ? 'block' : 'none' }}
    />
  );
}
