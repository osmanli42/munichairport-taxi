'use client';

// Rabatte-Tab: "Kişisel indirim (özür / teşekkür)" — tek seferlik kişisel kupon linki oluşturup
// müşteriye Bestätigung tasarımındaki HTML e-postayla gönderir. Stammkunde ve firma müşterileri de
// kullanabilir; otomatik indirimle birleşmez (büyük olan uygulanır).
// Backend: routes/promotions.ts (/admin/personal…), şablon: services/bookingEmailTemplates.ts → customerGutscheinEmail.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, Plus, Copy, Check, Send, Ban, X, Loader2 } from 'lucide-react';
import { personalGutscheinApi, PersonalGutschein, PersonalGutscheinInput, GutscheinReason } from '@/lib/api';
import { cn } from '@/lib/utils';

const REASONS: { key: GutscheinReason; label: string }[] = [
  { key: 'entschuldigung', label: 'Özür (Entschuldigung)' },
  { key: 'danke', label: 'Teşekkür (Dankeschön)' },
  { key: 'allgemein', label: 'Genel' },
];
const VALIDITY = [30, 60, 90, 180];
const LANGS: { key: 'de' | 'en' | 'tr'; label: string }[] = [
  { key: 'de', label: 'Deutsch' }, { key: 'en', label: 'English' }, { key: 'tr', label: 'Türkçe' },
];

const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const dt = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const errOf = (e: any, fb: string) => e?.response?.data?.error || e?.message || fb;

export interface GutscheinPrefill { name?: string; email?: string; lang?: string }

