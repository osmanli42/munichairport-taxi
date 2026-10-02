'use client';

// Personal driver app: /fahrer?d=<token>. Installed once to the home screen (the token is
// remembered, so the icon opens straight into the ride list), shows the driver's rides
// and opens the live ride screen.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { RefreshCw, Plane, Users, Luggage, Baby, ChevronRight, X, Wallet, CreditCard, CheckCircle2, Building2, PawPrint } from 'lucide-react';
import RideScreen from '@/components/tracking/RideScreen';
import { driverT, statusKey } from '@/components/tracking/driverI18n';
import {
  driverAppApi, DriverProfile, DriverRide, Lang, ApiError, pickupParts, berlinTodayYmd, formatEuro,
} from '@/lib/tracking';

const LIVE = ['enroute', 'arrived', 'onboard'];
const TOKEN_KEY = 'fmt_driver_token';
const LANG_KEY = 'fmt_driver_lang';
const INSTALL_KEY = 'fmt_driver_install_hint';

function readLS(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function writeLS(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
}

const CHIP: Record<string, string> = {
  assigned: 'bg-gray-800 text-gray-300',
  enroute: 'bg-emerald-500/20 text-emerald-300',
  arrived: 'bg-sky-500/20 text-sky-300',
  onboard: 'bg-amber-400/20 text-amber-300',
  completed: 'bg-gray-800 text-gray-500',
};

// useSearchParams needs a Suspense boundary on statically rendered routes.
export default function DriverAppPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-gray-950" />}>
      <DriverApp />
    </Suspense>
  );
}

