'use client';

// Admin → Fahrer: live board (all drivers on one map), driver management (personal app
// link, Traccar background GPS) and every tracking setting (switches, accuracy, airport
// meeting points, alert matrix). Everything here takes effect without a deploy.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Radio, Users, Settings, Copy, Check, MessageCircle, RefreshCw, Trash2, Pencil, Plus, Smartphone,
  AlertTriangle, Satellite, Save, Volume2, Mail, MapPin, ExternalLink,
} from 'lucide-react';
import TrackingMap, { MapCar, MapPin as MapPinT, MapCircle } from '@/components/tracking/TrackingMap';
import { ALERT_LABEL, playTrackingTone } from '@/components/tracking/TrackingAlerts';
import {
  adminTracking, AdminDriver, AdminLiveRide, TrackingSettings, ALERT_KINDS, MeetingPointKey, ApiError,
  pickupParts, waLink, berlinClock, L3,
} from '@/lib/tracking';

const STATUS_TR: Record<string, string> = {
  assigned: 'Planlandı', enroute: 'Yolda', arrived: 'Vardı', onboard: 'Yolcu araçta', completed: 'Tamamlandı',
};
const STATUS_CHIP: Record<string, string> = {
  assigned: 'bg-gray-100 text-gray-700', enroute: 'bg-emerald-100 text-emerald-800', arrived: 'bg-sky-100 text-sky-800',
  onboard: 'bg-amber-100 text-amber-800', completed: 'bg-gray-200 text-gray-500',
};
const CAR_COLOR: Record<string, string> = { enroute: '#22c55e', arrived: '#38bdf8', onboard: '#facc15' };

function ago(s: number | null | undefined): string {
  if (s == null) return '—';
  if (s < 60) return `${s} sn önce`;
  if (s < 3600) return `${Math.round(s / 60)} dk önce`;
  if (s < 86400) return `${Math.round(s / 3600)} sa önce`;
  return `${Math.round(s / 86400)} gün önce`;
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${on ? 'bg-green-500' : 'bg-gray-300'}`}
      aria-pressed={on}
    >
      <span className={`absolute left-0 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {})}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-50"
    >
      {ok ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />} {label || 'Kopyala'}
    </button>
  );
}

