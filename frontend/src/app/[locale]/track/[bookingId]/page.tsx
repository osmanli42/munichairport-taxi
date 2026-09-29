'use client';

// Customer tracking page (/track/:bn?t=…): where the driver is, when they arrive, where to
// meet at the airport, who to call. Polls every 5 s while the ride is live; the car glides
// between updates (TrackingMap), and a stale signal is said out loud instead of showing a
// frozen car next to a "Live" badge.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Phone, MessageCircle, MapPin, Plane, Navigation2, Check, Clock, Users, Signpost, LocateFixed, X } from 'lucide-react';
import TrackingMap, { MapCar, MapPin as MapPinT } from '@/components/tracking/TrackingMap';
import {
  customerTracking, CustomerView, Lang, ApiError, pickupParts, berlinClock, arrivalClock, telLink, waLink, initials,
} from '@/lib/tracking';

type K =
  | 'scheduled' | 'assigned' | 'enroute' | 'arrived' | 'onboard' | 'completed'
  | 'scheduled_sub' | 'assigned_sub' | 'enroute_sub' | 'arrived_sub' | 'onboard_sub' | 'completed_sub'
  | 'min' | 'step_assigned' | 'step_enroute' | 'step_arrived' | 'step_onboard' | 'live' | 'stale'
  | 'your_driver' | 'call' | 'meeting' | 'sign' | 'flight' | 'landing' | 'landed' | 'delay' | 'on_time'
  | 'share_title' | 'share_text' | 'share_btn' | 'sharing' | 'stop' | 'share_denied' | 'pickup' | 'dropoff'
  | 'help' | 'too_early' | 'too_early_sub' | 'expired' | 'cancelled' | 'disabled' | 'invalid' | 'loading'
  | 'recenter' | 'passengers' | 'eta_label' | 'waiting_label';

