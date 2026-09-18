'use client';

import { useEffect, useState, useCallback } from 'react';
import { Percent, Trash2, Plus, Pencil, Copy, X, AlertTriangle, Mail, Tag, Timer, Megaphone, Users, ShieldAlert } from 'lucide-react';
import { autoDiscountsApi, AutoDiscount, settingsApi, adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDiscountValue, minutesToHHMM, hhmmToMinutes } from '@/components/discount/format';

const WEEKDAYS = [
  { v: 1, label: 'Mo' }, { v: 2, label: 'Di' }, { v: 3, label: 'Mi' }, { v: 4, label: 'Do' },
  { v: 5, label: 'Fr' }, { v: 6, label: 'Sa' }, { v: 7, label: 'So' },
];

const VEHICLES = [
  { v: 'kombi', label: 'Kombi' }, { v: 'van', label: 'Van' }, { v: 'grossraumtaxi', label: 'Großraumtaxi' },
];

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn('relative w-14 h-7 rounded-full transition-colors flex-shrink-0', on ? 'bg-green-500' : 'bg-gray-300', disabled && 'opacity-50 cursor-not-allowed')}
    >
      <div className={cn('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform', on ? 'translate-x-7' : 'translate-x-0.5')} />
    </button>
  );
}

type FormState = Partial<AutoDiscount>;

const emptyForm = (): FormState => ({
  name: '', discount_type: 'percent', discount_value: 10, zone_scope: 'outside', min_km: null, max_km: null,
  trip_time_from: null, trip_time_to: null, booking_time_from: null, booking_time_to: null,
  weekday_mask: null, booking_index_max: null, daily_max_uses: null,
  max_uses: null, max_discount_amount: null, vehicle_types: null, trip_types: null,
  start_date: null, end_date: null, booking_start_date: null, booking_end_date: null,
  priority: 0, stackable_with_promo: 0,
  label_de: null, label_en: null, label_tr: null, show_in_banner: 0, show_countdown: 1, show_remaining: 1,
  price_basis: 'any', visitor_min_km: null, visitor_max_km: null, visitor_unknown_ok: 1,
  visit_min: null, allow_fixed_routes: 0,
});

const PRICE_BASIS_OPTIONS = [
  { v: 'any', label: 'Tüm ziyaretçiler' },
  { v: 'pflichttarif', label: 'Yalnız amtlicher Tarif geçerliyse' },
  { v: 'normal', label: 'Yalnız normal fiyat hesabında' },
] as const;

const km = (v: number | null) => String(Number(v)).replace(/\.0$/, '').replace('.', ',');

// "Besucher bis 100 km" / "Besucher ab 200 km" / "Besucher 20–100 km"
const visitorRange = (min: number | null, max: number | null) => {
  if (min == null && max == null) return null;
  if (min == null) return `ziyaretçi ${km(max)} km ye kadar`;
  if (max == null) return `ziyaretçi ${km(min)} km den itibaren`;
  return `ziyaretçi ${km(min)}–${km(max)} km`;
};

const priceBasisShort = (v: string) =>
  v === 'pflichttarif' ? 'yalnız amtlicher Tarif' : v === 'normal' ? 'yalnız normal fiyat' : null;