export default function DriversTab() {
  const [sub, setSub] = useState<'live' | 'drivers' | 'settings'>('live');
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Radio size={20} /></div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900 text-lg">Şoförler & Canlı Takip</h2>
            <p className="text-xs text-gray-500">Şoförler kişisel uygulama linkiyle çalışır; müşteri takip linkinden şoförü canlı görür, yola çıkınca ve varınca otomatik e-posta alır.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {([
            ['live', 'Canlı', Radio],
            ['drivers', 'Şoförler', Users],
            ['settings', 'Ayarlar', Settings],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium ${sub === id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>
      {sub === 'live' && <LiveBoard />}
      {sub === 'drivers' && <DriverManager />}
      {sub === 'settings' && <SettingsPanel />}
    </div>
  );
}

// ─── Live board ─────────────────────────────────────────────────────────────

function LiveBoard() {
  const [rides, setRides] = useState<AdminLiveRide[]>([]);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await adminTracking.live();
      setRides(r.rides);
      setDrivers(r.drivers);
    } catch { /* keep last */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const live = rides.filter((r) => ['enroute', 'arrived', 'onboard'].includes(r.status));
  const upcoming = rides.filter((r) => r.status === 'assigned');
  const done = rides.filter((r) => r.status === 'completed');
  const lost = live.filter((r) => r.gps_lost).length;

  const cars: MapCar[] = useMemo(() => {
    const list: MapCar[] = live.filter((r) => r.driver_location).map((r) => ({
      id: `r${r.id}`, lat: r.driver_location!.lat, lng: r.driver_location!.lng, heading: r.driver_location!.heading,
      stale: r.driver_location!.age_s > 90, color: CAR_COLOR[r.status] || '#facc15', label: r.driver.name,
    }));
    const onRide = new Set(live.map((r) => r.driver.id));
    for (const d of drivers) {
      if (d.last_location && !onRide.has(d.id)) {
        list.push({ id: `d${d.id}`, lat: d.last_location.lat, lng: d.last_location.lng, heading: d.last_location.heading, stale: true, color: '#94a3b8', label: d.name });
      }
    }
    return list;
  }, [live, drivers]);

  const pins: MapPinT[] = useMemo(() => live.filter((r) => r.pickup && r.status !== 'onboard').map((r) => ({ id: `p${r.id}`, kind: 'pickup' as const, ...r.pickup! })), [live]);

  const Row = ({ r }: { r: AdminLiveRide }) => {
    const { date, time } = pickupParts(r.pickup_datetime);
    const isLive = ['enroute', 'arrived', 'onboard'].includes(r.status);
    return (
      <button
        onClick={() => setFocus(r.id)}
        className={`w-full text-left grid grid-cols-[64px_1fr_auto] gap-3 items-center px-3 py-2.5 rounded-xl border ${focus === r.id ? 'border-primary-300 bg-primary-50/50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
      >
        <div className="text-center">
          <div className="font-bold tabular-nums text-gray-900">{time}</div>
          <div className="text-[10px] text-gray-400">{date.slice(0, 5)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{r.customer_name} <span className="font-mono text-[11px] text-gray-400 font-normal">{r.booking_number}</span></div>
          <div className="text-xs text-gray-500 truncate">🚕 {r.driver.name}{r.driver.plate ? ` · ${r.driver.plate}` : ''} · {r.pickup_address}</div>
          {isLive && (
            <div className="text-[11px] mt-0.5 flex items-center gap-2 flex-wrap">
              {r.gps_lost ? <span className="text-rose-600 font-semibold flex items-center gap-1"><AlertTriangle size={11} /> GPS kayıp</span>
                : r.driver_location ? <span className="text-gray-500 flex items-center gap-1"><Satellite size={11} /> {ago(r.driver_location.age_s)}{r.driver_location.accuracy != null ? ` · ±${Math.round(r.driver_location.accuracy)} m` : ''}</span>
                : <span className="text-amber-600">GPS henüz yok</span>}
              {r.timeline.arrived && r.status === 'arrived' && <span className="text-sky-700">{berlinClock(r.timeline.arrived)}'den beri bekliyor</span>}
            </div>
          )}
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CHIP[r.status]}`}>{STATUS_TR[r.status]}</span>
          {r.eta_minutes != null && <div className="text-xs font-semibold text-gray-700 mt-1">{r.eta_minutes} dk {r.eta_target === 'dropoff' ? '→ varış' : '→ alış'}</div>}
        </div>
      </button>
    );
  };

  const focused = rides.find((r) => r.id === focus);
  const fitKey = focused ? `f${focus}` : `all${live.length}`;
  const focusCars = focused ? cars.filter((c) => c.id === `r${focused.id}`) : cars;
  const focusPins = focused ? pins.filter((p) => p.id === `p${focused.id}`) : pins;

  return (
    <div className="grid lg:grid-cols-[1.35fr_1fr] gap-4">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 text-xs">
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-semibold">{live.length} aktif</span>
          {lost > 0 && <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 font-semibold">{lost} GPS kaybı</span>}
          <span className="rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 font-semibold">{upcoming.length} planlı</span>
          {focused && <button onClick={() => setFocus(null)} className="ml-auto text-primary-600 font-semibold">Tümünü göster</button>}
        </div>
        <TrackingMap
          className="w-full"
          style={{ height: 460 }}
          cars={focusCars}
          pins={focusPins}
          fitKey={fitKey}
          padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
          onCarClick={(id) => id.startsWith('r') && setFocus(Number(id.slice(1)))}
          recenterLabel="Ortala"
        />
      </div>
      <div className="space-y-4">
        {!loaded && <div className="text-sm text-gray-400 p-4">Yükleniyor…</div>}
        {loaded && !rides.length && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-sm text-gray-500">
            Bugün/yarın şoför atanmış yolculuk yok. Rezervasyon detayında „Fahrer &amp; Live-Tracking“ bölümünden şoför atayın.
          </div>
        )}
        {live.length > 0 && <Section title="Aktif yolculuklar">{live.map((r) => <Row key={r.id} r={r} />)}</Section>}
        {upcoming.length > 0 && <Section title="Planlı (24 saat)">{upcoming.map((r) => <Row key={r.id} r={r} />)}</Section>}
        {done.length > 0 && <Section title="Tamamlanan">{done.map((r) => <Row key={r.id} r={r} />)}</Section>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 pb-2">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Driver management ──────────────────────────────────────────────────────

const EMPTY = { name: '', phone: '', vehicle_plate: '', vehicle_model: '', language: 'de' };

function appLinkMessage(d: AdminDriver): string {
  if (d.language === 'tr') return `Merhaba ${d.name}, Flughafen München Taxi şoför uygulaman. Linki aç ve ana ekrana ekle:\n${d.app_link}`;
  if (d.language === 'en') return `Hi ${d.name}, this is your Flughafen München Taxi driver app. Open it and add it to your home screen:\n${d.app_link}`;
  return `Hallo ${d.name}, das ist deine Fahrer-App von Flughafen München Taxi. Link öffnen und zum Home-Bildschirm hinzufügen:\n${d.app_link}`;
}

function DriverManager() {
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [serverUrl, setServerUrl] = useState('');
  const [form, setForm] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<number | null>(null);
  const [edit, setEdit] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminTracking.drivers();
      setDrivers(r.drivers);
      setServerUrl(r.traccar_server_url);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Yüklenemedi'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replace = (d: AdminDriver) => setDrivers((list) => list.map((x) => (x.id === d.id ? d : x)));

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'İşlem başarısız'); return null; } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Plus size={16} /> Yeni şoför</h3>
        <div className="grid sm:grid-cols-5 gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm sm:col-span-1" placeholder="Ad Soyad *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Telefon (+49…)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm uppercase" placeholder="Plaka (FS-NR 700)" value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Araç (Mercedes E-Klasse)" value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} />
          <div className="flex gap-2">
            <select className="border rounded-lg px-2 py-2 text-sm" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="de">DE</option><option value="tr">TR</option><option value="en">EN</option>
            </select>
            <button
              disabled={!form.name.trim() || busy}
              onClick={async () => {
                const r = await run(() => adminTracking.createDriver(form));
                if (r) { setDrivers((d) => [...d, r.driver]); setForm({ ...EMPTY }); }
              }}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              Ekle
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Telefon ve plaka müşteri takip sayfasında görünür (ara / WhatsApp butonları, araç plakası). Dil, şoför uygulamasının ve WhatsApp mesajının dilidir.</p>
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
      </div>

      {drivers.length === 0 && <div className="text-sm text-gray-500 px-2">Henüz şoför yok.</div>}

      <div className="grid xl:grid-cols-2 gap-4">
        {drivers.map((d) => (
          <div key={d.id} className={`bg-white rounded-2xl shadow-sm p-4 sm:p-5 space-y-4 ${d.active ? '' : 'opacity-60'}`}>
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2c5282] text-white flex items-center justify-center font-bold shrink-0">
                {d.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 truncate">{d.name}</div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                  {d.phone && <span>📞 {d.phone}</span>}
                  {d.vehicle_model && <span>🚗 {d.vehicle_model}</span>}
                  {d.vehicle_plate && <span className="font-mono font-semibold text-gray-700">{d.vehicle_plate}</span>}
                  <span>🌐 {d.language.toUpperCase()}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {d.active_booking && <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-semibold">Yolculukta: {d.active_booking}</span>}
                  {d.open_rides > 0 && <span className="rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{d.open_rides} açık yolculuk</span>}
                  <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">Uygulama: {d.last_seen_age_s != null ? ago(d.last_seen_age_s) : 'henüz açılmadı'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch on={d.active} disabled={busy} onChange={async (v) => { const r = await run(() => adminTracking.updateDriver(d.id, { ...d, active: v })); if (r) replace(r.driver); }} />
                <span className="text-[10px] text-gray-400">{d.active ? 'aktif' : 'pasif'}</span>
              </div>
            </div>

            {/* Edit */}
            {editing === d.id ? (
              <div className="grid sm:grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3">
                <input className="border rounded-lg px-3 py-1.5 text-sm" placeholder="Ad Soyad" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                <input className="border rounded-lg px-3 py-1.5 text-sm" placeholder="Telefon" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                <input className="border rounded-lg px-3 py-1.5 text-sm uppercase" placeholder="Plaka" value={edit.vehicle_plate} onChange={(e) => setEdit({ ...edit, vehicle_plate: e.target.value })} />
                <input className="border rounded-lg px-3 py-1.5 text-sm" placeholder="Araç" value={edit.vehicle_model} onChange={(e) => setEdit({ ...edit, vehicle_model: e.target.value })} />
                <select className="border rounded-lg px-2 py-1.5 text-sm" value={edit.language} onChange={(e) => setEdit({ ...edit, language: e.target.value })}>
                  <option value="de">Almanca (DE)</option><option value="tr">Türkçe (TR)</option><option value="en">İngilizce (EN)</option>
                </select>
                <div className="flex gap-2">
                  <button className="flex-1 bg-primary-600 text-white rounded-lg text-sm font-semibold py-1.5" disabled={busy || !edit.name.trim()}
                    onClick={async () => { const r = await run(() => adminTracking.updateDriver(d.id, { ...edit, active: d.active })); if (r) { replace(r.driver); setEditing(null); } }}>
                    Kaydet
                  </button>
                  <button className="px-3 rounded-lg border text-sm" onClick={() => setEditing(null)}>Vazgeç</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(d.id); setEdit({ name: d.name, phone: d.phone, vehicle_plate: d.vehicle_plate, vehicle_model: d.vehicle_model, language: d.language }); }}
                  className="inline-flex items-center gap-1 text-xs rounded-lg border px-2.5 py-1.5 hover:bg-gray-50"><Pencil size={12} /> Düzenle</button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`${d.name} silinsin mi? Açık yolculukları şoförsüz kalır.`)) return;
                    const r = await run(() => adminTracking.deleteDriver(d.id));
                    if (r) setDrivers((list) => list.filter((x) => x.id !== d.id));
                  }}
                  className="inline-flex items-center gap-1 text-xs rounded-lg border border-rose-200 text-rose-600 px-2.5 py-1.5 hover:bg-rose-50"
                ><Trash2 size={12} /> Sil</button>
              </div>
            )}

            {/* App link */}
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Smartphone size={15} /> Şoför uygulaması</div>
              <p className="text-[11px] text-gray-500 mt-0.5">Şoföre bir kez gönderin; telefonunda ana ekrana ekler. Atanan tüm yolculukları burada görür.</p>
              <div className="mt-2 font-mono text-[11px] text-gray-500 truncate bg-gray-50 rounded-lg px-2 py-1">{d.app_link}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CopyBtn text={d.app_link} label="Linki kopyala" />
                {d.phone && (
                  <a href={waLink(d.phone, appLinkMessage(d))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] text-white px-2 py-1 text-xs"><MessageCircle size={12} /> WhatsApp ile gönder</a>
                )}
                <a href={d.app_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"><ExternalLink size={12} /> Aç</a>
                <button
                  onClick={async () => {
                    if (!window.confirm('Yeni link oluşturulsun mu? Şoförün elindeki eski link çalışmaz hale gelir (ör. telefon kaybolduysa).')) return;
                    const r = await run(() => adminTracking.rotateLink(d.id));
                    if (r) replace(r.driver);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                ><RefreshCw size={12} /> Linki yenile</button>
              </div>
            </div>

            {/* Traccar */}
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 flex-1"><Satellite size={15} /> Arka plan GPS (Traccar)</div>
                {d.traccar_device_id && (
                  <span className={`text-[11px] rounded-full px-2 py-0.5 font-semibold ${d.last_source === 'traccar' && d.last_seen_age_s != null && d.last_seen_age_s < 600 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                    {d.last_source === 'traccar' && d.last_seen_age_s != null ? `son veri ${ago(d.last_seen_age_s)}` : 'henüz veri yok'}
                  </span>
                )}
              </div>
              {!d.traccar_device_id ? (
                <>
                  <p className="text-[11px] text-gray-500 mt-1">Tarayıcı, ekran kilitlenince konum göndermeyi durdurur. Ücretsiz <b>Traccar Client</b> uygulaması ekran kapalıyken de gönderir — en doğru ve kesintisiz takip için önerilir.</p>
                  <button className="mt-2 inline-flex items-center gap-1 rounded-lg bg-gray-900 text-white px-2.5 py-1.5 text-xs font-semibold" disabled={busy}
                    onClick={async () => { const r = await run(() => adminTracking.enableTraccar(d.id)); if (r) replace(r.driver); }}>
                    Traccar'ı etkinleştir
                  </button>
                </>
              ) : (
                <div className="mt-2 space-y-2 text-xs">
                  <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
                    <span className="text-gray-500">Sunucu URL</span><code className="truncate bg-gray-50 rounded px-1.5 py-1">{serverUrl}</code><CopyBtn text={serverUrl} />
                    <span className="text-gray-500">Cihaz ID</span><code className="truncate bg-gray-50 rounded px-1.5 py-1">{d.traccar_device_id}</code><CopyBtn text={d.traccar_device_id} />
                  </div>
                  <ol className="list-decimal pl-4 text-gray-600 space-y-0.5">
                    <li><a className="text-primary-600 underline" href="https://apps.apple.com/app/traccar-client/id843156974" target="_blank" rel="noopener noreferrer">iPhone</a> / <a className="text-primary-600 underline" href="https://play.google.com/store/apps/details?id=org.traccar.client" target="_blank" rel="noopener noreferrer">Android</a> için „Traccar Client“ kurun.</li>
                    <li>Ayarlarda <b>Server URL</b> ve <b>Device identifier</b> alanlarına yukarıdaki değerleri girin; hassasiyet „Yüksek“, aralık 10 sn.</li>
                    <li>Konum iznini <b>„Her zaman“</b> verin ve servisi başlatın.</li>
                  </ol>
                  <p className="text-[11px] text-gray-500">Konum yalnızca şoför bir yolculukta „Yola çık“tan sonra kaydedilir; diğer zamanlarda gelen veriler saklanmaz.</p>
                  <div className="flex gap-1.5">
                    <button className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-gray-50" disabled={busy}
                      onClick={async () => { if (!window.confirm('Yeni cihaz ID oluşturulsun mu? Uygulamada da güncellenmesi gerekir.')) return; const r = await run(() => adminTracking.enableTraccar(d.id)); if (r) replace(r.driver); }}>
                      <RefreshCw size={12} /> Yeni ID
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-gray-50" disabled={busy}
                      onClick={async () => { const r = await run(() => adminTracking.disableTraccar(d.id)); if (r) replace(r.driver); }}>
                      Kapat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

const MP_NAMES: Record<MeetingPointKey, string> = { t1: 'Terminal 1', t2: 'Terminal 2', mac: 'MAC' };
const MP_COLORS: Record<MeetingPointKey, string> = { t1: '#2563eb', t2: '#16a34a', mac: '#f59e0b' };

function NumberField({ label, unit, value, onChange, hint, min, max }: { label: string; unit: string; value: number; onChange: (v: number) => void; hint?: string; min: number; max: number }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24 border rounded-lg px-2 py-1.5 text-sm" />
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
      {hint && <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>}
    </label>
  );
}

function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

function SettingsPanel() {
  const [s, setS] = useState<TrackingSettings | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [meta, setMeta] = useState<{ admin_email_default: string; email_configured: boolean } | null>(null);
  const [mpKey, setMpKey] = useState<MeetingPointKey>('t2');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTexts, setShowTexts] = useState(false);

  useEffect(() => {
    adminTracking.settings().then((r) => {
      setS(r.settings);
      setSaved(JSON.stringify(r.settings));
      setMeta({ admin_email_default: r.admin_email_default, email_configured: r.email_configured });
    }).catch((e) => setError(e instanceof ApiError ? e.message : 'Yüklenemedi'));
  }, []);

  const dirty = s ? JSON.stringify(s) !== saved : false;
  const set = <K extends keyof TrackingSettings>(k: K, v: TrackingSettings[K]) => setS((cur) => (cur ? { ...cur, [k]: v } : cur));
  const setMp = (k: MeetingPointKey, patch: Partial<TrackingSettings['meeting_points'][MeetingPointKey]>) =>
    setS((cur) => (cur ? { ...cur, meeting_points: { ...cur.meeting_points, [k]: { ...cur.meeting_points[k], ...patch } } } : cur));

  async function save() {
    if (!s) return;
    setSaving(true); setError(''); setMsg('');
    try {
      const r = await adminTracking.saveSettings(s);
      setS(r.settings);
      setSaved(JSON.stringify(r.settings));
      setMsg('Kaydedildi');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Kaydedilemedi');
    } finally { setSaving(false); }
  }

  if (!s) return <div className="text-sm text-gray-400 p-4">{error || 'Yükleniyor…'}</div>;

  const mp = s.meeting_points[mpKey];
  const mpPins: MapPinT[] = (Object.keys(s.meeting_points) as MeetingPointKey[]).map((k) => ({ id: k, kind: 'point', lat: s.meeting_points[k].lat, lng: s.meeting_points[k].lng, label: MP_NAMES[k] }));
  const mpCircles: MapCircle[] = (Object.keys(s.meeting_points) as MeetingPointKey[]).map((k) => ({ id: k, lat: s.meeting_points[k].lat, lng: s.meeting_points[k].lng, radius_m: s.meeting_points[k].radius_m, color: MP_COLORS[k] }));

  return (
    <div className="space-y-4 pb-20">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Genel</h3>
          <div className="divide-y divide-gray-100">
            <ToggleRow label="Canlı takip açık" hint="Kapalıyken şoför konumu kaydedilmez, müşteri sayfası „şu an kullanılamıyor“ gösterir." on={s.enabled} onChange={(v) => set('enabled', v)} />
            <ToggleRow label="Müşteri konum paylaşabilir" hint="Müşteri onay verirse konumu yolcu binene kadar şoförün haritasında görünür." on={s.share_customer_location} onChange={(v) => set('share_customer_location', v)} />
            <ToggleRow label="E-posta: „Şoför yola çıktı“" hint="Takip linki, şoför bilgisi, plaka ve tahmini varış süresiyle — yolculuk başına bir kez." on={s.mail_enroute} onChange={(v) => set('mail_enroute', v)} />
            <ToggleRow label="E-posta: „Şoför geldi“" hint="Havalimanında buluşma noktası ve tabeladaki isimle." on={s.mail_arrived} onChange={(v) => set('mail_arrived', v)} />
            <ToggleRow label="Otomatik „Yolcu bindi“" hint="Şoför vardıktan en az 90 sn sonra alış noktasından uzaklaşınca." on={s.auto_onboard} onChange={(v) => set('auto_onboard', v)} />
            <ToggleRow label="Otomatik „Yolculuk bitti“" hint="Araç varış noktasında durunca (iki ölçüm, ≥ 20 sn)." on={s.auto_finish} onChange={(v) => set('auto_finish', v)} />
            <ToggleRow label="Bitince rezervasyonu „Abgeschlossen“ yap" hint="Firma müşterileri hariç (kart tahsilatı Sammelrechnung/B2B akışında kalır)." on={s.complete_booking_on_finish} onChange={(v) => set('complete_booking_on_finish', v)} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Hassasiyet & süreler</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <NumberField label="Varış yarıçapı (adres)" unit="m" min={30} max={1000} value={s.arrival_radius_m} onChange={(v) => set('arrival_radius_m', v)} hint="Havalimanında buluşma noktası yarıçapı geçerli." />
            <NumberField label="Durum için gereken doğruluk" unit="m" min={10} max={300} value={s.good_accuracy_m} onChange={(v) => set('good_accuracy_m', v)} hint="Daha kötü ölçümler durumu değiştirmez." />
            <NumberField label="Tamamen yok sayılan ölçüm" unit="m" min={50} max={5000} value={s.max_accuracy_m} onChange={(v) => set('max_accuracy_m', v)} hint="Wi-Fi/baz istasyonu kaynaklı sapmalar." />
            <NumberField label="GPS kaybı uyarısı" unit="dk" min={1} max={60} value={s.gps_lost_minutes} onChange={(v) => set('gps_lost_minutes', v)} />
            <NumberField label="Konum verisi saklama" unit="saat" min={1} max={720} value={s.retention_hours} onChange={(v) => set('retention_hours', v)} hint="Yolculuk bitince şoför/müşteri konumları silinir." />
            <NumberField label="Takip linki açılır (alıştan önce)" unit="saat" min={1} max={336} value={s.link_open_hours_before} onChange={(v) => set('link_open_hours_before', v)} />
            <NumberField label="Takip linki kapanır (bitişten sonra)" unit="saat" min={0} max={48} value={s.link_close_hours_after} onChange={(v) => set('link_close_hours_after', v)} />
          </div>
        </div>
      </div>

      {/* Meeting points */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5"><MapPin size={16} /> Havalimanı buluşma noktaları</h3>
            <p className="text-xs text-gray-500 mt-0.5">Şoförün „vardı“ sayıldığı nokta ve yarıçap. Nokta seçin, sonra haritada şoförlerin gerçekten beklediği yere tıklayın.</p>
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(MP_NAMES) as MeetingPointKey[]).map((k) => (
              <button key={k} onClick={() => setMpKey(k)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${mpKey === k ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200'}`}
                style={mpKey === k ? { background: MP_COLORS[k] } : undefined}>
                {MP_NAMES[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid lg:grid-cols-[1.4fr_1fr] gap-4">
          <TrackingMap
            className="w-full rounded-xl overflow-hidden"
            style={{ height: 340 }}
            pins={mpPins}
            circles={mpCircles}
            fitKey="mp"
            padding={{ top: 40, bottom: 40, left: 40, right: 40 }}
            onMapClick={(p) => setMp(mpKey, { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 })}
            recenterLabel="Ortala"
          />
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="font-semibold" style={{ color: MP_COLORS[mpKey] }}>{MP_NAMES[mpKey]}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">{mp.lat.toFixed(5)}, {mp.lng.toFixed(5)}</div>
              <div className="mt-2"><NumberField label="Varış yarıçapı" unit="m" min={50} max={1000} value={mp.radius_m} onChange={(v) => setMp(mpKey, { radius_m: v })} /></div>
            </div>
            <p className="text-[11px] text-gray-500">Adreste terminal belli değilse (ör. sadece „Flughafen München“) iki terminali kapsayan geniş bir alan kullanılır; uçuşun terminali biliniyorsa o seçilir. Rezervasyon detayından tek tek de değiştirilebilir.</p>
            <button onClick={() => setShowTexts((v) => !v)} className="text-xs text-primary-600 font-semibold">{showTexts ? 'Metinleri gizle' : 'Müşteriye gösterilen metinler'}</button>
            {showTexts && (
              <div className="space-y-2">
                {(['de', 'en', 'tr'] as (keyof L3)[]).map((l) => (
                  <div key={l} className="space-y-1">
                    <input className="w-full border rounded-lg px-2 py-1 text-xs" value={mp.label[l]} placeholder={`Başlık (${l.toUpperCase()})`}
                      onChange={(e) => setMp(mpKey, { label: { ...mp.label, [l]: e.target.value } })} />
                    <textarea className="w-full border rounded-lg px-2 py-1 text-xs" rows={2} value={mp.text[l]} placeholder={`Açıklama (${l.toUpperCase()})`}
                      onChange={(e) => setMp(mpKey, { text: { ...mp.text, [l]: e.target.value } })} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Admin bildirimleri</h3>
        <p className="text-xs text-gray-500 mb-3">Ses: admin paneli açıkken çalar. E-posta: aşağıdaki adrese gider (saatte en fazla 30).</p>
        {meta && !meta.email_configured && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">E-posta gönderimi bu sunucuda yapılandırılmamış (RESEND_API_KEY).</p>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-medium pb-2">Olay</th>
              <th className="font-medium pb-2 w-24"><span className="inline-flex items-center gap-1"><Volume2 size={13} /> Ses</span></th>
              <th className="font-medium pb-2 w-24"><span className="inline-flex items-center gap-1"><Mail size={13} /> E-posta</span></th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ALERT_KINDS.map((k) => (
              <tr key={k}>
                <td className="py-2 text-gray-800">{ALERT_LABEL[k]}</td>
                <td className="text-center"><input type="checkbox" className="w-4 h-4" checked={s.admin[k].sound} onChange={(e) => set('admin', { ...s.admin, [k]: { ...s.admin[k], sound: e.target.checked } })} /></td>
                <td className="text-center"><input type="checkbox" className="w-4 h-4" checked={s.admin[k].email} onChange={(e) => set('admin', { ...s.admin, [k]: { ...s.admin[k], email: e.target.checked } })} /></td>
                <td className="text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => playTrackingTone(k)} className="text-[11px] text-gray-500 hover:text-gray-800">sesi dene</button>
                  <button onClick={() => adminTracking.testAlert(k).then(() => setMsg('Test uyarısı gönderildi (15 sn içinde görünür)')).catch(() => {})} className="text-[11px] text-primary-600 hover:underline">test</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <label className="block text-sm text-gray-700 mt-4">
          E-posta alıcısı
          <input type="email" className="mt-1 w-full sm:w-80 border rounded-lg px-3 py-1.5 text-sm" value={s.admin_email_to} placeholder={meta?.admin_email_default}
            onChange={(e) => set('admin_email_to', e.target.value)} />
        </label>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-600 flex gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-0.5 text-gray-400" />
        <div>Gizlilik: şoför konumu yalnızca aktif yolculuk sırasında (Yola çık → Bitti) kaydedilir; müşteri konumu yalnızca açık onayla ve yolcu binene kadar. Tüm konumlar ayarlanan süre sonunda otomatik silinir.</div>
      </div>

      {/* Save bar */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className={`flex items-center gap-3 rounded-2xl shadow-xl px-4 py-2.5 ${dirty ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border'}`}>
          <span className="text-sm">{error ? <span className="text-rose-400">{error}</span> : msg || (dirty ? 'Kaydedilmemiş değişiklikler' : 'Tüm ayarlar kayıtlı')}</span>
          <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-gray-900 px-3 py-1.5 text-sm font-bold disabled:opacity-40">
            <Save size={14} /> {saving ? '…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
