'use client';

// One ride, as the driver sees it: live map, one big action button that walks the ride
// through its lifecycle, everything needed at the curb (name sign, flight, payment to
// collect, call/WhatsApp) and one-tap navigation. Used by the driver app (/fahrer) and by
// the single-ride link (/fahrer/:bn).

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Navigation, Phone, MessageCircle, Users, Luggage, Baby, Bike, Plane, Signpost,
  Wallet, CreditCard, Building2, CheckCircle2, AlertTriangle, Undo2, Satellite, Clock, MapPin, X,
} from 'lucide-react';
import TrackingMap, { MapCar, MapPin as MapPinT } from './TrackingMap';
import { useGeoSender } from './useGeoSender';
import { DriverKey, statusKey } from './driverI18n';
import {
  DriverRide, GeoFix, Lang, LatLng, ApiError, pickupParts, formatDistance, formatEuro, haversine,
  telLink, waLink, arrivalClock, berlinClock,
} from '@/lib/tracking';

const LIVE = ['enroute', 'arrived', 'onboard'];
const NEXT: Record<string, { to: string; key: DriverKey; color: string } | null> = {
  assigned: { to: 'enroute', key: 'act_start', color: 'bg-emerald-500 active:bg-emerald-600' },
  enroute: { to: 'arrived', key: 'act_arrived', color: 'bg-sky-500 active:bg-sky-600' },
  arrived: { to: 'onboard', key: 'act_onboard', color: 'bg-amber-400 active:bg-amber-500 text-gray-900' },
  onboard: { to: 'completed', key: 'act_finish', color: 'bg-rose-500 active:bg-rose-600' },
  completed: null,
};
const PREV: Record<string, string | null> = { assigned: null, enroute: 'assigned', arrived: 'enroute', onboard: 'arrived', completed: 'onboard' };

const STATUS_CHIP: Record<string, string> = {
  assigned: 'bg-gray-700 text-gray-200',
  enroute: 'bg-emerald-500/20 text-emerald-300',
  arrived: 'bg-sky-500/20 text-sky-300',
  onboard: 'bg-amber-400/20 text-amber-300',
  completed: 'bg-gray-700 text-gray-400',
};

interface Props {
  ride: DriverRide;
  lang: Lang;
  t: (k: DriverKey) => string;
  onSetStatus: (status: string) => Promise<void>;
  sendFix: (fix: GeoFix) => Promise<unknown>;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  traccar?: { lastFixAgeS: number | null } | null;
}