// Anzeige-Schalter (Einstellungen) — alle mit gleichem Kartenmuster im Tab.
const DISPLAY_SETTINGS = [
  {
    key: 'auto_discount_red_badge_enabled', def: '1', icon: Tag,
    title: 'Araç kartlarında kırmızı indirim etiketi',
    desc: 'Kırmızı köşe + kırmızı fiyat etiketi. Kapalı = eskisi gibi sade yeşil satır.',
    on: 'Kırmızı indirim etiketi aktif ✓', off: 'Kırmızı indirim etiketi gizlendi ✓',
  },
  {
    key: 'auto_discount_countdown_enabled', def: '1', icon: Timer,
    title: 'Geri sayım göster',
    desc: 'Kalan süreyi gösterir — yalnız gerçek bir rezervasyon bitişi olan kurallarda (rezervasyon tarihi/saati bitişi). Kural bazında kapatılabilir.',
    on: 'Geri sayım aktif ✓', off: 'Geri sayım gizlendi ✓',
  },
  {
    key: 'auto_discount_remaining_enabled', def: '1', icon: Users,
    title: 'Kalan indirim hakkını göster',
    desc: 'Sadece 2 indirim hakkı kaldı gibi bir uyarı — yalnız kontenjanlı kurallarda (günlük ya da toplam limit). Kural bazında kapatılabilir.',
    on: 'Kalan indirim hakkı gösteriliyor ✓', off: 'Kalan indirim hakkı gizlendi ✓',
  },
  {
    key: 'auto_discount_banner_enabled', def: '0', icon: Megaphone,
    title: 'Ana sayfada indirim banner',
    desc: 'Arama formunun üstünde kırmızı uyarı. Banner seçeneği açık olan kuralı gösterir.',
    on: 'Ana sayfa bannerı aktif ✓', off: 'Ana sayfa bannerı gizlendi ✓',
  },
  {
    key: 'auto_discount_vpn_as_unknown', def: '1', icon: ShieldAlert,
    title: 'VPN ziyaretçisini bilinmeyen konum say',
    desc: 'Yalnız ziyaretçi mesafesi hedeflemesi için geçerli: VPN ve veri merkezi IP lerinde kuralın bilinmeyen konumda da ver seçeneği karar verir. Fiyat hesabı ve Pflichtgebiet bypass etkilenmez.',
    on: 'VPN ziyaretçisi bilinmeyen konum sayılıyor ✓', off: 'VPN konumu normal konum gibi işleniyor ✓',
  },
] as const;

const timeRange = (from: number | null, to: number | null) =>
  from != null && to != null ? `${minutesToHHMM(from)}–${minutesToHHMM(to)}` : null;