const T: Record<K, [string, string, string]> = {
  scheduled: ['Ihre Fahrt ist geplant', 'Your ride is scheduled', 'Yolculuğunuz planlandı'],
  assigned: ['Fahrer zugewiesen', 'Driver assigned', 'Şoför atandı'],
  enroute: ['Ihr Fahrer ist unterwegs', 'Your driver is on the way', 'Şoförünüz yolda'],
  arrived: ['Ihr Fahrer ist da', 'Your driver has arrived', 'Şoförünüz geldi'],
  onboard: ['Unterwegs zum Ziel', 'On the way to your destination', 'Varış noktasına gidiliyor'],
  completed: ['Fahrt beendet', 'Ride completed', 'Yolculuk tamamlandı'],
  scheduled_sub: ['Abholung am {date} um {time}. Sobald Ihr Fahrer losfährt, sehen Sie ihn hier live.', 'Pickup on {date} at {time}. As soon as your driver sets off, you can follow them here live.', 'Alış {date} saat {time}. Şoförünüz yola çıkınca onu burada canlı görebilirsiniz.'],
  assigned_sub: ['{driver} holt Sie am {date} um {time} ab.', '{driver} will pick you up on {date} at {time}.', '{driver} sizi {date} saat {time} alacak.'],
  enroute_sub: ['Ankunft ca. {clock} Uhr', 'Arriving around {clock}', 'Tahmini varış {clock}'],
  arrived_sub: ['wartet seit {clock} Uhr', 'waiting since {clock}', '{clock} saatinden beri bekliyor'],
  onboard_sub: ['Ankunft am Ziel ca. {clock} Uhr', 'Arrival at destination around {clock}', 'Varış noktasına tahmini {clock}'],
  completed_sub: ['Vielen Dank, dass Sie mit uns gefahren sind!', 'Thank you for riding with us!', 'Bizi tercih ettiğiniz için teşekkürler!'],
  min: ['Min.', 'min', 'dk'],
  step_assigned: ['Zugewiesen', 'Assigned', 'Atandı'],
  step_enroute: ['Unterwegs', 'On the way', 'Yolda'],
  step_arrived: ['Angekommen', 'Arrived', 'Vardı'],
  step_onboard: ['An Bord', 'On board', 'Araçta'],
  live: ['Live', 'Live', 'Canlı'],
  stale: ['Letztes Signal vor {n} Min.', 'Last signal {n} min ago', 'Son sinyal {n} dk önce'],
  your_driver: ['Ihr Fahrer', 'Your driver', 'Şoförünüz'],
  call: ['Anrufen', 'Call', 'Ara'],
  meeting: ['Treffpunkt', 'Meeting point', 'Buluşma noktası'],
  sign: ['Namensschild', 'Name sign', 'İsim tabelası'],
  flight: ['Flug', 'Flight', 'Uçuş'],
  landing: ['Landung erwartet', 'Expected landing', 'Tahmini iniş'],
  landed: ['Gelandet', 'Landed', 'İndi'],
  delay: ['Verspätung', 'delay', 'rötar'],
  on_time: ['pünktlich', 'on time', 'zamanında'],
  share_title: ['Standort teilen', 'Share your location', 'Konumunuzu paylaşın'],
  share_text: ['Damit Ihr Fahrer Sie schneller findet. Nur bis zum Einsteigen – jederzeit beendbar.', 'Helps your driver find you faster. Only until pickup – stop any time.', 'Şoförünüz sizi daha hızlı bulsun. Sadece binene kadar – istediğiniz zaman durdurabilirsiniz.'],
  share_btn: ['Meinen Standort teilen', 'Share my location', 'Konumumu paylaş'],
  sharing: ['Ihr Standort wird mit dem Fahrer geteilt', 'Your location is shared with the driver', 'Konumunuz şoförle paylaşılıyor'],
  stop: ['Beenden', 'Stop', 'Durdur'],
  share_denied: ['Standortzugriff wurde verweigert.', 'Location access was denied.', 'Konum izni reddedildi.'],
  pickup: ['Abholung', 'Pickup', 'Alış'],
  dropoff: ['Ziel', 'Destination', 'Varış'],
  help: ['Fragen zu Ihrer Fahrt?', 'Questions about your ride?', 'Yolculuğunuzla ilgili sorunuz mu var?'],
  too_early: ['Live-Verfolgung noch nicht aktiv', 'Live tracking not active yet', 'Canlı takip henüz aktif değil'],
  too_early_sub: ['Am Tag Ihrer Fahrt sehen Sie Ihren Fahrer hier live. Abholung: {date}, {time} Uhr.', 'On the day of your ride you can follow your driver here. Pickup: {date}, {time}.', 'Yolculuk gününüzde şoförünüzü burada canlı görebilirsiniz. Alış: {date}, {time}.'],
  expired: ['Dieser Link ist abgelaufen', 'This link has expired', 'Bu linkin süresi doldu'],
  cancelled: ['Diese Fahrt wurde storniert', 'This ride was cancelled', 'Bu yolculuk iptal edildi'],
  disabled: ['Live-Tracking ist derzeit nicht verfügbar', 'Live tracking is currently unavailable', 'Canlı takip şu an kullanılamıyor'],
  invalid: ['Link ungültig oder Buchung nicht gefunden', 'Invalid link or booking not found', 'Geçersiz link veya rezervasyon bulunamadı'],
  loading: ['Lädt…', 'Loading…', 'Yükleniyor…'],
  recenter: ['Zentrieren', 'Recenter', 'Ortala'],
  passengers: ['Pers.', 'pax', 'kişi'],
  eta_label: ['bis zur Ankunft', 'until arrival', 'varışa kadar'],
  waiting_label: ['Wartezeit', 'Waiting', 'Bekleme'],
};
const IDX: Record<Lang, number> = { de: 0, en: 1, tr: 2 };

function Plate({ plate }: { plate: string }) {
  return (
    <span className="inline-flex items-stretch rounded-[4px] border-2 border-gray-900 bg-white overflow-hidden font-mono text-[13px] font-bold tracking-wider text-gray-900 leading-none">
      <span className="bg-blue-700 text-white text-[9px] px-1 flex items-end pb-[3px]">D</span>
      <span className="px-1.5 py-[3px]">{plate}</span>
    </span>
  );
}