function DriverApp() {
  const search = useSearchParams();
  const routeLocale = (useLocale() as Lang) || 'de';
  const [token, setToken] = useState<string>('');
  const [lang, setLang] = useState<Lang>(routeLocale);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [error, setError] = useState<'invalid' | 'inactive' | 'network' | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [openBn, setOpenBn] = useState<string | null>(null);
  const [detail, setDetail] = useState<DriverRide | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const autoOpened = useRef(false);
  const t = useMemo(() => driverT(lang), [lang]);

  // Token from the link, else the one remembered from the first visit (home-screen icon).
  useEffect(() => {
    const fromUrl = search.get('d');
    const tk = fromUrl || readLS(TOKEN_KEY) || '';
    if (fromUrl) writeLS(TOKEN_KEY, fromUrl);
    setToken(tk);
    const savedLang = readLS(LANG_KEY) as Lang | null;
    if (savedLang && ['de', 'en', 'tr'].includes(savedLang)) setLang(savedLang);
    const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone);
    setShowInstall(!standalone && readLS(INSTALL_KEY) !== 'hidden');
    if (typeof window !== 'undefined' && window.location.hash.length > 1) setOpenBn(decodeURIComponent(window.location.hash.slice(1)));
    if (!tk) { setError('invalid'); setLoaded(true); }
  }, [search]);

  const api = useMemo(() => (token ? driverAppApi(token) : null), [token]);

  const loadList = useCallback(async () => {
    if (!api) return;
    try {
      const r = await api.me();
      setDriver(r.driver);
      setRides(r.rides);
      setTrackingEnabled(r.tracking_enabled);
      setError(null);
      if (!readLS(LANG_KEY) && ['de', 'en', 'tr'].includes(r.driver.language)) setLang(r.driver.language as Lang);
      if (!autoOpened.current) {
        autoOpened.current = true;
        const running = r.rides.find((x) => LIVE.includes(x.status));
        if (running && !window.location.hash) setOpenBn(running.booking_number);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError('invalid');
      else if (e instanceof ApiError && e.status === 403) setError('inactive');
      else setError((prev) => prev ?? 'network');
    } finally {
      setLoaded(true);
    }
  }, [api]);

  const loadDetail = useCallback(async (bn: string) => {
    if (!api) return;
    try {
      const r = await api.ride(bn);
      setDetail(r.ride);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { setOpenBn(null); setDetail(null); }
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    loadList();
    const id = setInterval(loadList, 30_000);
    return () => clearInterval(id);
  }, [api, loadList]);

  // Ride detail refresh: fast while the ride is live (status can advance automatically).
  useEffect(() => {
    if (!openBn || !api) { setDetail(null); return; }
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${encodeURIComponent(openBn)}`);
    loadDetail(openBn);
    const liveNow = LIVE.includes(detail?.status || '');
    const id = setInterval(() => loadDetail(openBn), liveNow ? 8_000 : 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBn, api, loadDetail, detail?.status]);

  const closeRide = () => {
    setOpenBn(null);
    setDetail(null);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search);
    loadList();
  };

  const changeLang = (l: Lang) => { setLang(l); writeLS(LANG_KEY, l); };

  const langSwitch = (
    <select
      value={lang}
      onChange={(e) => changeLang(e.target.value as Lang)}
      className="bg-gray-800 text-gray-200 text-xs font-semibold rounded-lg px-1.5 py-1.5 border border-white/10"
      aria-label="Sprache"
    >
      <option value="de">DE</option>
      <option value="tr">TR</option>
      <option value="en">EN</option>
    </select>
  );

  // ── error / loading ──
  if (!loaded) {
    return <div className="min-h-[100dvh] bg-gray-950 text-gray-400 flex items-center justify-center text-sm">{t('loading')}</div>;
  }
  if (error === 'invalid' || error === 'inactive') {
    return (
      <div className="min-h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-300 text-2xl">!</div>
        <p className="text-lg max-w-xs">{error === 'invalid' ? t('invalid_link') : t('inactive')}</p>
        <a href="tel:+4915141620000" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold">📞 +49 151 41620000</a>
      </div>
    );
  }

  // ── ride screen ──
  if (openBn && detail && api) {
    const traccar = driver?.traccar ? { lastFixAgeS: driver.traccar.last_fix_age_s } : null;
    return (
      <RideScreen
        ride={detail}
        lang={lang}
        t={t}
        traccar={traccar}
        onBack={closeRide}
        headerRight={langSwitch}
        onSetStatus={async (status) => {
          const r = await api.setStatus(detail.booking_number, status);
          setDetail(r.ride);
        }}
        sendFix={async (fix) => {
          const r = await api.postFix(fix);
          if (r.status && r.active_booking_number === detail.booking_number && r.status !== detail.status) loadDetail(detail.booking_number);
          return r;
        }}
      />
    );
  }

  // ── list ──
  const today = berlinTodayYmd(0);
  const tomorrow = berlinTodayYmd(1);
  const active = rides.filter((r) => r.status !== 'completed');
  const done = rides.filter((r) => r.status === 'completed');
  const groups = new Map<string, DriverRide[]>();
  for (const r of active) {
    const ymd = pickupParts(r.pickup_datetime).ymd;
    groups.set(ymd, [...(groups.get(ymd) || []), r]);
  }
  const groupLabel = (ymd: string) => {
    if (ymd === today) return t('today');
    if (ymd === tomorrow) return t('tomorrow');
    const d = new Date(`${ymd}T12:00:00Z`);
    return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(d);
  };
  const running = rides.find((r) => LIVE.includes(r.status));

  const payBadge = (r: DriverRide) => {
    const k = r.payment.kind;
    if (k === 'collect_cash') return <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 text-amber-200 px-1.5 py-0.5"><Wallet size={12} /> {formatEuro(r.payment.amount)}</span>;
    if (k === 'collect_card') return <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 text-sky-200 px-1.5 py-0.5"><CreditCard size={12} /> {formatEuro(r.payment.amount)}</span>;
    if (k === 'paid_card' || k === 'paid_transfer') return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-200 px-1.5 py-0.5"><CheckCircle2 size={12} /></span>;
    return <span className="inline-flex items-center gap-1 rounded-md bg-white/5 text-gray-300 px-1.5 py-0.5"><Building2 size={12} /></span>;
  };

  const RideCard = ({ r }: { r: DriverRide }) => {
    const { time } = pickupParts(r.pickup_datetime);
    return (
      <button
        onClick={() => setOpenBn(r.booking_number)}
        className={`w-full text-left rounded-2xl border p-3.5 flex gap-3 items-stretch active:scale-[0.99] transition ${LIVE.includes(r.status) ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-gray-900 border-white/5'}`}
      >
        <div className="w-[76px] shrink-0 text-center">
          <div className="text-xl font-extrabold tabular-nums leading-tight">{time}</div>
          <span className={`mt-1 inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold ${CHIP[r.status]}`}>{t(statusKey(r.status))}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{r.customer_name}</div>
          <div className="text-xs text-gray-400 truncate mt-0.5"><span className="text-emerald-400 font-bold">A</span> {r.pickup_address}</div>
          <div className="text-xs text-gray-400 truncate"><span className="text-gray-200 font-bold">B</span> {r.dropoff_address}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {r.flight_number && <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 text-sky-200 px-1.5 py-0.5"><Plane size={12} /> {r.flight_number}</span>}
            <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5"><Users size={12} /> {r.passengers}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5"><Luggage size={12} /> {r.luggage_count}</span>
            {r.child_seat && <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 text-amber-200 px-1.5 py-0.5"><Baby size={12} /></span>}
            {r.notes?.includes('🐾') && <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 text-amber-200 px-1.5 py-0.5"><PawPrint size={12} /></span>}
            {payBadge(r)}
          </div>
        </div>
        <ChevronRight size={18} className="self-center text-gray-600 shrink-0" />
      </button>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="w-9 h-9 rounded-xl bg-amber-400 text-gray-900 flex items-center justify-center font-black text-xs">TAXI</div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-gray-400">{t('app_title')}</div>
          <div className="font-bold truncate">{t('hello')}, {driver?.name}</div>
        </div>
        <button
          onClick={async () => { setRefreshing(true); await loadList(); setRefreshing(false); }}
          className="p-2 rounded-full active:bg-white/10"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
        {langSwitch}
      </header>

      <main className="px-3 py-3 space-y-4 max-w-xl mx-auto" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        {error === 'network' && <div className="rounded-xl bg-amber-400/10 text-amber-200 text-sm px-3 py-2">{t('offline')}</div>}
        {!trackingEnabled && <div className="rounded-xl bg-white/5 text-gray-300 text-sm px-3 py-2">{t('tracking_off')}</div>}

        {showInstall && (
          <div className="rounded-2xl bg-sky-500/10 border border-sky-500/20 p-3.5 text-sm relative">
            <button onClick={() => { setShowInstall(false); writeLS(INSTALL_KEY, 'hidden'); }} className="absolute top-2.5 right-2.5 text-sky-300/70" aria-label={t('dismiss')}><X size={16} /></button>
            <div className="font-semibold text-sky-200 mb-1">📲 {t('install_title')}</div>
            <div className="text-xs text-sky-100/80">{t('install_ios')}</div>
            <div className="text-xs text-sky-100/80">{t('install_android')}</div>
          </div>
        )}

        {running && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 px-1 mb-2">● {t('running')}</h2>
            <RideCard r={running} />
          </section>
        )}

        {active.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🚕</div>
            <div className="font-semibold">{t('no_rides')}</div>
            <div className="text-sm text-gray-500 mt-1">{t('no_rides_hint')}</div>
          </div>
        )}

        {Array.from(groups.entries()).map(([ymd, list]: [string, DriverRide[]]) => {
          const rest = list.filter((r) => r !== running);
          if (!rest.length) return null;
          return (
            <section key={ymd}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1 mb-2">{groupLabel(ymd)}</h2>
              <div className="space-y-2">{rest.map((r) => <RideCard key={r.booking_number} r={r} />)}</div>
            </section>
          );
        })}

        {done.length > 0 && (
          <section className="opacity-70">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1 mb-2">{t('done_rides')}</h2>
            <div className="space-y-2">{done.map((r) => <RideCard key={r.booking_number} r={r} />)}</div>
          </section>
        )}
      </main>
    </div>
  );
}
