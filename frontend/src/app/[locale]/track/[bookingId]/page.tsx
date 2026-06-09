'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { trackingApi, TrackingData } from '@/lib/api';

type Lang = 'de' | 'en' | 'tr';

const T: Record<string, Record<Lang, string>> = {
  title:     { de: 'Ihre Fahrt', en: 'Your ride', tr: 'Yolculuğunuz' },
  assigned:  { de: 'Fahrer zugewiesen', en: 'Driver assigned', tr: 'Şoför atandı' },
  enroute:   { de: 'Fahrer ist unterwegs', en: 'Driver on the way', tr: 'Şoför yolda' },
  arrived:   { de: 'Fahrer ist da! 🎉', en: 'Driver arrived! 🎉', tr: 'Şoför geldi! 🎉' },
  completed: { de: 'Fahrt abgeschlossen', en: 'Ride completed', tr: 'Yolculuk tamamlandı' },
  waiting:   { de: 'Warte auf Fahrer…', en: 'Waiting for driver…', tr: 'Şoför bekleniyor…' },
  eta:       { de: 'Ankunft in ca.', en: 'Arriving in approx.', tr: 'Yaklaşık varış' },
  min:       { de: 'Min.', en: 'min', tr: 'dk' },
  driver:    { de: 'Ihr Fahrer', en: 'Your driver', tr: 'Şoförünüz' },
  pickup:    { de: 'Abholung', en: 'Pickup', tr: 'Alış' },
  dropoff:   { de: 'Ziel', en: 'Destination', tr: 'Varış noktası' },
  call:      { de: 'Anrufen', en: 'Call', tr: 'Ara' },
  notfound:  { de: 'Buchung nicht gefunden oder Link ungültig.', en: 'Booking not found or invalid link.', tr: 'Rezervasyon bulunamadı veya bağlantı geçersiz.' },
  loading:   { de: 'Lädt…', en: 'Loading…', tr: 'Yükleniyor…' },
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
      css.id = 'leaflet-css';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; bar: string }> = {
  assigned:  { color: 'text-blue-700',    bg: 'bg-blue-50',    bar: 'bg-blue-500' },
  enroute:   { color: 'text-green-700',   bg: 'bg-green-50',   bar: 'bg-green-500' },
  arrived:   { color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  completed: { color: 'text-gray-600',    bg: 'bg-gray-50',    bar: 'bg-gray-400' },
};

const STEPS = ['assigned', 'enroute', 'arrived'] as const;

export default function TrackPage() {
  const params = useParams();
  const search = useSearchParams();
  const locale = (useLocale() as Lang) || 'de';
  const bookingId = params.bookingId as string;
  const token = search.get('t') || '';

  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const mapRef = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const pickupMarker = useRef<any>(null);
  const customerMarker = useRef<any>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const L = useRef<any>(null);
  const custWatchId = useRef<number | null>(null);

  const tr = (k: string) => T[k]?.[locale] ?? T[k]?.de ?? k;

  const poll = useCallback(async () => {
    try {
      const d = await trackingApi.get(bookingId, token);
      setData(d);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoaded(true);
    }
  }, [bookingId, token]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  // Share customer's own GPS silently (no UI needed — just sends to backend)
  useEffect(() => {
    if (!token || !bookingId) return;
    if (!('geolocation' in navigator)) return;
    custWatchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await trackingApi.postCustomerLocation(bookingId, pos.coords.latitude, pos.coords.longitude, token);
        } catch { /* silent */ }
      },
      () => { /* permission denied — no problem, feature is optional */ },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
    return () => {
      if (custWatchId.current != null) navigator.geolocation.clearWatch(custWatchId.current);
    };
  }, [bookingId, token]);

  useEffect(() => {
    if (!data?.pickup || mapRef.current || !mapEl.current) return;
    let cancelled = false;
    loadLeaflet().then((Lib) => {
      if (cancelled || mapRef.current || !mapEl.current) return;
      L.current = Lib;
      const map = Lib.map(mapEl.current, { zoomControl: false }).setView([data.pickup!.lat, data.pickup!.lng], 14);
      Lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 20,
      }).addTo(map);
      Lib.control.zoom({ position: 'bottomright' }).addTo(map);
      const pickupIcon = Lib.divIcon({
        html: '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">📍</div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
      pickupMarker.current = Lib.marker([data.pickup!.lat, data.pickup!.lng], { icon: pickupIcon })
        .bindPopup(`<b>${tr('pickup')}</b><br>${data.pickup_address || ''}`)
        .addTo(map);
      mapRef.current = map;
    });
    return () => { cancelled = true; };
  }, [data?.pickup]);

  useEffect(() => {
    const Lib = L.current;
    if (!Lib || !mapRef.current) return;
    const driverLoc = data?.driver_location;
    const custLoc = data?.customer_location;
    const pickup = data?.pickup;

    // Update driver marker
    if (driverLoc) {
      const carIcon = Lib.divIcon({
        html: '<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))">🚕</div>',
        className: '', iconSize: [32, 32], iconAnchor: [16, 16],
      });
      if (!driverMarker.current) {
        driverMarker.current = Lib.marker([driverLoc.lat, driverLoc.lng], { icon: carIcon }).addTo(mapRef.current);
      } else {
        driverMarker.current.setLatLng([driverLoc.lat, driverLoc.lng]);
      }
    }

    // Update customer marker
    if (custLoc) {
      const custIcon = Lib.divIcon({
        html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">🔵</div>',
        className: '', iconSize: [26, 26], iconAnchor: [13, 13],
      });
      if (!customerMarker.current) {
        customerMarker.current = Lib.marker([custLoc.lat, custLoc.lng], { icon: custIcon, zIndexOffset: 500 })
          .bindPopup('Sie sind hier')
          .addTo(mapRef.current);
      } else {
        customerMarker.current.setLatLng([custLoc.lat, custLoc.lng]);
      }
    }

    // Fit bounds to show ALL available points: driver, customer, pickup
    const points: [number, number][] = [];
    if (driverLoc) points.push([driverLoc.lat, driverLoc.lng]);
    if (custLoc)   points.push([custLoc.lat, custLoc.lng]);
    if (pickup)    points.push([pickup.lat, pickup.lng]);

    if (points.length === 0) return;

    if (points.length === 1) {
      mapRef.current.setView(points[0], 15, { animate: true });
      return;
    }

    // Use driver↔pickup distance for zoom level (if both available)
    const refDist = driverLoc && pickup
      ? haversineMeters(driverLoc.lat, driverLoc.lng, pickup.lat, pickup.lng)
      : driverLoc && custLoc
      ? haversineMeters(driverLoc.lat, driverLoc.lng, custLoc.lat, custLoc.lng)
      : 1000;

    const zoom = zoomForDistance(refDist);
    const bounds = Lib.latLngBounds(points);
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: zoom, animate: true });

  }, [data?.driver_location, data?.customer_location, data?.pickup]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">{tr('loading')}</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center text-gray-500 max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg">{tr('notfound')}</p>
        </div>
      </div>
    );
  }

  const status = data.driver_status || 'assigned';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.assigned;
  const activeIdx = STEPS.indexOf(status as any);
  const hasLoc = !!data.driver_location;
  const isArrived = status === 'arrived' || status === 'completed';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Map — full width, tall */}
      <div className="relative w-full" style={{ height: '55vh', minHeight: 280 }}>
        <div ref={mapEl} className="w-full h-full" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="bg-white/90 backdrop-blur rounded-full px-3 py-1 shadow text-xs font-mono text-gray-600">
            #{bookingId}
          </div>
          {hasLoc && !isArrived && (
            <div className="bg-green-500 text-white rounded-full px-3 py-1 shadow text-xs font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
              Live
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 -mt-4 rounded-t-3xl bg-gray-100 overflow-hidden">
        <div className="max-w-xl mx-auto px-4 pt-5 pb-8 space-y-4">

          {/* Status + ETA */}
          <div className={`rounded-2xl p-4 ${cfg.bg} shadow-sm`}>
            <div className={`text-xl font-bold mb-3 ${cfg.color}`}>{tr(status)}</div>
            <div className="flex items-center gap-1 mb-2">
              {STEPS.map((s, i) => (
                <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${i <= activeIdx ? cfg.bar : 'bg-gray-200'}`} />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mb-3">
              <span>{tr('assigned')}</span>
              <span>{tr('enroute')}</span>
              <span>{tr('arrived')}</span>
            </div>
            {!isArrived && (
              <div className="mt-1">
                {hasLoc && data.eta_minutes != null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-gray-900">{data.eta_minutes}</span>
                    <span className="text-xl font-semibold text-gray-500">{tr('min')}</span>
                    <span className="text-sm text-gray-400">{tr('eta')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    {tr('waiting')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Driver card */}
          {data.driver && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{tr('driver')}</div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-3xl shadow-inner shrink-0">
                  🧑‍✈️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-gray-900 truncate">{data.driver.name}</div>
                  {(data.driver.vehicle_model || data.driver.vehicle_plate) && (
                    <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      {data.driver.vehicle_model && <span>{data.driver.vehicle_model}</span>}
                      {data.driver.vehicle_plate && (
                        <span className="bg-gray-100 rounded px-1.5 py-0.5 font-mono text-xs border border-gray-200">{data.driver.vehicle_plate}</span>
                      )}
                    </div>
                  )}
                </div>
                {data.driver.phone && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <a href={`tel:${data.driver.phone}`}
                      className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl px-4 py-2 text-center transition-colors">
                      📞 {tr('call')}
                    </a>
                    <a href={`https://wa.me/${data.driver.phone.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="bg-[#25D366] hover:bg-[#1ebe57] text-white text-sm font-semibold rounded-xl px-4 py-2 text-center transition-colors">
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Route */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-green-600 text-xs font-bold">A</span>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{tr('pickup')}</div>
                <div className="text-gray-800 font-medium leading-snug">{data.pickup_address}</div>
              </div>
            </div>
            <div className="ml-3.5 border-l-2 border-dashed border-gray-200 h-4" />
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 text-xs font-bold">B</span>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{tr('dropoff')}</div>
                <div className="text-gray-800 font-medium leading-snug">{data.dropoff_address}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
