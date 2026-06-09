'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { trackingApi, TrackingData } from '@/lib/api';

type Lang = 'de' | 'en' | 'tr';

const T: Record<string, Record<Lang, string>> = {
  title: { de: 'Ihre Fahrt verfolgen', en: 'Track your ride', tr: 'Yolculuğunuzu takip edin' },
  assigned: { de: 'Fahrer zugewiesen', en: 'Driver assigned', tr: 'Şoför atandı' },
  enroute: { de: 'Fahrer ist unterwegs', en: 'Driver on the way', tr: 'Şoför yolda' },
  arrived: { de: 'Fahrer ist da', en: 'Driver has arrived', tr: 'Şoför geldi' },
  completed: { de: 'Fahrt abgeschlossen', en: 'Ride completed', tr: 'Yolculuk tamamlandı' },
  waiting: { de: 'Warte auf Fahrerstandort…', en: 'Waiting for driver location…', tr: 'Şoför konumu bekleniyor…' },
  eta: { de: 'Ankunft in', en: 'Arrival in', tr: 'Varış' },
  min: { de: 'Min.', en: 'min', tr: 'dk' },
  driver: { de: 'Fahrer', en: 'Driver', tr: 'Şoför' },
  vehicle: { de: 'Fahrzeug', en: 'Vehicle', tr: 'Araç' },
  pickup: { de: 'Abholung', en: 'Pickup', tr: 'Alış' },
  dropoff: { de: 'Ziel', en: 'Destination', tr: 'Varış noktası' },
  call: { de: 'Anrufen', en: 'Call', tr: 'Ara' },
  notfound: { de: 'Buchung nicht gefunden oder Link ungültig.', en: 'Booking not found or invalid link.', tr: 'Rezervasyon bulunamadı veya bağlantı geçersiz.' },
  loading: { de: 'Lädt…', en: 'Loading…', tr: 'Yükleniyor…' },
};

const STEPS: Array<{ key: 'assigned' | 'enroute' | 'arrived' }> = [
  { key: 'assigned' }, { key: 'enroute' }, { key: 'arrived' },
];

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
  const mapEl = useRef<HTMLDivElement>(null);
  const L = useRef<any>(null);

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
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [poll]);

  // Init map once we have a pickup coordinate
  useEffect(() => {
    if (!data?.pickup || mapRef.current || !mapEl.current) return;
    let cancelled = false;
    loadLeaflet().then((Lib) => {
      if (cancelled || mapRef.current || !mapEl.current) return;
      L.current = Lib;
      const map = Lib.map(mapEl.current).setView([data.pickup!.lat, data.pickup!.lng], 13);
      Lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      pickupMarker.current = Lib.marker([data.pickup!.lat, data.pickup!.lng]).addTo(map);
      mapRef.current = map;
    });
    return () => { cancelled = true; };
  }, [data?.pickup]);

  // Update driver marker on each poll
  useEffect(() => {
    const Lib = L.current;
    if (!Lib || !mapRef.current) return;
    const loc = data?.driver_location;
    if (!loc) return;
    const carIcon = Lib.divIcon({
      html: '<div style="font-size:28px;line-height:1">🚕</div>',
      className: 'driver-car-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    if (!driverMarker.current) {
      driverMarker.current = Lib.marker([loc.lat, loc.lng], { icon: carIcon }).addTo(mapRef.current);
    } else {
      driverMarker.current.setLatLng([loc.lat, loc.lng]);
    }
    // Fit both pickup and driver in view
    if (data?.pickup) {
      const bounds = Lib.latLngBounds([[loc.lat, loc.lng], [data.pickup.lat, data.pickup.lng]]);
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }
  }, [data?.driver_location, data?.pickup]);

  if (loaded && (error || !data)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-gray-600">
        {tr('notfound')}
      </div>
    );
  }

  const status = data?.driver_status || 'assigned';
  const activeIdx = STEPS.findIndex((s) => s.key === status);
  const hasLoc = !!data?.driver_location;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{tr('title')}</h1>
        <p className="text-sm text-gray-500 mb-4">#{bookingId}</p>

        {/* Status banner */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="text-lg font-semibold text-gray-900 mb-3">{tr(status)}</div>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex-1 flex items-center gap-2">
                <div className={`h-2 flex-1 rounded-full ${i <= activeIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{tr('assigned')}</span>
            <span>{tr('enroute')}</span>
            <span>{tr('arrived')}</span>
          </div>
          {status !== 'arrived' && (
            <div className="mt-3 text-sm">
              {hasLoc && data?.eta_minutes != null ? (
                <span className="font-semibold text-green-700">{tr('eta')} {data.eta_minutes} {tr('min')}</span>
              ) : (
                <span className="text-amber-600">{tr('waiting')}</span>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div ref={mapEl} style={{ height: 360, width: '100%' }} />
        </div>

        {/* Driver + trip info */}
        {data?.driver && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-gray-400">{tr('driver')}</div>
                <div className="font-semibold text-gray-900">{data.driver.name}</div>
                {(data.driver.vehicle_model || data.driver.vehicle_plate) && (
                  <div className="text-sm text-gray-500">
                    {data.driver.vehicle_model} {data.driver.vehicle_plate && `· ${data.driver.vehicle_plate}`}
                  </div>
                )}
              </div>
              {data.driver.phone && (
                <a href={`tel:${data.driver.phone}`} className="bg-green-500 text-white px-4 py-2 rounded-lg font-medium">
                  {tr('call')}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-4 text-sm space-y-2">
          <div>
            <div className="text-xs uppercase text-gray-400">{tr('pickup')}</div>
            <div className="text-gray-800">{data?.pickup_address}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-400">{tr('dropoff')}</div>
            <div className="text-gray-800">{data?.dropoff_address}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
