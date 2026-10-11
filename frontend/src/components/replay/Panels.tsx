'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, HardDrive, Loader2, Phone, ShieldCheck, Trash2 } from 'lucide-react';
import { API_BASE, DraftRow, Dropoff, RecSettings, Stats, fmtBytes, pct, shortAddr } from './lib';

export type Drill =
  | { kind: 'error_target'; value: string; label: string }
  | { kind: 'last_field'; value: string; label: string }
  | { kind: 'stage'; value: string; label: string }
  | { kind: 'device_source'; device: string; source: string; label: string };

const card = 'bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm';
const h3 = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wide';

// ---------------------------------------------------------------------------
// İçgörüler — "Neden vazgeçiyorlar". Her satır tıklanınca o oturumlara süzer.
// ---------------------------------------------------------------------------
export function InsightsPanel({ data, onDrill }: { data: Dropoff | null; onDrill: (d: Drill) => void }) {
  if (!data) return <div className={`${card} p-8 text-center text-sm text-slate-400`}>İçgörüler yüklenemedi.</div>;
  const f = data.funnel;
  const steps = [
    { label: 'Ziyaret', n: f.visited, stage: null },
    { label: 'Fiyat gördü', n: f.saw_prices, stage: 'prices' },
    { label: 'Form açtı', n: f.opened_form, stage: 'form' },
    { label: 'Rezervasyon', n: f.booked, stage: 'booked' },
  ];
  const max = Math.max(1, f.visited);
  const maxErr = Math.max(1, ...data.errors.map(e => Number(e.n)));
  const maxField = Math.max(1, ...data.last_fields.map(e => Number(e.n)));

  return (
    <div className="space-y-4">
      {/* Huni */}
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className={h3}>Huni · son {data.days} gün</div>
          <div className="text-xs text-slate-400">Aşamaya tıkla → o aşamada kalan oturumları izle</div>
        </div>
        <div className="space-y-2.5">
          {steps.map((st, i) => {
            const prev = i > 0 ? steps[i - 1].n : 0;
            const lost = i > 0 ? prev - st.n : 0;
            return (
              <button
                key={st.label}
                disabled={!st.stage}
                onClick={() => st.stage && onDrill({ kind: 'stage', value: st.stage === 'booked' ? 'booked' : i === 1 ? 'prices' : 'form', label: st.stage === 'booked' ? 'Rezervasyon yapanlar' : `${st.label} ama devam etmedi` })}
                className="w-full grid grid-cols-[110px_1fr_auto] items-center gap-3 text-left group disabled:cursor-default"
              >
                <span className="text-sm text-slate-600">{st.label}</span>
                <span className="relative h-8 rounded-lg bg-slate-100 overflow-hidden">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-lg transition-all ${i === 3 ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'} ${st.stage ? 'group-hover:brightness-110' : ''}`}
                    style={{ width: `${Math.max(1.5, (st.n / max) * 100)}%` }}
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-white mix-blend-normal drop-shadow">
                    {st.n.toLocaleString('de-DE')}
                  </span>
                </span>
                <span className="text-xs w-28 text-right">
                  {i > 0 ? (
                    <>
                      <span className="font-semibold text-slate-700">{pct(st.n, prev)}</span>
                      <span className="text-rose-500 ml-1.5">−{lost.toLocaleString('de-DE')}</span>
                    </>
                  ) : <span className="text-slate-400">100%</span>}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onDrill({ kind: 'stage', value: 'called', label: 'Telefona / WhatsApp\'a dönenler' })}
          className="mt-4 w-full flex items-center gap-3 rounded-xl bg-sky-50 ring-1 ring-sky-100 px-4 py-3 text-left hover:bg-sky-100/70"
        >
          <Phone size={16} className="text-sky-600" />
          <span className="text-sm text-sky-800"><strong>{f.called.toLocaleString('de-DE')}</strong> ziyaretçi telefona / WhatsApp'a döndü — web dışı dönüşüm</span>
          <ArrowRight size={14} className="ml-auto text-sky-500" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hatalar */}
        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3`}>En sık hatalar <span className="normal-case font-normal text-slate-400">· tıkla → hatayı yaşayanları izle</span></div>
          {data.errors.length === 0 ? <p className="text-sm text-slate-400">Hata kaydı yok.</p> : (
            <ul className="space-y-1">
              {data.errors.map((r, i) => (
                <li key={`${r.type}-${i}`}>
                  <button
                    onClick={() => onDrill({ kind: 'error_target', value: r.target, label: r.target })}
                    className="w-full relative flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left overflow-hidden"
                  >
                    <span className={`absolute inset-y-1 left-0 rounded ${r.type === 'field_error' ? 'bg-amber-100/70' : 'bg-rose-100/70'}`}
                      style={{ width: `${(Number(r.n) / maxErr) * 100}%` }} />
                    <span className={`relative text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.type === 'field_error' ? 'bg-amber-200 text-amber-900' : 'bg-rose-200 text-rose-900'}`}>
                      {r.type === 'field_error' ? 'FORM' : 'TEKNİK'}
                    </span>
                    <span className="relative truncate text-slate-700" title={r.target}>{r.target}</span>
                    <strong className="relative ml-auto tabular-nums text-slate-900">{Number(r.n).toLocaleString('de-DE')}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Terk edilen alan */}
        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3`}>Formun bırakıldığı alan</div>
          {data.last_fields.length === 0 ? <p className="text-sm text-slate-400">Henüz veri yok.</p> : (
            <ul className="space-y-1">
              {data.last_fields.map((r) => (
                <li key={r.field}>
                  <button
                    onClick={() => onDrill({ kind: 'last_field', value: r.field, label: `"${r.field}" alanında bırakanlar` })}
                    className="w-full relative flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left overflow-hidden"
                  >
                    <span className="absolute inset-y-1 left-0 rounded bg-violet-100/80" style={{ width: `${(Number(r.n) / maxField) * 100}%` }} />
                    <span className="relative truncate text-slate-700">{r.field}</span>
                    <strong className="relative ml-auto tabular-nums text-slate-900">{r.n}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fiyat bandı */}
        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3`}>Fiyat bandına göre dönüşüm</div>
          {data.price_bands.length === 0 ? <p className="text-sm text-slate-400">Henüz fiyat görüntüleme kaydı yok.</p> : (
            <div className="space-y-2">
              {data.price_bands.map((b) => {
                const rate = Number(b.sessions) ? Number(b.booked) / Number(b.sessions) : 0;
                return (
                  <div key={b.band} className="grid grid-cols-[72px_1fr_92px] items-center gap-3 text-sm">
                    <span className="text-slate-600 tabular-nums">{b.band} €</span>
                    <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, rate * 100 * 4)}%` }} />
                    </span>
                    <span className="text-right text-xs text-slate-500 tabular-nums">
                      <strong className="text-slate-800">{pct(Number(b.booked), Number(b.sessions))}</strong> · {b.booked}/{b.sessions}
                    </span>
                  </div>
                );
              })}
              <p className="text-[11px] text-slate-400 pt-1">Çubuk ölçeği: tam dolu = %25 dönüşüm</p>
            </div>
          )}
        </div>

        {/* Cihaz / kaynak */}
        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3`}>Cihaz ve kaynak <span className="normal-case font-normal text-slate-400">· tıkla → süz</span></div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-slate-400 uppercase">
              <th className="py-1 font-medium">Cihaz</th><th className="font-medium">Kaynak</th><th className="font-medium text-right">Oturum</th>
              <th className="font-medium text-right">Rez.</th><th className="font-medium text-right">📞</th><th className="font-medium text-right">Oran</th>
            </tr></thead>
            <tbody>
              {data.breakdown.slice(0, 8).map((b, i) => (
                <tr key={i}
                  onClick={() => onDrill({ kind: 'device_source', device: b.device, source: b.source, label: `${b.device} · ${b.source}` })}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="py-1.5">{b.device}</td>
                  <td>{b.source === 'ads' ? <span className="text-amber-700">Ads</span> : 'organik'}</td>
                  <td className="text-right tabular-nums">{Number(b.sessions).toLocaleString('de-DE')}</td>
                  <td className="text-right tabular-nums">{b.booked}</td>
                  <td className="text-right tabular-nums">{b.called}</td>
                  <td className="text-right font-semibold tabular-nums">{pct(Number(b.booked), Number(b.sessions))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.variants.length > 1 && (
        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3`}>A/B varyantları</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] text-slate-400 uppercase">
              <th className="py-1 font-medium">Varyant</th><th className="font-medium">Oturum</th><th className="font-medium">Form açtı</th><th className="font-medium">Rezervasyon</th><th className="font-medium">Oran</th>
            </tr></thead>
            <tbody>
              {data.variants.map((v) => (
                <tr key={v.variant} className="border-t border-slate-100">
                  <td className="py-1.5">{v.variant}</td>
                  <td>{v.sessions}</td>
                  <td>{v.opened_form}</td>
                  <td>{v.booked}</td>
                  <td className="font-semibold">
                    {pct(Number(v.booked), Number(v.sessions))}
                    {Number(v.sessions) < 100 && <span className="text-[10px] text-amber-600 ml-1 font-normal">(örneklem küçük)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yarım kalan rezervasyonlar — /admin/booking-drafts
// Bu liste PAZARLAMA E-POSTASI için değildir (Almanya'da izinsiz e-posta riskli);
// admin görünürlüğü ve hangi güzergâhlarda kaybedildiğini görmek içindir.
// ---------------------------------------------------------------------------
export function DraftsPanel({ rows, onWatch }: { rows: DraftRow[]; onWatch: (sessionId: string) => void }) {
  const fmtAgoMin = (min: number) => {
    if (min < 60) return `${min} dk`;
    if (min < 1440) return `${Math.round(min / 60)} sa`;
    return `${Math.round(min / 1440)} gün`;
  };
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
        Müşterinin girdiği güzergâh ve gördüğü fiyat. Kişisel veri (ad/telefon/e-posta) saklanmaz —
        bu liste otomatik e-posta için değil, hangi güzergâhlarda kaybettiğini görmek içindir.
      </div>
      {rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">Tamamlanmamış taslak yok.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400 bg-slate-50">
                <th className="px-5 py-2 font-medium">Ne zaman</th><th className="font-medium">Güzergâh</th>
                <th className="font-medium text-right">Fiyat</th><th className="font-medium text-right pr-3">km</th>
                <th className="font-medium">Aşama</th><th className="font-medium">Cihaz</th><th className="font-medium">Kaynak</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((d) => (
                <tr key={d.session_id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                  <td className="px-5 py-2 whitespace-nowrap text-slate-500">{fmtAgoMin(Number(d.minutes_ago) || 0)} önce</td>
                  <td className="py-2 max-w-[420px]">
                    <span className="text-slate-800">{shortAddr(d.pickup)}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="text-slate-800">{shortAddr(d.dropoff)}</span>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap font-semibold tabular-nums">{d.price != null ? `${Number(d.price).toFixed(0)} €` : '—'}</td>
                  <td className="py-2 text-right whitespace-nowrap tabular-nums pr-3 text-slate-500">{d.distance_km != null ? Number(d.distance_km).toFixed(0) : '—'}</td>
                  <td className="py-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${d.last_stage === 'form' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                      {d.last_stage === 'form' ? 'Form' : 'Fiyat'}
                    </span>
                  </td>
                  <td className="py-2 whitespace-nowrap text-slate-500">{d.ua_device || '—'}{d.city ? ` · ${d.city}` : ''}</td>
                  <td className="py-2 whitespace-nowrap text-slate-500">{d.gclid ? 'Ads' : d.utm_campaign || 'organik'}</td>
                  <td className="py-2 pr-4 text-right">
                    <button onClick={() => onWatch(d.session_id)} className="text-xs text-violet-600 hover:text-violet-800 font-medium whitespace-nowrap">
                      İzle →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ayarlar — kayıt aç/kapa, örnekleme, otomatik saklama süresi, depolama, temizlik
// ---------------------------------------------------------------------------
export function SettingsPanel({
  token, stats, onDeleteOlder, onDeleteAll,
}: {
  token: string; stats: Stats | null; onDeleteOlder: (days: number) => void; onDeleteAll: () => void;
}) {
  const [s, setS] = useState<RecSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/admin/recordings/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setS)
      .catch(() => setErr('Ayarlar yüklenemedi'));
  }, [token]);

  const save = async (patch: Partial<RecSettings>) => {
    if (!s) return;
    setS({ ...s, ...patch });
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE}/admin/recordings/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error();
      setS(await r.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      setErr('Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const daily = (stats?.daily || []).slice().reverse();
  const maxBytes = Math.max(1, ...daily.map(d => Number(d.bytes) || 0));
  const avgDay = daily.length ? daily.reduce((a, d) => a + (Number(d.bytes) || 0), 0) / daily.length : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className={`${card} p-5 space-y-5`}>
        <div className="flex items-center justify-between">
          <div className={h3}>Kayıt ayarları</div>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            {saving ? <><Loader2 size={12} className="animate-spin" /> kaydediliyor</> : saved ? <span className="text-emerald-600">✓ kaydedildi</span> : null}
          </span>
        </div>
        {err && <div className="text-sm text-rose-600">{err}</div>}
        {!s ? <div className="text-sm text-slate-400">Yükleniyor…</div> : (
          <>
            <Row title="Session Replay kaydı" desc="Kapalıyken ziyaretçi verisi sunucuda saklanmaz. Mevcut kayıtlar silinmez.">
              <Switch on={!!s.enabled} onChange={(v) => save({ enabled: v ? 1 : 0 })} />
            </Row>
            <Row title={`Örnekleme: oturumların %${s.sample_pct}'i`} desc="Disk tasarrufu için yalnızca bir kısmını kaydet. Aynı oturum hep ya tamamen kaydedilir ya hiç.">
              <input
                type="range" min={5} max={100} step={5} value={s.sample_pct}
                onChange={(e) => setS({ ...s, sample_pct: Number(e.target.value) })}
                onMouseUp={(e) => save({ sample_pct: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => save({ sample_pct: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={(e) => save({ sample_pct: Number((e.target as HTMLInputElement).value) })}
                className="w-40 accent-violet-600"
                disabled={!s.enabled}
              />
            </Row>
            <Row title="Otomatik silme" desc="Seçilen günden eski kayıtlar her 6 saatte bir silinir.">
              <select
                value={s.retention_days}
                onChange={(e) => save({ retention_days: Number(e.target.value) })}
                className="text-sm rounded-lg border border-slate-200 px-2 py-1.5"
              >
                <option value={0}>Kapalı (hepsini sakla)</option>
                <option value={14}>14 günden eski</option>
                <option value={30}>30 günden eski</option>
                <option value={60}>60 günden eski</option>
                <option value={90}>90 günden eski</option>
                <option value={180}>180 günden eski</option>
              </select>
            </Row>
            <div className={`space-y-3 pl-3 border-l-2 ${s.retention_days ? 'border-violet-200' : 'border-slate-100 opacity-50'}`}>
              <Row title="⭐ Yıldızlı kayıtları koru" desc="Yıldızladığın kayıtlar otomatik silinmez.">
                <Switch on={!!s.keep_starred} onChange={(v) => save({ keep_starred: v ? 1 : 0 })} />
              </Row>
              <Row title="Rezervasyonlu oturumları koru" desc="Rezervasyonla biten oturumlar otomatik silinmez.">
                <Switch on={!!s.keep_booked} onChange={(v) => save({ keep_booked: v ? 1 : 0 })} />
              </Row>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              Şifre ve kart alanları maskelenir; diğer form alanları kayda girer. /admin sayfaları hiç kaydedilmez.
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`${h3} flex items-center gap-1.5`}><HardDrive size={13} /> Depolama · son 30 gün</div>
            <div className="text-xs text-slate-500">toplam <strong className="text-slate-800">{fmtBytes(Number(stats?.total_bytes) || 0)}</strong></div>
          </div>
          <div className="flex items-end gap-[3px] h-28">
            {daily.map((d) => (
              <div key={d.day} className="flex-1 group relative">
                <div className="w-full rounded-t bg-violet-300 group-hover:bg-violet-500 transition-colors"
                  style={{ height: `${Math.max(2, ((Number(d.bytes) || 0) / maxBytes) * 104)}px` }} />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 text-white text-[10px] px-1.5 py-0.5 z-10">
                  {new Date(d.day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · {d.sessions} kayıt · {fmtBytes(Number(d.bytes))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="Günlük ort." value={fmtBytes(avgDay)} />
            <Mini label="Aylık tahmin" value={fmtBytes(avgDay * 30)} />
            <Mini label="Kayıt başı" value={stats?.sessions ? fmtBytes((Number(stats.total_bytes) || 0) / stats.sessions) : '—'} />
          </div>
        </div>

        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3 flex items-center gap-1.5 text-rose-600`}><AlertTriangle size={13} /> Elle temizlik</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onDeleteOlder(30)} className="text-sm bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Trash2 size={14} /> 30 günden eskiyi sil <span className="text-xs opacity-70">(⭐ hariç)</span>
            </button>
            <button onClick={onDeleteAll} className="text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Trash2 size={14} /> Hepsini sil
            </button>
          </div>
        </div>

        <div className={`${card} p-5`}>
          <div className={`${h3} mb-3`}>Klavye kısayolları</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-600">
            {[
              ['Boşluk', 'Oynat / durdur'], ['← →', '5 sn (Shift: 30 sn)'], ['E', 'Sonraki önemli an'],
              ['N / P', 'Sonraki / önceki kayıt'], ['1–5', 'Hız 1×–16×'], ['S', 'Yıldızla'],
              ['F', 'Tam ekran'], ['/', 'Aramaya odaklan'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <kbd className="min-w-[2.2rem] text-center text-[11px] font-mono bg-slate-100 ring-1 ring-slate-200 rounded px-1.5 py-0.5">{k}</kbd>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-violet-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-sm font-semibold text-slate-800 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