export default function TrackPage() {
  const params = useParams();
  const search = useSearchParams();
  const locale = (useLocale() as Lang) || 'de';
  const bn = params.bookingId as string;
  const token = search.get('t') || '';
  const lang: Lang = ['de', 'en', 'tr'].includes(locale) ? locale : 'de';
  const t = useCallback((k: K, vars: Record<string, string | number> = {}) =>
    T[k][IDX[lang]].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? '')), [lang]);

  const [data, setData] = useState<CustomerView | null>(null);
  const [error, setError] = useState(false);
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [sharing, setSharing] = useState(false);
  const [shareDenied, setShareDenied] = useState(false);
  const watchId = useRef<number | null>(null);
  const shareKey = `fmt_trk_share_${bn}`;

  const live = ['enroute', 'arrived', 'onboard'].includes(data?.status || '');

  const poll = useCallback(async () => {
    try {
      const d = await customerTracking.get(bn, token);
      setData(d);
      setReceivedAt(Date.now());
      setError(false);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) setError(true);
    }
  }, [bn, token]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, live ? 5_000 : 30_000);
    return () => clearInterval(id);
  }, [poll, live]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── customer location (opt-in) ──
  const stopSharing = useCallback(async (notify = true) => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
    try { localStorage.removeItem(shareKey); } catch { /* ignore */ }
    if (notify) customerTracking.stopSharing(bn, token).catch(() => {});
  }, [bn, token, shareKey]);

  const startSharing = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setShareDenied(false);
    let last = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setSharing(true);
        try { localStorage.setItem(shareKey, '1'); } catch { /* ignore */ }
        if (Date.now() - last < 8_000) return;
        last = Date.now();
        customerTracking.shareLocation(bn, token, {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy), heading: null, speed: null, timestamp: pos.timestamp,
        }).catch(() => {});
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) { setShareDenied(true); stopSharing(false); }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );
  }, [bn, token, shareKey, stopSharing]);

  useEffect(() => {
    let resume = false;
    try { resume = localStorage.getItem(shareKey) === '1'; } catch { /* ignore */ }
    if (resume && data?.share_location_enabled && watchId.current == null) startSharing();
    if (data && !data.share_location_enabled && watchId.current != null) stopSharing(false);
  }, [data?.share_location_enabled, shareKey, startSharing, stopSharing, data]);

  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  // ── map data ──
  const cars: MapCar[] = useMemo(() => {
    const d = data?.driver_location;
    return d && live ? [{ id: 'driver', lat: d.lat, lng: d.lng, heading: d.heading, stale: !!data?.stale }] : [];
  }, [data?.driver_location?.lat, data?.driver_location?.lng, data?.driver_location?.heading, data?.stale, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const pins: MapPinT[] = useMemo(() => {
    const p: MapPinT[] = [];
    if (!data) return p;
    if (data.pickup && data.status !== 'onboard' && data.status !== 'completed') p.push({ id: 'A', kind: 'pickup', ...data.pickup });
    if (data.dropoff && (data.status === 'onboard' || data.status === 'completed' || !data.driver_location)) p.push({ id: 'B', kind: 'dropoff', ...data.dropoff });
    if (data.customer_location) p.push({ id: 'me', kind: 'customer', lat: data.customer_location.lat, lng: data.customer_location.lng });
    return p;
  }, [data]);

  const routeTarget = data?.status === 'onboard' ? data?.dropoff : data?.status === 'enroute' ? data?.pickup : null;
  const route = data?.driver_location && routeTarget && live ? { from: data.driver_location, to: routeTarget } : null;

  // ── states ──
  if (error) return <CenterMessage icon="🔍" title={t('invalid')} />;
  if (!data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" aria-label={t('loading')} />
      </div>
    );
  }
  const { date, time } = pickupParts(data.pickup_datetime);
  if (data.phase === 'too_early') return <CenterMessage icon="🗓️" title={t('too_early')} text={t('too_early_sub', { date, time })} company={data.company} help={t('help')} />;
  if (data.phase === 'expired') return <CenterMessage icon="⌛" title={t('expired')} company={data.company} help={t('help')} />;
  if (data.phase === 'cancelled') return <CenterMessage icon="✖️" title={t('cancelled')} company={data.company} help={t('help')} />;
  if (data.phase === 'disabled') return <CenterMessage icon="📡" title={t('disabled')} company={data.company} help={t('help')} />;

  const status = data.status || 'scheduled';
  // ETA keeps counting down between polls.
  const eta = data.eta_minutes != null ? Math.max(1, Math.round(data.eta_minutes - (now - receivedAt) / 60_000)) : null;
  const staleMin = data.stale && data.driver_location ? Math.max(1, Math.round(data.driver_location.age_s / 60)) : null;
  const driverName = data.driver?.name || '';
  const subtitle =
    status === 'scheduled' ? t('scheduled_sub', { date, time })
    : status === 'assigned' ? t('assigned_sub', { driver: driverName || t('your_driver'), date, time })
    : status === 'enroute' ? (eta != null ? t('enroute_sub', { clock: arrivalClock(eta) }) : '')
    : status === 'arrived' ? t('arrived_sub', { clock: berlinClock(data.timeline?.arrived) })
    : status === 'onboard' ? (eta != null ? t('onboard_sub', { clock: arrivalClock(eta) }) : '')
    : t('completed_sub');
  const waitingMin = status === 'arrived' && data.timeline?.arrived ? Math.max(0, Math.floor((now / 1000 - data.timeline.arrived) / 60)) : null;

  const steps: { key: K; ts: number | null | undefined; reached: boolean }[] = [
    { key: 'step_assigned', ts: null, reached: status !== 'scheduled' },
    { key: 'step_enroute', ts: data.timeline?.enroute, reached: ['enroute', 'arrived', 'onboard', 'completed'].includes(status) },
    { key: 'step_arrived', ts: data.timeline?.arrived, reached: ['arrived', 'onboard', 'completed'].includes(status) },
    { key: 'step_onboard', ts: data.timeline?.onboard, reached: ['onboard', 'completed'].includes(status) },
  ];
  const mp = data.meeting_point;
  const flight = data.flight?.live;
  const accent = status === 'arrived' ? 'text-emerald-600' : status === 'completed' ? 'text-gray-700' : 'text-[#1a365d]';
  const hasMap = !!(data.pickup || data.driver_location);

  return (
    <div className="min-h-[100dvh] bg-gray-100 flex flex-col">
      {/* Map */}
      {hasMap && (
        <div className="relative w-full" style={{ height: live ? '56vh' : '38vh', minHeight: 260 }}>
          <TrackingMap
            className="absolute inset-0"
            cars={cars}
            pins={pins}
            route={route}
            fitKey={status}
            padding={{ top: 70, bottom: 60, left: 45, right: 45 }}
            recenterLabel={t('recenter')}
          />
          <div className="absolute top-0 inset-x-0 p-3 flex items-center justify-between pointer-events-none" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
            <div className="rounded-full bg-white/95 shadow px-3 py-1.5 text-xs font-semibold text-[#1a365d] backdrop-blur">
              flughafen-muenchen.<span className="text-amber-500">TAXI</span>
              <span className="text-gray-400 font-mono ml-1.5">#{data.booking_number}</span>
            </div>
            {live && (staleMin ? (
              <div className="rounded-full bg-amber-500 text-white shadow px-3 py-1.5 text-xs font-semibold">{t('stale', { n: staleMin })}</div>
            ) : (
              <div className="rounded-full bg-emerald-500 text-white shadow px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {t('live')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sheet */}
      <div className={`flex-1 bg-gray-100 ${hasMap ? '-mt-5 rounded-t-[28px] relative z-10 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]' : ''}`}>
        <div className="max-w-xl mx-auto px-4 pt-3 pb-10 space-y-3">
          {hasMap && <div className="mx-auto w-10 h-1.5 rounded-full bg-gray-300 mb-1" />}

          {/* Status */}
          <section className="rounded-3xl bg-white shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <h1 className={`text-[22px] font-extrabold leading-tight ${accent}`}>{t(status as K)}</h1>
                {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
              </div>
              {(status === 'enroute' || status === 'onboard') && eta != null && (
                <div className="text-right shrink-0">
                  <div className="text-4xl font-black tabular-nums text-gray-900 leading-none">{eta}</div>
                  <div className="text-xs font-semibold text-gray-500 mt-1">{t('min')}</div>
                </div>
              )}
              {status === 'arrived' && waitingMin != null && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400">{t('waiting_label')}</div>
                  <div className="text-2xl font-black tabular-nums text-emerald-600 leading-none mt-0.5">{waitingMin} <span className="text-sm">{t('min')}</span></div>
                </div>
              )}
              {status === 'completed' && <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Check size={24} /></div>}
            </div>

            {status !== 'completed' && (
              <div className="mt-5">
                <div className="flex items-center">
                  {steps.map((s, i) => (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                      <div className={`w-3.5 h-3.5 rounded-full shrink-0 ring-4 ${s.reached ? 'bg-[#1a365d] ring-[#1a365d]/15' : 'bg-gray-200 ring-transparent'}`} />
                      {i < steps.length - 1 && <div className={`h-1 flex-1 mx-1 rounded-full ${steps[i + 1].reached ? 'bg-[#1a365d]' : 'bg-gray-200'}`} />}
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-4 text-[11px] text-gray-500">
                  {steps.map((s, i) => (
                    <div key={s.key} className={i === 0 ? 'text-left' : i === steps.length - 1 ? 'text-right' : 'text-center'}>
                      <div className={s.reached ? 'text-gray-800 font-semibold' : ''}>{t(s.key)}</div>
                      {s.ts ? <div className="tabular-nums">{berlinClock(s.ts)}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Meeting point + flight (airport) */}
          {mp && status !== 'onboard' && status !== 'completed' && (
            <section className="rounded-3xl bg-amber-50 border border-amber-200/70 p-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm"><MapPin size={16} /> {t('meeting')}: {mp.label[lang]}</div>
              <p className="mt-1 text-sm text-amber-900/80 leading-relaxed">{mp.text[lang]}</p>
              {mp.sign_name && (
                <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-white border border-amber-200 px-3 py-1.5 text-sm">
                  <Signpost size={15} className="text-amber-600" />
                  <span className="text-gray-500">{t('sign')}:</span> <span className="font-bold text-gray-900">{mp.sign_name}</span>
                </div>
              )}
              {data.flight && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-900 flex-wrap">
                  <Plane size={15} />
                  <span className="font-semibold">{data.flight.number}</span>
                  {flight ? (
                    <>
                      <span>· {flight.actual ? t('landed') : t('landing')} <b className="tabular-nums">{flight.actual || flight.expected || flight.scheduled}</b></span>
                      {flight.delay_minutes != null && flight.delay_minutes >= 5 && <span className="text-amber-700">(+{flight.delay_minutes} {t('min')})</span>}
                      {flight.terminal && <span className="rounded bg-white border border-amber-200 px-1.5 text-xs font-bold">T{flight.terminal}</span>}
                    </>
                  ) : data.flight.info ? <span className="text-amber-900/70">· {data.flight.info}</span> : null}
                </div>
              )}
            </section>
          )}

          {/* Driver */}
          {data.driver && (
            <section className="rounded-3xl bg-white shadow-sm p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('your_driver')}</div>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2c5282] text-white flex items-center justify-center text-lg font-bold shadow-inner">
                  {initials(driverName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-gray-900 truncate">{driverName}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-sm text-gray-500">
                    {data.driver.vehicle_model && <span>{data.driver.vehicle_model}</span>}
                    {data.driver.vehicle_plate && <Plate plate={data.driver.vehicle_plate} />}
                  </div>
                </div>
              </div>
              {data.driver.phone && status !== 'completed' && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a href={telLink(data.driver.phone)} className="flex items-center justify-center gap-2 rounded-2xl bg-[#1a365d] text-white py-3 text-sm font-semibold active:opacity-90"><Phone size={16} /> {t('call')}</a>
                  <a href={waLink(data.driver.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-white py-3 text-sm font-semibold active:opacity-90"><MessageCircle size={16} /> WhatsApp</a>
                </div>
              )}
            </section>
          )}

          {/* Share location */}
          {data.share_location_enabled && (live || status === 'assigned') && (
            <section className="rounded-3xl bg-white shadow-sm p-4">
              {sharing ? (
                <div className="flex items-center gap-3">
                  <span className="relative flex w-3 h-3"><span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" /><span className="relative inline-flex rounded-full w-3 h-3 bg-blue-600" /></span>
                  <div className="flex-1 text-sm text-gray-700">{t('sharing')}</div>
                  <button onClick={() => stopSharing(true)} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 flex items-center gap-1"><X size={13} /> {t('stop')}</button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><LocateFixed size={20} /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{t('share_title')}</div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t('share_text')}</p>
                    {shareDenied && <p className="text-xs text-rose-600 mt-1">{t('share_denied')}</p>}
                    <button onClick={startSharing} className="mt-2.5 rounded-xl bg-blue-600 text-white px-3.5 py-2 text-sm font-semibold active:bg-blue-700">{t('share_btn')}</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Route */}
          <section className="rounded-3xl bg-white shadow-sm p-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">A</span>
                <span className="flex-1 w-0.5 bg-gray-200 my-1 min-h-[18px]" />
                <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center">B</span>
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    {t('pickup')} <span className="normal-case tracking-normal font-normal flex items-center gap-1"><Clock size={11} /> {date}, {time}</span>
                  </div>
                  <div className="text-sm text-gray-800 font-medium leading-snug">{data.pickup_address}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t('dropoff')}</div>
                  <div className="text-sm text-gray-800 font-medium leading-snug">{data.dropoff_address}</div>
                </div>
              </div>
              <div className="shrink-0 text-xs text-gray-400 flex items-start gap-1 pt-0.5"><Users size={12} /> {data.passengers}</div>
            </div>
          </section>

          {/* Help */}
          <section className="rounded-3xl bg-[#1a365d] text-white p-4 flex items-center gap-3">
            <Navigation2 size={18} className="text-amber-300 shrink-0" />
            <div className="flex-1 text-sm">{t('help')}</div>
            <a href={telLink(data.company.phone)} className="rounded-xl bg-white/10 p-2.5" aria-label="Phone"><Phone size={16} /></a>
            <a href={`https://wa.me/${data.company.whatsapp}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#25D366] p-2.5" aria-label="WhatsApp"><MessageCircle size={16} /></a>
          </section>
        </div>
      </div>
    </div>
  );
}

function CenterMessage({ icon, title, text, company, help }: { icon: string; title: string; text?: string; company?: { phone: string; whatsapp: string }; help?: string }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {text && <p className="mt-2 text-gray-500 text-sm leading-relaxed">{text}</p>}
        {company && (
          <div className="mt-8 rounded-2xl bg-white shadow-sm p-4 text-sm text-gray-600">
            <div>{help}</div>
            <div className="mt-2 flex justify-center gap-2">
              <a href={telLink(company.phone)} className="rounded-xl bg-[#1a365d] text-white px-3 py-2 font-semibold flex items-center gap-1.5"><Phone size={14} /> +49 151 41620000</a>
              <a href={`https://wa.me/${company.whatsapp}`} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-[#25D366] text-white px-3 py-2 font-semibold flex items-center gap-1.5"><MessageCircle size={14} /> WhatsApp</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
