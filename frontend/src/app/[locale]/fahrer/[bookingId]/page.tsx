'use client';

// Single-ride driver link (/fahrer/:bn?t=…) — for drivers who don't use the personal app.
// Same ride screen as the app, authorised by the per-booking token.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import RideScreen from '@/components/tracking/RideScreen';
import { driverT } from '@/components/tracking/driverI18n';
import { singleRideApi, DriverRide, Lang, Phase, ApiError } from '@/lib/tracking';

const LIVE = ['enroute', 'arrived', 'onboard'];
const LANG_KEY = 'fmt_driver_lang';

export default function SingleRidePage() {
  const params = useParams();
  const search = useSearchParams();
  const routeLocale = (useLocale() as Lang) || 'de';
  const bn = params.bookingId as string;
  const token = search.get('t') || '';
  const [lang, setLang] = useState<Lang>(routeLocale);
  const [ride, setRide] = useState<DriverRide | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [error, setError] = useState<'invalid' | 'network' | null>(null);
  const t = useMemo(() => driverT(lang), [lang]);
  const api = useMemo(() => singleRideApi(bn, token), [bn, token]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as Lang | null;
      if (saved && ['de', 'en', 'tr'].includes(saved)) setLang(saved);
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.get();
      setPhase(r.phase);
      setRide(r.ride);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setError('invalid');
      else setError('network');
    }
  }, [api]);

  useEffect(() => {
    load();
    const id = setInterval(load, LIVE.includes(ride?.status || '') ? 8_000 : 30_000);
    return () => clearInterval(id);
  }, [load, ride?.status]);

  const langSwitch = (
    <select
      value={lang}
      onChange={(e) => { const l = e.target.value as Lang; setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } }}
      className="bg-gray-800 text-gray-200 text-xs font-semibold rounded-lg px-1.5 py-1.5 border border-white/10"
      aria-label="Sprache"
    >
      <option value="de">DE</option>
      <option value="tr">TR</option>
      <option value="en">EN</option>
    </select>
  );

  const message = error === 'invalid' ? t('invalid_link')
    : phase === 'cancelled' ? t('ride_cancelled')
    : phase === 'expired' ? t('link_expired')
    : phase === 'disabled' ? t('tracking_off')
    : null;

  if (message) {
    return (
      <div className="min-h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="text-4xl">🚕</div>
        <p className="text-lg max-w-xs">{message}</p>
      </div>
    );
  }
  if (!ride) {
    return <div className="min-h-[100dvh] bg-gray-950 text-gray-400 flex items-center justify-center text-sm">{t('loading')}</div>;
  }

  return (
    <RideScreen
      ride={ride}
      lang={lang}
      t={t}
      headerRight={langSwitch}
      onSetStatus={async (status) => {
        const r = await api.setStatus(status);
        setRide(r.ride);
      }}
      sendFix={async (fix) => {
        const r = await api.postFix(fix);
        if (r.status && r.status !== ride.status) load();
        return r;
      }}
    />
  );
}