export default function RabatteTab({ token }: { token: string }) {
  void token;
  const [rules, setRules] = useState<AutoDiscount[]>([]);
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [ignorePgFloor, setIgnorePgFloor] = useState(false);
  const [showInEmail, setShowInEmail] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  // Löschen ohne window.confirm: Browser unterdrücken den Dialog nach mehrfacher Nutzung
  // ("weitere Dialoge blockieren"), dann passiert beim Klick scheinbar gar nichts.
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([autoDiscountsApi.getAll(), settingsApi.getAll()]);
      setRules(list);
      setMasterEnabled((settings.auto_discounts_enabled ?? '1') === '1');
      setIgnorePgFloor((settings.auto_discount_ignore_pg_floor ?? '0') === '1');
      setShowInEmail((settings.auto_discount_show_in_email ?? '0') === '1');
      setDisplaySettings(Object.fromEntries(DISPLAY_SETTINGS.map(d => [d.key, (settings[d.key] ?? d.def) === '1'])));
      setErr('');
    } catch {
      setErr('Kurallar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleMaster = async () => {
    const next = !masterEnabled;
    setMasterEnabled(next);
    setSaving(true);
    try {
      await adminApi.updateSettings({ auto_discounts_enabled: next ? '1' : '0' });
      flash(next ? 'İndirimler açıldı ✓' : 'İndirimler kapatıldı — tüm kurallar duraklatıldı ✓');
    } catch {
      setMasterEnabled(!next);
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  };

  const toggleIgnorePgFloor = async () => {
    const next = !ignorePgFloor;
    if (next && !confirm('§51 Abs. 5 PBefG: Pflichttarif altına inilemez. Herkese eşit koşulda verilmeyen indirimler yasaktır ve geçersizdir (LG/OLG Frankfurt). Devam edersen Pflichtfahrgebiet içindeki indirimler tarifenin altına inebilir — hukuki risk sana ait. Devam edilsin mi?')) return;
    setIgnorePgFloor(next);
    setSaving(true);
    try {
      await adminApi.updateSettings({ auto_discount_ignore_pg_floor: next ? '1' : '0' });
      flash(next ? 'Tarife tabanı devre dışı ⚠️' : 'Tarife tabanı yeniden aktif ✓');
    } catch {
      setIgnorePgFloor(!next);
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  };

  const toggleShowInEmail = async () => {
    const next = !showInEmail;
    setShowInEmail(next);
    setSaving(true);
    try {
      await adminApi.updateSettings({ auto_discount_show_in_email: next ? '1' : '0' });
      flash(next ? 'İndirim satırı müşteri e-postasında gösteriliyor ✓' : 'İndirim satırı müşteri e-postasında gizlendi ✓');
    } catch {
      setShowInEmail(!next);
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  };

  const toggleDisplaySetting = async (d: typeof DISPLAY_SETTINGS[number]) => {
    const next = !displaySettings[d.key];
    setDisplaySettings(v => ({ ...v, [d.key]: next }));
    setSaving(true);
    try {
      await adminApi.updateSettings({ [d.key]: next ? '1' : '0' });
      flash(next ? d.on : d.off);
    } catch {
      setDisplaySettings(v => ({ ...v, [d.key]: !next }));
      setErr('Kaydedilemedi');
    }
    setSaving(false);
  };

  const toggleRule = async (r: AutoDiscount) => {
    setRules(arr => arr.map(x => x.id === r.id ? { ...x, active: r.active ? 0 : 1 } : x));
    try {
      await autoDiscountsApi.toggle(r.id, !r.active);
    } catch {
      setRules(arr => arr.map(x => x.id === r.id ? { ...x, active: r.active } : x));
      setErr('Değiştirme başarısız');
    }
  };

  const removeRule = async (id: number) => {
    setConfirmDeleteId(null);
    try {
      await autoDiscountsApi.remove(id);
      setRules(arr => arr.filter(x => x.id !== id));
      flash('Kural silindi ✓');
    } catch {
      setErr('Silme başarısız');
    }
  };

  const startCreate = () => { setEditing(emptyForm()); setEditingId(null); setCopying(false); };

  // Kopieren: alle Einstellungen übernehmen, aber als neue Regel speichern — praktisch für
  // Aktionen, die sich nur in der Uhrzeit unterscheiden (z.B. 18:30–00:00 und 00:00–07:00).
  const startCopy = (r: AutoDiscount) => {
    const { id, used_count, created_at, ...rest } = r as AutoDiscount & { created_at?: string };
    void id; void used_count; void created_at;
    setEditing({
      ...rest,
      name: `${r.name} (Kopie)`,
      start_date: dateOnly(r.start_date),
      end_date: dateOnly(r.end_date),
      booking_start_date: dateOnly(r.booking_start_date),
      booking_end_date: dateOnly(r.booking_end_date),
    });
    setEditingId(null);
    setCopying(true);
  };
  // API liefert DATE-Spalten als ISO ("2026-09-16T00:00:00.000Z") — <input type="date"> braucht
  // "YYYY-MM-DD", sonst bleibt das Feld leer und Speichern würde die Daten löschen.
  const dateOnly = (d: string | null) => (d ? String(d).slice(0, 10) : null);
  const startEdit = (r: AutoDiscount) => {
    setCopying(false);
    setEditing({
      ...r,
      start_date: dateOnly(r.start_date),
      end_date: dateOnly(r.end_date),
      booking_start_date: dateOnly(r.booking_start_date),
      booking_end_date: dateOnly(r.booking_end_date),
    });
    setEditingId(r.id);
  };
  const cancelEdit = () => { setEditing(null); setEditingId(null); setCopying(false); };

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.name || !editing.discount_value) { setErr('Ad ve indirim değeri zorunlu'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await autoDiscountsApi.update(editingId, editing);
      } else {
        await autoDiscountsApi.create(editing);
      }
      await load();
      cancelEdit();
      flash(copying ? 'Kopya oluşturuldu ✓' : 'Kaydedildi ✓');
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Kaydetme başarısız');
    }
    setSaving(false);
  };

  const patch = (p: FormState) => setEditing(f => (f ? { ...f, ...p } : f));

  const toggleWeekday = (d: number) => {
    if (!editing) return;
    const current = (editing.weekday_mask || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    patch({ weekday_mask: next.length === 0 ? null : next.sort().join(',') });
  };

  const toggleVehicle = (v: string) => {
    if (!editing) return;
    const current = (editing.vehicle_types || '').split(',').map(s => s.trim()).filter(Boolean);
    const next = current.includes(v) ? current.filter(x => x !== v) : [...current, v];
    patch({ vehicle_types: next.length === 0 ? null : next.join(',') });
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Yükleniyor…</div>;

  const zoneLabel = (z: string) => z === 'inside' ? 'INNERHALB' : z === 'outside' ? 'AUSSERHALB' : 'BEIDE';
  const zoneColor = (z: string) => z === 'inside' ? 'bg-amber-100 text-amber-800 border-amber-300' : z === 'outside' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{err}</div>}

      {/* Ana şalter */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
            <Percent size={18} className="text-green-700" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Otomatik indirimler</p>
            <p className="text-sm text-gray-500">Ana şalter — tüm kuralları silmeden anında devre dışı bırakır.</p>
          </div>
        </div>
        <Toggle on={masterEnabled} onClick={toggleMaster} disabled={saving} />
      </div>

      {/* Tarif-Untergrenze — §51 PBefG */}
      <div className={cn('border rounded-2xl p-5 flex items-center justify-between', ignorePgFloor ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200')}>
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center', ignorePgFloor ? 'bg-amber-100 border-amber-300' : 'bg-gray-50 border-gray-200')}>
            <AlertTriangle size={18} className={ignorePgFloor ? 'text-amber-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Pflichtfahrgebiet içinde tarife tabanı</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Varsayılan: indirimler Pflichttarif (§51 Abs. 5 PBefG) altına inemez.
              {ignorePgFloor && <span className="text-amber-700 font-semibold"> Devre dışı — indirimler Pflichttarif altına inebilir. Hukuki risk.</span>}
            </p>
          </div>
        </div>
        <Toggle on={!ignorePgFloor} onClick={toggleIgnorePgFloor} disabled={saving} />
      </div>

      {/* Rabatt-Zeile in Kunden-E-Mail */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <Mail size={18} className="text-gray-500" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Müşteri e-postasında indirim satırını göster</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Varsayılan kapalı — onay e-postası yalnız son fiyatı gösterir, indirim satırı yoktur.
              Aksiyon kodları (indirim kodu) bundan bağımsız olarak her zaman gösterilir.
            </p>
          </div>
        </div>
        <Toggle on={showInEmail} onClick={toggleShowInEmail} disabled={saving} />
      </div>

      {/* Anzeige für Kunden: rotes Label, Countdown, Startseiten-Banner */}
      {DISPLAY_SETTINGS.map(d => {
        const Icon = d.icon;
        const on = !!displaySettings[d.key];
        return (
          <div key={d.key} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0', on ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200')}>
                <Icon size={18} className={on ? 'text-red-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="font-bold text-gray-900">{d.title}</p>
                <p className="text-sm text-gray-500 max-w-xl">{d.desc}</p>
              </div>
            </div>
            <Toggle on={on} onClick={() => toggleDisplaySetting(d)} disabled={saving} />
          </div>
        );
      })}

      {/* Kural listesi */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-bold text-gray-900">Regeln</p>
          <button onClick={startCreate} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg">
            <Plus size={15} /> Yeni kural
          </button>
        </div>
        {rules.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Henüz kural oluşturulmadı.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <Toggle on={!!r.active} onClick={() => toggleRule(r)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{r.name}</span>
                    <span className="text-sm font-bold text-green-700">
                      {formatDiscountValue(r.discount_type, Number(r.discount_value), 'de')}
                    </span>
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', zoneColor(r.zone_scope))}>{zoneLabel(r.zone_scope)}</span>
                    {r.zone_scope === 'inside' && <AlertTriangle size={14} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.min_km != null || r.max_km != null ? `${r.min_km ?? 0}–${r.max_km ?? '∞'} km · ` : ''}
                    {timeRange(r.trip_time_from, r.trip_time_to) ? `yolculuk ${timeRange(r.trip_time_from, r.trip_time_to)} · ` : ''}
                    {timeRange(r.booking_time_from, r.booking_time_to) ? `rezervasyon ${timeRange(r.booking_time_from, r.booking_time_to)} · ` : ''}
                    {r.booking_index_max != null ? `ilk ${r.booking_index_max} rezervasyon · ` : ''}
                    {r.daily_max_uses != null ? `günde maks. ${r.daily_max_uses} · ` : ''}
                    {(r.start_date || r.end_date) ? `yolculuk: ${(r.start_date ?? '…').slice(0, 10)}–${(r.end_date ?? '…').slice(0, 10)} · ` : ''}
                    {(r.booking_start_date || r.booking_end_date) ? `rezervasyon: ${(r.booking_start_date ?? '…').slice(0, 10)}–${(r.booking_end_date ?? '…').slice(0, 10)} · ` : ''}
                    Kullanım: {r.used_count}{r.max_uses != null ? `/${r.max_uses}` : ''}
                    {r.show_in_banner ? ' · 📣 Banner' : ''}
                    {r.show_countdown ? '' : ' · geri sayım yok'}
                    {(r.daily_max_uses != null || r.max_uses != null) && !r.show_remaining ? ' · kalan hak gizli' : ''}
                    {priceBasisShort(r.price_basis) ? ` · ${priceBasisShort(r.price_basis)}` : ''}
                    {visitorRange(r.visitor_min_km, r.visitor_max_km) ? ` · ${visitorRange(r.visitor_min_km, r.visitor_max_km)}` : ''}
                    {r.visit_min != null ? ` · ${r.visit_min}. ziyaretten itibaren` : ''}
                    {r.allow_fixed_routes ? ' · sabit fiyatlara da' : ''}
                  </p>
                </div>
                <button onClick={() => startEdit(r)} title="Düzenle" className="p-2 text-gray-400 hover:text-primary-600"><Pencil size={16} /></button>
                <button onClick={() => startCopy(r)} title="Kopyala — aynı ayarlarla yeni kural" className="p-2 text-gray-400 hover:text-primary-600"><Copy size={16} /></button>
                {confirmDeleteId === r.id ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => removeRule(r.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold">
                      Gerçekten sil
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold">
                      İptal
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(r.id)} title="Löschen"
                    className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kural formu */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cancelEdit}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">{editingId ? 'Kuralı düzenle' : copying ? 'Kuralı kopyala' : 'Yeni kural'}</h3>
              <button onClick={cancelEdit}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Name</label>
                <input value={editing.name || ''} onChange={e => patch({ name: e.target.value })}
                  placeholder="örn. Uzun mesafe indirimi"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">İndirim türü</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => patch({ discount_type: 'percent' })}
                    className={cn('py-2 rounded-lg text-sm font-bold border', editing.discount_type === 'percent' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                    Yüzde %
                  </button>
                  <button type="button" onClick={() => patch({ discount_type: 'fixed' })}
                    className={cn('py-2 rounded-lg text-sm font-bold border', editing.discount_type === 'fixed' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                    Sabit tutar €
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {editing.discount_type === 'fixed' ? 'İndirim €' : 'İndirim %'}
                  </label>
                  <input type="number" min={0} max={editing.discount_type === 'fixed' ? undefined : 100} step={0.5}
                    value={editing.discount_value ?? ''}
                    onChange={e => patch({ discount_value: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Maks. indirim €</label>
                  <input type="number" min={0} step={0.5} value={editing.max_discount_amount ?? ''}
                    onChange={e => patch({ max_discount_amount: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder="unbegrenzt"
                    disabled={editing.discount_type === 'fixed'}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Geçerlilik alanı</label>
                <div className="mt-1 grid grid-cols-1 gap-2">
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input type="radio" checked={editing.zone_scope === 'outside'} onChange={() => patch({ zone_scope: 'outside' })} />
                    Pflichtfahrgebiet dışı (önerilen)
                  </label>
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input type="radio" checked={editing.zone_scope === 'inside'} onChange={() => patch({ zone_scope: 'inside' })} />
                    Pflichtfahrgebiet içi
                  </label>
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input type="radio" checked={editing.zone_scope === 'any'} onChange={() => patch({ zone_scope: 'any' })} />
                    İkisi de
                  </label>
                </div>
                {(editing.zone_scope === 'inside' || editing.zone_scope === 'any') && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>§ 51 Abs. 5 PBefG: Pflichtfahrgebiet içinde amtlicher Tarif altına inilemez ve tarife eşit uygulanmalıdır. İndirim otomatik olarak Pflichttarif ile sınırlanır.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Min. km</label>
                  <input type="number" min={0} value={editing.min_km ?? ''}
                    onChange={e => patch({ min_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder="z.B. 50"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Maks. km</label>
                  <input type="number" min={0} value={editing.max_km ?? ''}
                    onChange={e => patch({ max_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder="unbegrenzt"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Araçlar (boş = hepsi)</label>
                <div className="mt-1 flex gap-1.5">
                  {VEHICLES.map(v => {
                    const active = (editing.vehicle_types || '').split(',').includes(v.v);
                    return (
                      <button key={v.v} onClick={() => toggleVehicle(v.v)}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-bold border', active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Müşterinin ilk [N] rezervasyonu</label>
                  <input type="number" min={1} value={editing.booking_index_max ?? ''}
                    onChange={e => patch({ booking_index_max: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="alle Kunden"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Toplam maks. kullanım</label>
                  <input type="number" min={1} value={editing.max_uses ?? ''}
                    onChange={e => patch({ max_uses: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="unbegrenzt"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Günlük maks. rezervasyon</label>
                <p className="text-xs text-gray-400 mb-1">
                  Sabahın ilk 2-3 siparişi gibi kullanımlar için: her gece 00:00 da otomatik sıfırlanır, elle sıfırlama gerekmez.
                </p>
                <input type="number" min={1} value={editing.daily_max_uses ?? ''}
                  onChange={e => patch({ daily_max_uses: e.target.value === '' ? null : parseInt(e.target.value) })}
                  placeholder="unbegrenzt"
                  className="mt-1 w-full max-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Yolculuk tipi</label>
                  <select value={editing.trip_types || ''} onChange={e => patch({ trip_types: e.target.value || null })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">İkisi de</option>
                    <option value="oneway">Sadece tek yön</option>
                    <option value="roundtrip">Sadece gidiş-dönüş</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Öncelik</label>
                  <input type="number" value={editing.priority ?? 0}
                    onChange={e => patch({ priority: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Yolculuk tarihi</label>
                <p className="text-xs text-gray-400 mb-1">Yolculuğun kendi tarihi. Tek bir gün için (örn. 30.07.2026) iki alana da aynı tarihi yaz.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Başlangıç</label>
                    <input type="date" value={editing.start_date || ''} onChange={e => patch({ start_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Bitiş</label>
                    <input type="date" value={editing.end_date || ''} onChange={e => patch({ end_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Yolculuk saati (boş = tüm gün)</label>
                <p className="text-xs text-gray-400 mb-1">Alış saati. Gece yarısını geçebilir, örn. 22:00–06:00. Bitiş saati dahil değildir — gece yarısına kadar: 00:00.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">von</label>
                    <input type="time" value={minutesToHHMM(editing.trip_time_from)}
                      onChange={e => patch({ trip_time_from: hhmmToMinutes(e.target.value) })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">bis</label>
                    <input type="time" value={minutesToHHMM(editing.trip_time_to)}
                      onChange={e => patch({ trip_time_to: hhmmToMinutes(e.target.value) })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Yolculuğun haftanın günleri (boş = hepsi)</label>
                <div className="mt-1 flex gap-1.5">
                  {WEEKDAYS.map(d => {
                    const active = (editing.weekday_mask || '').split(',').map(Number).includes(d.v);
                    return (
                      <button key={d.v} onClick={() => toggleWeekday(d.v)}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-bold border', active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rezervasyon tarihi</label>
                <p className="text-xs text-gray-400 mb-1">Rezervasyonun yapıldığı tarih (yukarıdaki yolculuk tarihinden bağımsız — ikisi aynı anda da aktif olabilir).</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Başlangıç</label>
                    <input type="date" value={editing.booking_start_date || ''} onChange={e => patch({ booking_start_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Bitiş</label>
                    <input type="date" value={editing.booking_end_date || ''} onChange={e => patch({ booking_end_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rezervasyon saati (boş = tüm gün)</label>
                <p className="text-xs text-gray-400 mb-1">Müşterinin rezervasyon yaptığı saat (Almanya saati) — örn. akşam aksiyonu 18:00–00:00. Yolculuk saatinden bağımsız.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">von</label>
                    <input type="time" value={minutesToHHMM(editing.booking_time_from)}
                      onChange={e => patch({ booking_time_from: hhmmToMinutes(e.target.value) })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">bis</label>
                    <input type="time" value={minutesToHHMM(editing.booking_time_to)}
                      onChange={e => patch({ booking_time_to: hhmmToMinutes(e.target.value) })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hedef kitle: Fiyat tabanı</label>
                <p className="text-xs text-gray-400 mb-1">
                  Uzaktan bakan ziyaretçiler Pflichtfahrgebiet içinde IP-Bypass sayesinde (Pflichtfahrgebiet
                  sekmesi, varsayılan 100 km üstü) amtlicher Tarif yerine daha ucuz normal fiyatı görür.
                  „Yalnız amtlicher Tarif geçerliyse“ seçeneği, bu ziyaretçilerin üstüne bir de indirim
                  almasını engeller.
                </p>
                <select value={editing.price_basis || 'any'}
                  onChange={e => patch({ price_basis: e.target.value as 'any' | 'pflichttarif' | 'normal' })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {PRICE_BASIS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hedef kitle: Ziyaretçi mesafesi</label>
                <p className="text-xs text-gray-400 mb-1">
                  <span className="text-amber-700 font-semibold">Önemli:</span> Uzaktan bakan ziyaretçi
                  Pflichtfahrgebiet içinde IP-Bypass sayesinde daha ucuz ziyaretçi fiyatını görüyorsa,
                  o fiyata sunucu tarafında <strong>indirim verilmez</strong> — bu fiyat zaten indirilmiş
                  kademedir.{' '}
                  Ziyaretçinin IP konumu ile işletme merkezi arasındaki kuş uçuşu mesafe. Boş = fark etmez.
                  Örnek: 100 km ye kadar = yalnız bölgeden bakan ziyaretçilere indirim. VPN ve veri merkezi
                  IP leri bilinmeyen konum sayılır — konumları müşteri hakkında bir şey söylemez.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">ab (km)</label>
                    <input type="number" min={0} value={editing.visitor_min_km ?? ''}
                      onChange={e => patch({ visitor_min_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      placeholder="egal"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">bis (km)</label>
                    <input type="number" min={0} value={editing.visitor_max_km ?? ''}
                      onChange={e => patch({ visitor_max_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      placeholder="egal"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                  <input type="checkbox" checked={!!editing.visitor_unknown_ok}
                    onChange={e => patch({ visitor_unknown_ok: e.target.checked ? 1 : 0 })} />
                  Bilinmeyen konumda da ver (VPN, şirket ağı)
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hedef kitle: Tekrar gelen ziyaretçi</label>
                <p className="text-xs text-gray-400 mb-1">
                  Kural, aynı cihazın bu ziyaretinden itibaren geçerli olur. Boş = her ziyaret.
                  Ziyaretler sunucuda sayılır; cihaz tanınamıyorsa kural çalışmaz.
                  <br />
                  <span className="text-gray-500">
                    Neden tekrar gelen? Son 60 günün kendi oturumlarında 1. ziyarette yaklaşık her 22
                    oturumdan biri rezervasyona dönüyor (2979 oturumda 136), 2. ziyarette her 13'te bir
                    (598'de 46), 3. ziyarette her 9'da bir (234'te 25), 4. ziyarette her 7'de bir
                    (118'de 16). Yani geri gelen kişi son seferde rezervasyon yapmamış ama hâlâ ilgili.
                    <strong> Bunlar dönüşüm oranı, indirim oranı değil</strong> — ne kadar indirim
                    verileceğini yukarıdaki „İndirim türü“ ve „Wert“ alanlarına sen yazıyorsun.
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">kaçıncı ziyaretten itibaren</label>
                    <input type="number" min={2} max={20} value={editing.visit_min ?? ''}
                      onChange={e => patch({ visit_min: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                      placeholder="egal"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                {/* Pratikte işe yaramayan iki kombinasyon — uyarı hiçbir şeyi engellemez,
                    ama kuralı kurarken hatırlatır. */}
                {editing.visit_min != null && (editing.visitor_min_km != null || editing.visitor_max_km != null) && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      <strong>Ziyaret sayısı ile ziyaretçi mesafesi birlikte:</strong> Uzaktan bakan
                      ziyaretçi, Pflichtfahrgebiet içinde IP-Bypass sayesinde zaten daha ucuz olan
                      ziyaretçi fiyatını görüyor. Bu fiyata <strong>hiçbir şekilde indirim verilmiyor</strong>
                      (aynı yolculuğa ikinci indirim binmesin diye sunucuda engelli) — yani kural orada
                      hiç çalışmaz. Ayrıca kimin indirim alacağını IP konumuna göre seçmek keyfi
                      kayırma görünümü verir; § 51 Abs. 5 PBefG herkese eşit koşul şartı koyuyor.
                      Öneri: mesafe alanını boş bırak.
                    </span>
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm cursor-pointer mt-3">
                  <input type="checkbox" className="mt-0.5" checked={!!editing.allow_fixed_routes}
                    onChange={e => patch({ allow_fixed_routes: e.target.checked ? 1 : 0 })} />
                  <span>
                    <strong>Sabit fiyatlı güzergâhlara</strong> da indirim uygula
                    <span className="block text-xs text-gray-400">
                      Varsayılan kapalı: sabit fiyatlar zaten ayrıca hesaplanmış, otomatik indirim
                      üstüne binerdi — yani aynı yolculuğa ikinci indirim. Sadece sabit fiyatlarını
                      bilerek indirime yer bırakacak şekilde belirlediysen aç.
                    </span>
                  </span>
                </label>

                {editing.visit_min != null && editing.zone_scope === 'inside' && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      <strong>Pflichtfahrgebiet içinde ziyaret sayısı kuralı:</strong> Orada indirim
                      Pflichttarif tabanına kırpılır ve çoğunlukla 0 €'ya düşer — müşteri hiçbir şey
                      görmez. Öneri: „Außerhalb Pflichtfahrgebiet“ seç.
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Müşteri metni (boş = kural adı)</label>
                <p className="text-xs text-gray-400 mb-1">Aksiyonun müşteriye araç kartında, rezervasyonda ve bannerda görünen adı. En fazla 80 karakter.</p>
                <div className="space-y-2">
                  {(['de', 'en', 'tr'] as const).map(l => {
                    const key = `label_${l}` as const;
                    return (
                      <div key={l} className="flex items-center gap-2">
                        <span className="w-8 text-xs font-bold text-gray-400 uppercase">{l}</span>
                        <input value={editing[key] || ''} maxLength={80}
                          onChange={e => patch({ [key]: e.target.value || null })}
                          placeholder={editing.name || (l === 'de' ? 'z.B. Abendrabatt' : l === 'en' ? 'e.g. Evening deal' : 'örn. Akşam indirimi')}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">Önizleme:</span>
                  <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    <Tag size={11} /> {formatDiscountValue(editing.discount_type || 'percent', Number(editing.discount_value) || 0, 'de')} · {editing.label_de || editing.name || 'Rabatt'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!editing.show_in_banner}
                    onChange={e => patch({ show_in_banner: e.target.checked ? 1 : 0 })} />
                  Ana sayfa bannerında göster
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!editing.show_countdown}
                    onChange={e => patch({ show_countdown: e.target.checked ? 1 : 0 })} />
                  Geri sayım göster (yalnız rezervasyon tarihi ya da saati bitişi varsa)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!editing.show_remaining}
                    onChange={e => patch({ show_remaining: e.target.checked ? 1 : 0 })} />
                  Kalan indirim hakkını göster (yalnız günlük ya da toplam limit varsa)
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!editing.stackable_with_promo}
                  onChange={e => patch({ stackable_with_promo: e.target.checked ? 1 : 0 })} />
                Aksiyon kodu ile birleşebilir
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={cancelEdit} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm">İptal</button>
              <button onClick={saveForm} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-50">
                {saving ? 'Speichert…' : copying ? 'Yeni kural olarak kaydet' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