/** Formular + Live-Vorschau; auch aus dem Buchungsdetail (Buchungen) als Modal nutzbar. */
export function PersonalGutscheinForm({ prefill, onDone, onCancel }: {
  prefill?: GutscheinPrefill;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<PersonalGutscheinInput>({
    name: prefill?.name || '',
    email: prefill?.email || '',
    lang: (['de', 'en', 'tr'].includes(prefill?.lang || '') ? prefill!.lang : 'de') as 'de' | 'en' | 'tr',
    percent: 10,
    valid_days: 90,
    reason: 'entschuldigung',
    subject: '',
    message: '',
    note: '',
  });
  const [customDate, setCustomDate] = useState(false);
  const [touched, setTouched] = useState(false); // Betreff/Text von Hand geändert
  const [preview, setPreview] = useState<{ subject: string; html: string; end_date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ code: string; url: string; end_date: string; sent: boolean; sendError: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const textKey = useRef('');

  const set = (p: Partial<PersonalGutscheinInput>) => { setF(prev => ({ ...prev, ...p })); setConfirm(false); };

  // Vorlage (Betreff + Text) neu laden, wenn Anlass/Sprache wechseln oder % sich ändert (solange nicht bearbeitet)
  useEffect(() => {
    const key = `${f.reason}|${f.lang}`;
    const reasonChanged = key !== textKey.current;
    if (!reasonChanged && touched) return;
    textKey.current = key;
    personalGutscheinApi.preview({ ...f, subject: '', message: '' })
      .then(d => { setF(prev => ({ ...prev, subject: d.defaults.subject, message: d.defaults.message })); setTouched(false); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.reason, f.lang, f.percent]);

  // Vorschau (entprellt)
  useEffect(() => {
    if (!f.message) return;
    const t = setTimeout(() => {
      personalGutscheinApi.preview(f)
        .then(d => { setPreview(d); setErr(''); })
        .catch(e => setErr(errOf(e, 'Önizleme yüklenemedi')));
    }, 350);
    return () => clearTimeout(t);
  }, [f]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());

  const create = async (send: boolean) => {
    setBusy(true); setErr('');
    try {
      const r = await personalGutscheinApi.create({ ...f, send });
      setResult(r);
      onDone();
    } catch (e) {
      setErr(errOf(e, 'Kaydedilemedi'));
    }
    setBusy(false); setConfirm(false);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  if (result) {
    return (
      <div className="space-y-3">
        <div className={cn('rounded-xl border px-4 py-3 text-sm', result.sent ? 'bg-green-50 border-green-200 text-green-800' : result.sendError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700')}>
          {result.sent ? <>✓ E-posta gönderildi: <b>{f.email}</b> (kopyası info@ adresine)</>
            : result.sendError ? <>Kupon oluşturuldu ama e-posta gönderilemedi: {result.sendError}</>
              : <>Kupon oluşturuldu — linki kopyalayıp kendin gönderebilirsin.</>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-bold bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded">{result.code}</code>
          <span className="text-xs text-gray-500">{dm(result.end_date)} tarihine kadar, bir kez</span>
        </div>
        <div className="flex gap-2">
          <input readOnly value={result.url} className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
          <button onClick={() => copy(result.url)} className="flex items-center gap-1.5 text-sm font-semibold border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg">
            {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />} Kopyala
          </button>
        </div>
        <div className="flex justify-end">
          <button onClick={onCancel || (() => setResult(null))} className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5">Kapat</button>
        </div>
      </div>
    );
  }

  const input = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';
  const label = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Ad</label>
            <input className={input} value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Max Mustermann" />
          </div>
          <div>
            <label className={label}>E-posta *</label>
            <input className={cn(input, f.email && !emailOk && 'border-red-300')} value={f.email} onChange={e => set({ email: e.target.value })} placeholder="kunde@example.com" />
          </div>
        </div>

        <div>
          <label className={label}>Sebep</label>
          <div className="flex gap-1.5 flex-wrap">
            {REASONS.map(r => (
              <button key={r.key} onClick={() => set({ reason: r.key })}
                className={cn('text-sm px-3 py-1.5 rounded-lg border', f.reason === r.key ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Dil</label>
            <select className={input} value={f.lang} onChange={e => set({ lang: e.target.value as any })}>
              {LANGS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>İndirim %</label>
            <input type="number" min={1} max={30} className={input} value={f.percent}
              onChange={e => set({ percent: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <label className={label}>Geçerlilik</label>
          <div className="flex gap-1.5 flex-wrap items-center">
            {VALIDITY.map(d => (
              <button key={d} onClick={() => { setCustomDate(false); set({ valid_days: d, end_date: undefined }); }}
                className={cn('text-sm px-3 py-1.5 rounded-lg border', !customDate && f.valid_days === d ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                {d} gün
              </button>
            ))}
            <button onClick={() => setCustomDate(true)}
              className={cn('text-sm px-3 py-1.5 rounded-lg border', customDate ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
              Tarih seç
            </button>
            {customDate && (
              <input type="date" className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                value={f.end_date || ''} onChange={e => set({ end_date: e.target.value || undefined })} />
            )}
          </div>
          {preview && <p className="text-xs text-gray-500 mt-1">Son gün: {dm(preview.end_date)} · tek kullanımlık</p>}
        </div>

        <div>
          <label className={label}>E-posta konusu</label>
          <input className={input} value={f.subject} onChange={e => { setTouched(true); set({ subject: e.target.value }); }} />
        </div>
        <div>
          <label className={label}>Mesaj (müşteriye; boş satır = yeni paragraf)</label>
          <textarea rows={5} className={input} value={f.message} onChange={e => { setTouched(true); set({ message: e.target.value }); }} />
        </div>
        <div>
          <label className={label}>İç not (müşteri görmez)</label>
          <input className={input} value={f.note} onChange={e => set({ note: e.target.value })} placeholder="ör. 12.10. şoför 20 dk geç kaldı" />
        </div>

        {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

        {confirm ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm space-y-2">
            <p className="text-amber-900"><b>{f.email}</b> adresine %{f.percent} kupon e-postası gönderilsin mi?</p>
            <div className="flex gap-2">
              <button onClick={() => create(true)} disabled={busy}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Evet, gönder
              </button>
              <button onClick={() => setConfirm(false)} className="text-sm font-semibold text-gray-600 px-3 py-1.5">Vazgeç</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setConfirm(true)} disabled={busy || !emailOk || !f.message?.trim()}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50">
              <Send size={15} /> E-postayı gönder
            </button>
            <button onClick={() => create(false)} disabled={busy}
              className="text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg disabled:opacity-50">
              Sadece link oluştur
            </button>
            {onCancel && <button onClick={onCancel} className="text-sm font-semibold text-gray-500 px-3 py-2">Vazgeç</button>}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Önizleme{preview && <span className="font-normal text-gray-500"> · Konu: {preview.subject}</span>}</p>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-[#eef1f5]">
          {preview
            ? <iframe title="E-posta önizleme" srcDoc={preview.html} className="w-full h-[640px] bg-white" sandbox="" />
            : <div className="h-[640px] flex items-center justify-center text-gray-400 text-sm"><Loader2 size={18} className="animate-spin" /></div>}
        </div>
      </div>
    </div>
  );
}

/** Buchungsdetail: kleiner Button, öffnet das Formular vorbelegt mit dem Kunden. */
export function GutscheinButton({ prefill }: { prefill: GutscheinPrefill }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Kişisel indirim kuponu gönder"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg">
        <Gift size={14} /> Gutschein
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl my-6 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900 flex items-center gap-2"><Gift size={18} className="text-amber-600" /> Kişisel indirim kuponu</p>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <PersonalGutscheinForm prefill={prefill} onDone={() => {}} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

const STATUS: Record<PersonalGutschein['status'], { label: string; cls: string }> = {
  open: { label: 'açık', cls: 'bg-green-50 text-green-700' },
  used: { label: 'kullanıldı', cls: 'bg-violet-50 text-violet-700' },
  expired: { label: 'süresi doldu', cls: 'bg-gray-100 text-gray-500' },
  inactive: { label: 'kapatıldı', cls: 'bg-gray-100 text-gray-500' },
};

export default function PersonalLinkPanel() {
  const [list, setList] = useState<PersonalGutschein[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<{ id: number; action: 'send' | 'deactivate' } | null>(null);

  const load = useCallback(async () => {
    try { setList(await personalGutscheinApi.list()); setErr(''); } catch (e) { setErr(errOf(e, 'Liste yüklenemedi')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (g: PersonalGutschein, action: 'send' | 'deactivate') => {
    setBusyId(g.id); setConfirmId(null);
    try {
      if (action === 'send') await personalGutscheinApi.send(g.id);
      else await personalGutscheinApi.deactivate(g.id);
      await load();
    } catch (e) { setErr(errOf(e, 'İşlem başarısız')); }
    setBusyId(null);
  };

  const copy = async (g: PersonalGutschein) => {
    try { await navigator.clipboard.writeText(g.url); setCopiedId(g.id); setTimeout(() => setCopiedId(null), 1500); } catch { /* ignore */ }
  };

  const open = list?.filter(g => g.status === 'open').length ?? 0;
  const used = list?.filter(g => g.status === 'used') ?? [];

  return (
    <div className="border border-amber-200 rounded-2xl overflow-hidden bg-white">
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border bg-amber-50 border-amber-200 flex items-center justify-center flex-shrink-0">
            <Gift size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Kişisel indirim (özür / teşekkür)</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Tek bir müşteriye tek seferlik kupon linki, sitenin rezervasyon e-postası tasarımıyla gönderilir.
              Stammkunde ve firma müşterileri de kullanabilir; otomatik indirimle birleşmez, büyük olan uygulanır.
            </p>
          </div>
        </div>
        {!formOpen && (
          <button onClick={() => setFormOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg">
            <Plus size={15} /> Yeni kupon
          </button>
        )}
      </div>

      {formOpen && (
        <div className="border-t border-gray-100 px-5 py-4">
          <PersonalGutscheinForm onDone={load} onCancel={() => setFormOpen(false)} />
        </div>
      )}

      {err && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

      {list && list.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">
            Kuponlar
            <span className="ml-2 font-normal text-gray-500">
              {open} açık · {used.length} kullanıldı{used.length > 0 && ` · ${eur(used.reduce((s, g) => s + (g.booking?.discount || 0), 0))} indirim`}
            </span>
          </p>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {list.map(g => (
              <div key={g.id} className="px-3 py-2.5 flex items-start gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 truncate">
                    <span className="font-semibold">{g.name || '—'}</span>
                    {g.email && <span className="text-gray-500"> · {g.email}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    <code className="font-semibold text-gray-700">{g.code}</code> · %{g.percent} · {dm(g.end_date)} tarihine kadar
                    {g.sent_at ? ` · gönderildi ${dt(g.sent_at)}` : ' · gönderilmedi'}
                    {g.note && <> · <i>{g.note}</i></>}
                  </p>
                  {g.booking && (
                    <p className="text-xs text-violet-700 mt-0.5">
                      → {g.booking.booking_number} · {g.booking.pickup && dm(g.booking.pickup.slice(0, 10))} · −{eur(g.booking.discount)} · {eur(g.booking.price)}
                      {g.booking.status === 'cancelled' && ' · storno'}
                    </p>
                  )}
                </div>
                <span className={cn('flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full', STATUS[g.status].cls)}>{STATUS[g.status].label}</span>
                <div className="flex-shrink-0 flex items-center gap-1">
                  <button onClick={() => copy(g)} title="Linki kopyala" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                    {copiedId === g.id ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                  </button>
                  {g.status === 'open' && (
                    confirmId?.id === g.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => act(g, confirmId.action)} className="font-semibold text-white bg-primary-600 px-2 py-1 rounded">
                          {confirmId.action === 'send' ? 'Gönder' : 'Kapat'}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-gray-500 px-1">×</button>
                      </span>
                    ) : busyId === g.id ? <Loader2 size={15} className="animate-spin text-gray-400 m-1.5" /> : (
                      <>
                        {g.email && (
                          <button onClick={() => setConfirmId({ id: g.id, action: 'send' })} title="E-postayı (tekrar) gönder" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                            <Send size={15} />
                          </button>
                        )}
                        <button onClick={() => setConfirmId({ id: g.id, action: 'deactivate' })} title="Kuponu kapat" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                          <Ban size={15} />
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
