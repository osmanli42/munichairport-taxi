'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { trackingApi } from '@/lib/api';

type Lang = 'de' | 'en' | 'tr';

const T: Record<string, Record<Lang, string>> = {
  title: { de: 'Standort teilen', en: 'Share location', tr: 'Konum paylaş' },
  intro: { de: 'Tippen Sie auf START, damit der Kunde Sie auf der Karte sehen kann.', en: 'Tap START so the customer can see you on the map.', tr: 'Müşterinin sizi haritada görmesi için BAŞLAT’a dokunun.' },
  start: { de: 'START', en: 'START', tr: 'BAŞLAT' },
  sharing: { de: 'Standort wird geteilt', en: 'Sharing location', tr: 'Konum paylaşılıyor' },
  arrived: { de: 'Sie sind angekommen', en: 'You have arrived', tr: 'Vardınız' },
  denied: { de: 'Standortzugriff wurde abgelehnt. Bitte erlauben und erneut versuchen.', en: 'Location access denied. Please allow and try again.', tr: 'Konum izni reddedildi. Lütfen izin verip tekrar deneyin.' },
  retry: { de: 'Erneut versuchen', en: 'Try again', tr: 'Tekrar dene' },
};

export default function FahrerPage() {
  const params = useParams();
  const search = useSearchParams();
  const locale = (useLocale() as Lang) || 'de';
  const bookingId = params.bookingId as string;
  const token = search.get('t') || '';

  const [sharing, setSharing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState<string>('');
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);

  const tr = (k: string) => T[k]?.[locale] ?? T[k]?.de ?? k;

  const stop = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (wakeLock.current) { wakeLock.current.release?.(); wakeLock.current = null; }
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setDenied(false);
    if (!('geolocation' in navigator)) { setDenied(true); return; }
    try {
      wakeLock.current = await (navigator as any).wakeLock?.request('screen');
    } catch { /* wake lock optional */ }

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setSharing(true);
        try {
          const r = await trackingApi.postLocation(bookingId, pos.coords.latitude, pos.coords.longitude, token);
          setStatus(r.driver_status);
        } catch { /* keep trying on next position */ }
      },
      () => { setDenied(true); setSharing(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  };

  const arrived = status === 'arrived';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-3">{tr('title')}</h1>
      <p className="text-lg text-gray-300 mb-2">#{bookingId}</p>

      {!sharing && !denied && (
        <>
          <p className="text-xl text-gray-200 mb-10 max-w-md">{tr('intro')}</p>
          <button
            onClick={start}
            className="bg-green-500 hover:bg-green-600 active:scale-95 transition text-white text-4xl font-extrabold rounded-full w-56 h-56 shadow-2xl"
          >
            {tr('start')}
          </button>
        </>
      )}

      {sharing && (
        <div className="flex flex-col items-center">
          <div className={`text-7xl mb-6 ${arrived ? '' : 'animate-pulse'}`}>{arrived ? '🏁' : '📍'}</div>
          <div className="text-3xl font-bold mb-2">
            {arrived ? tr('arrived') : tr('sharing')}
          </div>
          {!arrived && <div className="text-green-400 text-5xl">●</div>}
        </div>
      )}

      {denied && (
        <div className="flex flex-col items-center">
          <p className="text-xl text-red-300 mb-8 max-w-md">{tr('denied')}</p>
          <button onClick={start} className="bg-white text-gray-900 text-2xl font-bold rounded-xl px-10 py-5">
            {tr('retry')}
          </button>
        </div>
      )}
    </div>
  );
}
