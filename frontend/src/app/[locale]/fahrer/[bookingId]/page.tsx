'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { trackingApi } from '@/lib/api';

type Lang = 'de' | 'en' | 'tr';

const T: Record<string, Record<Lang, string>> = {
  title:    { de: 'Standort teilen', en: 'Share location', tr: 'Konum paylaş' },
  intro:    { de: 'Tippen Sie auf START, damit der Kunde Sie auf der Karte sehen kann.', en: 'Tap START so the customer can see you on the map.', tr: 'Müşterinin sizi haritada görmesi için BAŞLAT\'a dokunun.' },
  start:    { de: 'START', en: 'START', tr: 'BAŞLAT' },
  sharing:  { de: 'Konum aktarılıyor', en: 'Sharing location', tr: 'Konum paylaşılıyor' },
  arrived:  { de: 'Angekommen ✓', en: 'Arrived ✓', tr: 'Varıldı ✓' },
  denied:   { de: 'Standortzugriff abgelehnt. Bitte erlauben und erneut versuchen.', en: 'Location access denied. Please allow and try again.', tr: 'Konum izni reddedildi. Lütfen izin verip tekrar deneyin.' },
  retry:    { de: 'Erneut versuchen', en: 'Try again', tr: 'Tekrar dene' },
  pickup:   { de: 'Abholung', en: 'Pickup', tr: 'Alış noktası' },
  distance: { de: 'Entfernung', en: 'Distance', tr: 'Mesafe' },
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function zoomForDistance(meters: number): number {
  if (meters > 5000) return 12;
  if (meters > 2000) return 13;
  if (meters > 1000) return 14;
  if (meters > 500)  return 15;
  if (meters > 200)  return 16;
  if (meters > 100)  return 17;
  if (meters > 50)   return 18;
  return 19;
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css'; css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export default function FahrerPage() {
  const params = useParams();
  const search = useSearchParams();
  const locale = (useLocale() as Lang) || 'de';
  const bookingId = params.bookingId as string;
  const token = search.get('t') || '';

  const [sharing, setSharing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [distanceM, setDistanceM] = useState<number | null>(null);

  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const pickupMarker = useRef<any>(null);
  const customerMarker = useRef<any>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const L = useRef<any>(null);

  const tr = (k: string) => T[k]?.[locale] ?? T[k]?.de ?? k;

  const stop = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (wakeLock.current) { wakeLock.current.release?.(); wakeLock.current = null; }
  };

  useEffect(() => () => stop(), []);

  // Init map once we have pickup coords
  useEffect(() => {
    if (!pickup || mapRef.current || !mapEl.current) return;
    let cancelled = false;
    loadLeaflet().then((Lib) => {
      if (cancelled || mapRef.current || !mapEl.current) return;
      L.current = Lib;
      const map = Lib.map(mapEl.current, { zoomControl: false })
        .setView([pickup.lat, pickup.lng], 14);
      Lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 20,
      }).addTo(map);
      Lib.control.zoom({ position: 'bottomright' }).addTo(map);
      const pickupIcon = Lib.divIcon({
        html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">📍</div>',
        className: '', iconSize: [28, 28], iconAnchor: [14, 28],
      });
      pickupMarker.current = Lib.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
        .bindPopup(`<b>${tr('pickup')}</b><br>${pickupAddress}`)
        .addTo(map);
      mapRef.current = map;
    });
    return () => { cancelled = true; };
  }, [pickup]);

  const start = async () => {
    setDenied(false);
    if (!('geolocation' in navigator)) { setDenied(true); return; }
    try { wakeLock.current = await (navigator as any).wakeLock?.request('screen'); } catch {}

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setSharing(true);
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await trackingApi.postLocation(bookingId, lat, lng, token);
          if (r.driver_status === 'arrived') setArrived(true);

          // Store info (independent of each other)
          if (r.customer_name && !customerName) setCustomerName(r.customer_name);
          if (r.pickup_address && !pickupAddress) setPickupAddress(r.pickup_address);
          if (r.dropoff_address && !dropoffAddress) setDropoffAddress(r.dropoff_address);
          if (r.pickup && !pickup) setPickup(r.pickup);

          // Update distance to pickup
          if (r.pickup) {
            const d = haversineMeters(lat, lng, r.pickup.lat, r.pickup.lng);
            setDistanceM(d);

            const Lib = L.current;
            if (Lib && mapRef.current) {
              // Driver marker (taxi)
              const carIcon = Lib.divIcon({
                html: '<div style="font-size:30px;line-height:1;filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))">🚕</div>',
                className: '', iconSize: [30, 30], iconAnchor: [15, 15],
              });
              if (!driverMarker.current) {
                driverMarker.current = Lib.marker([lat, lng], { icon: carIcon }).addTo(mapRef.current);
              } else {
                driverMarker.current.setLatLng([lat, lng]);
              }

              // Customer marker (blue person) if location available
              if (r.customer_location) {
                const custIcon = Lib.divIcon({
                  html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">🔵</div>',
                  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
                });
                if (!customerMarker.current) {
                  customerMarker.current = Lib.marker([r.customer_location.lat, r.customer_location.lng], { icon: custIcon, zIndexOffset: 500 })
                    .bindPopup('Kunde')
                    .addTo(mapRef.current);
                } else {
                  customerMarker.current.setLatLng([r.customer_location.lat, r.customer_location.lng]);
                }
              }

              // Zoom: if we have customer location, include it in bounds too
              const allPoints: [number, number][] = [[lat, lng], [r.pickup.lat, r.pickup.lng]];
              if (r.customer_location) allPoints.push([r.customer_location.lat, r.customer_location.lng]);

              const zoom = zoomForDistance(d);
              if (d < 300) {
                mapRef.current.setView(
                  [(lat + r.pickup.lat) / 2, (lng + r.pickup.lng) / 2],
                  zoom, { animate: true }
                );
              } else {
                const bounds = Lib.latLngBounds(allPoints);
                mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: zoom, animate: true });
              }
            }
          }
        } catch { /* keep trying */ }
      },
      () => { setDenied(true); setSharing(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  };

  const distanceLabel = distanceM != null
    ? distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Map — shown once sharing starts and pickup known */}
      {sharing && pickup && (
        <div className="relative w-full" style={{ height: '55vh', minHeight: 260 }}>
          <div ref={mapEl} className="w-full h-full" />
          {/* Distance badge */}
          {distanceLabel && !arrived && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full px-4 py-1.5 shadow text-sm font-bold text-gray-800 pointer-events-none">
              📍 {distanceLabel}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-1">{tr('title')}</h1>
        <p className="text-sm text-gray-400 mb-6">#{bookingId}</p>

        {!sharing && !denied && (
          <>
            <p className="text-lg text-gray-300 mb-10 max-w-xs">{tr('intro')}</p>
            <button
              onClick={start}
              className="bg-green-500 hover:bg-green-600 active:scale-95 transition text-white text-4xl font-extrabold rounded-full w-52 h-52 shadow-2xl"
            >
              {tr('start')}
            </button>
          </>
        )}

        {sharing && (
          <div className="flex flex-col items-center gap-3 mt-4">
            {arrived ? (
              <div className="flex items-center gap-2 text-green-400">
                <span className="text-lg font-semibold">🏁 {tr('arrived')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400">
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse inline-block" />
                <span className="text-lg font-semibold">{tr('sharing')}</span>
              </div>
            )}
            {customerName && (
              <div className="text-2xl font-bold text-white">👤 {customerName}</div>
            )}
            {pickupAddress && (
              <div className="bg-gray-800 rounded-xl px-4 py-2 text-sm text-gray-300 max-w-xs text-center">
                <span className="text-gray-500 text-xs block mb-0.5">{tr('pickup')}</span>
                {pickupAddress}
              </div>
            )}
          </div>
        )}

        {denied && (
          <div className="flex flex-col items-center gap-6">
            <p className="text-lg text-red-300 max-w-xs">{tr('denied')}</p>
            <button onClick={start} className="bg-white text-gray-900 text-xl font-bold rounded-xl px-10 py-4">
              {tr('retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