function navUrls(target: LatLng | null, address: string) {
  const dest = target ? `${target.lat},${target.lng}` : encodeURIComponent(address);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
    waze: target ? `https://waze.com/ul?ll=${target.lat},${target.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`,
    apple: `https://maps.apple.com/?daddr=${dest}&dirflg=d`,
  };
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function RideScreen({ ride, lang, t, onSetStatus, sendFix, onBack, headerRight, traccar }: Props) {
  const live = LIVE.includes(ride.status);
  const geo = useGeoSender(live, sendFix);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [navFor, setNavFor] = useState<null | { target: LatLng | null; address: string }>(null);
  const now = useNow(15_000);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const { date, time } = pickupParts(ride.pickup_datetime);
  const target: LatLng | null = ride.status === 'onboard' ? (ride.dropoff || null) : (ride.pickup || null);
  const me: (LatLng & { heading: number | null; accuracy: number | null }) | null = geo.lastFix
    ? { lat: geo.lastFix.lat, lng: geo.lastFix.lng, heading: geo.lastFix.heading, accuracy: geo.lastFix.accuracy }
    : ride.driver_location
      ? { lat: ride.driver_location.lat, lng: ride.driver_location.lng, heading: ride.driver_location.heading, accuracy: ride.driver_location.accuracy }
      : null;
  const distance = me && target ? haversine(me, target) : null;

  async function go(to: string) {
    if (busy) return;
    if (to === 'completed' && !confirmFinish) {
      setConfirmFinish(true);
      confirmTimer.current = setTimeout(() => setConfirmFinish(false), 4000);
      return;
    }
    setConfirmFinish(false);
    setBusy(true);
    setError('');
    try {
      await onSetStatus(to);
      if (navigator.vibrate) navigator.vibrate(40);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      setError(code === 'other_ride_active' ? t('other_active') : code === 'ride_not_active' ? t('too_early') : (e instanceof ApiError && e.data?.error && !/_/.test(e.data.error) ? e.data.error : t('error_generic')));
    } finally {
      setBusy(false);
    }
  }

  const next = NEXT[ride.status];
  const prev = PREV[ride.status];

  const cars: MapCar[] = useMemo(() => (me && live ? [{ id: 'me', lat: me.lat, lng: me.lng, heading: me.heading, accuracy: me.accuracy }] : []), [me?.lat, me?.lng, me?.heading, me?.accuracy, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const pins: MapPinT[] = useMemo(() => {
    const p: MapPinT[] = [];
    if (ride.pickup && ride.status !== 'onboard' && ride.status !== 'completed') p.push({ id: 'A', kind: 'pickup', ...ride.pickup });
    if (ride.dropoff) p.push({ id: 'B', kind: 'dropoff', ...ride.dropoff });
    if (ride.customer_location) p.push({ id: 'C', kind: 'customer', lat: ride.customer_location.lat, lng: ride.customer_location.lng });
    return p;
  }, [ride.pickup?.lat, ride.pickup?.lng, ride.dropoff?.lat, ride.dropoff?.lng, ride.customer_location?.lat, ride.customer_location?.lng, ride.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const waitingMin = ride.status === 'arrived' && ride.timeline.arrived ? Math.max(0, Math.floor((now / 1000 - ride.timeline.arrived) / 60)) : null;
  const payment = ride.payment;
  const payCfg: Record<string, { icon: React.ReactNode; cls: string; key: DriverKey; amount: boolean }> = {
    collect_cash: { icon: <Wallet size={20} />, cls: 'bg-amber-400 text-gray-900', key: 'pay_collect_cash', amount: true },
    collect_card: { icon: <CreditCard size={20} />, cls: 'bg-sky-500 text-white', key: 'pay_collect_card', amount: true },
    paid_card: { icon: <CheckCircle2 size={20} />, cls: 'bg-emerald-600 text-white', key: 'pay_paid_card', amount: false },
    paid_transfer: { icon: <CheckCircle2 size={20} />, cls: 'bg-emerald-600 text-white', key: 'pay_paid_transfer', amount: false },
    transfer_open: { icon: <Building2 size={20} />, cls: 'bg-gray-700 text-white', key: 'pay_transfer_open', amount: false },
    invoice: { icon: <Building2 size={20} />, cls: 'bg-gray-700 text-white', key: 'pay_invoice', amount: false },
  };
  const pay = payCfg[payment.kind] || payCfg.collect_cash;

  const gpsPill = (() => {
    if (!live) return null;
    if (geo.state === 'denied' || geo.state === 'unavailable' || geo.state === 'error') return { cls: 'bg-rose-500/20 text-rose-300', text: t('gps_none') };
    if (geo.state === 'starting' || geo.state === 'idle') return { cls: 'bg-gray-700 text-gray-300', text: t('gps_start') };
    if (geo.state === 'weak') return { cls: 'bg-amber-400/20 text-amber-300', text: `${t('gps_weak')} ±${geo.accuracy ?? '?'} m` };
    return { cls: 'bg-emerald-500/20 text-emerald-300', text: `±${geo.accuracy ?? '?'} m` };
  })();

  const flight = ride.flight_live;
  const signText = ride.pickup_sign || ride.customer_name;

  return (
    <div className="min-h-[100dvh] bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-white/5 px-3 py-2.5 flex items-center gap-2" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        {onBack && (
          <button onClick={onBack} className="p-2 -ml-1 rounded-full active:bg-white/10" aria-label={t('back')}>
            <ArrowLeft size={22} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold leading-tight truncate">{time} · {ride.customer_name}</div>
          <div className="text-[11px] text-gray-400 font-mono">#{ride.booking_number} · {date}</div>
        </div>
        {gpsPill && (
          <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${gpsPill.cls}`}>
            <Satellite size={12} /> {gpsPill.text}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${STATUS_CHIP[ride.status]}`}>{t(statusKey(ride.status))}</span>
        {headerRight}
      </header>

      {/* Map */}
      <div className="relative w-full" style={{ height: live ? '42vh' : '30vh', minHeight: 220 }}>
        <TrackingMap
          theme="dark"
          className="absolute inset-0"
          cars={cars}
          pins={pins}
          route={me && target && live && ride.status !== 'arrived' ? { from: me, to: target } : null}
          follow={live && !!me}
          showAccuracy
          fitKey={ride.status}
          padding={{ top: 50, bottom: 90, left: 40, right: 40 }}
          recenterLabel={t('recenter')}
          controlsTop
        />
        {live && (
          <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-2 pointer-events-none">
            <div className="rounded-2xl bg-gray-900/90 backdrop-blur px-4 py-2.5 shadow-xl">
              {ride.status === 'arrived' ? (
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-sky-300" />
                  <div>
                    <div className="text-[11px] text-gray-400">{t('waiting')}</div>
                    <div className="text-xl font-extrabold tabular-nums">{waitingMin ?? 0} {t('min')}</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-extrabold tabular-nums leading-none">
                    {ride.eta_minutes != null ? `${ride.eta_minutes} ${t('min')}` : '—'}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {distance != null ? `${formatDistance(distance)} · ` : ''}{ride.status === 'onboard' ? t('to_dropoff') : t('to_pickup')}
                    {ride.eta_minutes != null ? ` · ${arrivalClock(ride.eta_minutes)}` : ''}
                  </div>
                </div>
              )}
            </div>
            {gpsPill && (
              <span className={`sm:hidden inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold shadow ${gpsPill.cls} bg-gray-900/90`}>
                <Satellite size={12} /> {gpsPill.text}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <main className="flex-1 px-3 pt-3 pb-40 space-y-3 max-w-xl w-full mx-auto">
        {live && geo.state === 'denied' && (
          <div className="rounded-2xl bg-rose-500/15 border border-rose-500/30 p-3 text-sm text-rose-200 flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">{t('gps_denied')}
              <button onClick={geo.retry} className="mt-2 block rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold">{t('gps_retry')}</button>
            </div>
          </div>
        )}
        {live && geo.wasHidden && geo.state !== 'denied' && (
          <div className="rounded-2xl bg-amber-400/10 border border-amber-400/30 p-3 text-xs text-amber-200 flex gap-2">
            <AlertTriangle size={16} className="shrink-0" /> <span className="flex-1">{t('was_hidden')}</span>
            <button onClick={geo.retry} className="text-amber-100 underline shrink-0">OK</button>
          </div>
        )}
        {live && traccar && (
          <div className={`rounded-2xl p-3 text-xs flex items-center gap-2 ${traccar.lastFixAgeS != null && traccar.lastFixAgeS < 300 ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>
            <Smartphone />
            {traccar.lastFixAgeS != null && traccar.lastFixAgeS < 300 ? t('traccar_active') : t('traccar_quiet')}
          </div>
        )}
        {live && !traccar && geo.state !== 'denied' && (
          <p className="text-[11px] text-gray-500 px-1">{t('keep_open')}</p>
        )}

        {/* Flight */}
        {ride.flight_number && (
          <section className="rounded-2xl bg-gray-900 border border-white/5 p-3.5">
            <div className="flex items-center gap-2 text-sm">
              <Plane size={16} className="text-sky-300" />
              <span className="font-bold">{ride.flight_number}</span>
              {flight?.origin && <span className="text-gray-400 truncate">· {flight.origin}</span>}
              {flight?.terminal && <span className="ml-auto rounded-md bg-sky-500/20 text-sky-200 px-2 py-0.5 text-xs font-bold">T{flight.terminal}</span>}
            </div>
            {flight ? (
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className="text-xs text-gray-400">{flight.actual ? t('landed') : t('landing')}</span>
                <span className="text-2xl font-extrabold tabular-nums">{flight.actual || flight.expected || flight.scheduled || '—'}</span>
                {flight.delay_minutes != null && Math.abs(flight.delay_minutes) >= 5 ? (
                  <span className={`text-xs font-semibold ${flight.delay_minutes > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {flight.delay_minutes > 0 ? `+${flight.delay_minutes} ${t('min')} ${t('delay')}` : `${Math.abs(flight.delay_minutes)} ${t('min')} ${t('early')}`}
                  </span>
                ) : flight.scheduled ? (
                  <span className="text-xs text-emerald-300">{t('on_time')}</span>
                ) : null}
                {flight.scheduled && (flight.expected || flight.actual) && flight.scheduled !== (flight.actual || flight.expected) && (
                  <span className="text-xs text-gray-500">({t('scheduled')} {flight.scheduled})</span>
                )}
              </div>
            ) : ride.flight_info ? (
              <div className="mt-1 text-xs text-gray-400">{ride.flight_info}</div>
            ) : null}
          </section>
        )}

        {/* Passenger */}
        <section className="rounded-2xl bg-gray-900 border border-white/5 p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{t('customer')}</div>
              <div className="text-lg font-bold truncate">{ride.customer_name}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1"><Users size={13} /> {ride.passengers} {t('passengers')}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1"><Luggage size={13} /> {ride.luggage_count} {t('luggage')}</span>
                {ride.child_seat && <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 text-amber-200 px-2 py-1"><Baby size={13} /> {ride.child_seat_details || t('child_seat')}</span>}
                {ride.fahrrad_count > 0 && <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 text-amber-200 px-2 py-1"><Bike size={13} /> {ride.fahrrad_count}× {t('bike')}</span>}
              </div>
            </div>
            <button onClick={() => setSignOpen(true)} className="shrink-0 rounded-xl bg-white text-gray-900 px-3 py-2 text-xs font-bold flex flex-col items-center gap-0.5 active:scale-95 transition">
              <Signpost size={18} />{t('sign')}
            </button>
          </div>
          {ride.customer_phone && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={telLink(ride.customer_phone)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold active:bg-emerald-700"><Phone size={16} /> {t('call')}</a>
              <a href={waLink(ride.customer_phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-gray-900"><MessageCircle size={16} /> WhatsApp</a>
            </div>
          )}
          {ride.notes && (
            <div className="mt-3 rounded-xl bg-amber-400/10 border border-amber-400/20 p-2.5 text-sm text-amber-100">
              <div className="text-[11px] font-semibold text-amber-300 mb-0.5">{t('notes')}</div>
              {ride.notes}
            </div>
          )}
          {ride.customer_location && ride.status !== 'onboard' && (
            <div className="mt-2 text-xs text-sky-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" /> {t('customer_shares')}
            </div>
          )}
        </section>

        {/* Route */}
        <section className="rounded-2xl bg-gray-900 border border-white/5 divide-y divide-white/5">
          {[
            { key: 'A', label: t('pickup'), address: ride.pickup_address, target: ride.pickup || null, extra: ride.meeting_point ? `${t('meeting_point')}: ${ride.meeting_point.label[lang]}` : null, color: 'bg-emerald-600' },
            ...(ride.zwischenstopp_address ? [{ key: '•', label: t('stopover'), address: ride.zwischenstopp_address, target: null, extra: null, color: 'bg-gray-600' }] : []),
            { key: 'B', label: t('dropoff'), address: ride.dropoff_address, target: ride.dropoff || null, extra: null, color: 'bg-gray-100 text-gray-900' },
          ].map((row) => (
            <div key={row.key + row.address} className="flex items-center gap-3 p-3">
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${row.color}`}>{row.key}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-gray-500">{row.label}</div>
                <div className="text-sm leading-snug">{row.address}</div>
                {row.extra && <div className="text-xs text-sky-300 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {row.extra}</div>}
              </div>
              <button
                onClick={() => setNavFor({ target: row.target, address: row.address })}
                className="shrink-0 rounded-xl bg-sky-500/15 text-sky-300 p-2.5 active:bg-sky-500/30"
                aria-label={t('navigate')}
              >
                <Navigation size={18} />
              </button>
            </div>
          ))}
        </section>

        {/* Payment */}
        <section className={`rounded-2xl p-3.5 flex items-center gap-3 ${pay.cls}`}>
          {pay.icon}
          <div className="flex-1 font-bold">{t(pay.key)}</div>
          {pay.amount && <div className="text-xl font-extrabold tabular-nums">{formatEuro(payment.amount)}</div>}
        </section>

        {ride.timeline.enroute && (
          <p className="text-[11px] text-gray-500 px-1">
            {[
              ride.timeline.enroute && `${t('status_enroute')} ${berlinClock(ride.timeline.enroute)}`,
              ride.timeline.arrived && `${t('status_arrived')} ${berlinClock(ride.timeline.arrived)}`,
              ride.timeline.onboard && `${t('status_onboard')} ${berlinClock(ride.timeline.onboard)}`,
              ride.timeline.completed && `${t('status_completed')} ${berlinClock(ride.timeline.completed)}`,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </main>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent pt-6 px-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-xl mx-auto">
          {error && <div className="mb-2 rounded-xl bg-rose-500/20 text-rose-200 text-sm px-3 py-2">{error}</div>}
          {next ? (
            <button
              onClick={() => go(next.to)}
              disabled={busy}
              className={`w-full rounded-2xl py-4 text-lg font-extrabold shadow-2xl transition active:scale-[0.99] disabled:opacity-60 ${confirmFinish ? 'bg-rose-600 ring-4 ring-rose-300/40' : next.color}`}
            >
              {busy ? '…' : confirmFinish ? t('act_finish_confirm') : t(next.key)}
            </button>
          ) : (
            <div className="w-full rounded-2xl py-4 text-center text-lg font-bold bg-gray-800 text-emerald-300 flex items-center justify-center gap-2">
              <CheckCircle2 size={22} /> {t('act_done')}
            </div>
          )}
          {prev && (
            <button onClick={() => go(prev)} disabled={busy} className="mt-1.5 w-full py-1.5 text-xs text-gray-500 flex items-center justify-center gap-1">
              <Undo2 size={13} /> {t('undo')}
            </button>
          )}
        </div>
      </div>

      {/* Navigation chooser */}
      {navFor && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => setNavFor(null)}>
          <div className="w-full bg-gray-900 rounded-t-3xl p-4 space-y-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-sm text-gray-400 px-1 pb-1">{t('choose_nav')}</div>
            {(() => {
              const u = navUrls(navFor.target, navFor.address);
              return [
                { href: u.google, label: 'Google Maps' },
                { href: u.waze, label: 'Waze' },
                { href: u.apple, label: 'Apple Karten / Maps' },
              ].map((o) => (
                <a key={o.label} href={o.href} target="_blank" rel="noopener noreferrer" onClick={() => setNavFor(null)}
                  className="block rounded-2xl bg-white/5 px-4 py-3.5 font-semibold active:bg-white/10">{o.label}</a>
              ));
            })()}
            <button onClick={() => setNavFor(null)} className="w-full rounded-2xl px-4 py-3 text-gray-400">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Name sign */}
      {signOpen && (
        <button
          type="button"
          onClick={() => setSignOpen(false)}
          className="fixed inset-0 z-50 bg-white text-gray-900 flex flex-col items-center justify-center p-6 text-center"
        >
          <X size={28} className="absolute top-5 right-5 text-gray-400" />
          <div className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">flughafen-muenchen.TAXI</div>
          <div className="font-extrabold leading-[1.05] break-words w-full" style={{ fontSize: 'min(16vw, 20vh)' }}>{signText}</div>
          <div className="mt-6 text-xs text-gray-400">{t('sign_hint')}</div>
        </button>
      )}
    </div>
  );
}

function Smartphone() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>;
}
