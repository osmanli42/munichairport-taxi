'use client';

// Admin → Marketing: oben der Kampagnenkalender (Ferien, Feiertage, Messen …), darunter der
// Editor in drei Schritten — Empfänger (Segmente), Inhalt (DE/EN/TR, nur Grüße oder Grüße +
// persönlicher Gutschein-Link), Senden — mit Live-Vorschau rechts; unten der Verlauf.
// Backend: routes/admin-marketing.ts, services/marketingCalendar.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Users, PenLine, Send, Gift, Heart, Upload, FileText, Search, Loader2, X, Check, Code2, Type, Trash2, ShieldCheck, LayoutTemplate } from 'lucide-react';
import { marketingApi, MkCalendar, MkCampaign, MkCustomer, MkLang, MkMode, MkOccasion, MkSendBody, MkSendText, MkTemplate } from '@/lib/api';
import { cn } from '@/lib/utils';
import CampaignCalendar from './CampaignCalendar';
import CampaignHistory from './CampaignHistory';
import { Contact, LANG_FLAG, LANG_LABEL, SEGMENTS, SegmentKey, SEGMENT_LABEL, dmy, emailDomain, fixMacRoman, inSegment, isCompanyDomain, loadContacts, parseCsv, parseIcs, pct, saveContacts } from './helpers';

const LANGS: MkLang[] = ['de', 'en', 'tr'];
const OCCASION_KEY = 'mt_marketing_occasion'; // vom Dashboard („Handlungsbedarf“) gesetzt
const errOf = (e: any, fb: string) => e?.response?.data?.error || e?.message || fb;

interface TextState { subject: string; message: string; badge: string; buttonText: string; buttonUrl: string; offer: string }
const EMPTY: TextState = { subject: '', message: '', badge: '', buttonText: '', buttonUrl: '', offer: '' };

type Row = { email: string; name: string; lang: MkLang; isBusiness: boolean; bookingCount: number; lastBooking: string | null; optedOut: boolean; contact: boolean; firm: boolean };

export default function MarketingTab({ onRemindersChange }: { onRemindersChange?: () => void }) {
  const [cal, setCal] = useState<MkCalendar | null>(null);
  const [customers, setCustomers] = useState<MkCustomer[] | null>(null);
  const [optouts, setOptouts] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<MkCampaign[]>([]);
  const [loadErr, setLoadErr] = useState('');

  // Editor
  const [occasion, setOccasion] = useState<MkOccasion | null>(null);
  const [mode, setMode] = useState<MkMode>('greeting');
  const [percent, setPercent] = useState(10);
  const [validDays, setValidDays] = useState(30);
  const [maxAmount, setMaxAmount] = useState<number | null>(null);
  const [segment, setSegment] = useState<SegmentKey>('all');
  const [withContacts, setWithContacts] = useState(false);
  // Web-Kunden sind vorausgewählt (abwählen = excluded); Kalender/CSV-Kontakte nur einzeln gewählt (picked)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [srcFilter, setSrcFilter] = useState<'all' | 'web' | 'contact'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'privat' | 'firma' | 'selected'>('all');
  const [showMax, setShowMax] = useState(300);
  const [confirmClear, setConfirmClear] = useState(false);
  const [search, setSearch] = useState('');
  const [langMode, setLangMode] = useState<'customer' | MkLang>('customer');
  const [tab, setTab] = useState<MkLang>('de');
  const [texts, setTexts] = useState<Record<MkLang, TextState>>({ de: EMPTY, en: EMPTY, tr: EMPTY });
  const [dirty, setDirty] = useState<Record<MkLang, boolean>>({ de: false, en: false, tr: false });
  const [editor, setEditor] = useState<'text' | 'html'>('text');
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewErr, setPreviewErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<'' | 'send' | 'test'>('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [c, cu, h, pk] = await Promise.all([marketingApi.calendar(), marketingApi.customers(), marketingApi.campaigns(), marketingApi.picked().catch(() => [] as Array<{ email: string; name: string | null }>)]);
      setCal(c); setCustomers(cu.customers); setOptouts(new Set(cu.optouts)); setCampaigns(h); setLoadErr('');
      // Gespeicherte Auswahl: auch Kontakte, die in diesem Browser (noch) nicht geladen sind, in die Liste übernehmen
      setPicked(new Set(pk.map(p => p.email)));
      setContacts(prev => {
        const have = new Set(prev.map(x => x.email));
        const extra = pk.filter(p => !have.has(p.email)).map(p => ({ email: p.email, name: p.name || '', source: 'ics' as const }));
        if (!extra.length) return prev;
        const next = [...prev, ...extra];
        saveContacts(next);
        return next;
      });
    } catch (e) { setLoadErr(errOf(e, 'Marketing verileri yüklenemedi')); }
  }, []);
  const reloadCalendar = useCallback(async () => {
    try { setCal(await marketingApi.calendar()); setCampaigns(await marketingApi.campaigns()); } catch { /* ignore */ }
    onRemindersChange?.();
  }, [onRemindersChange]);
  useEffect(() => { setContacts(loadContacts()); load(); }, [load]);

  // ---- Vorlagen ----
  const build = useCallback((o: MkOccasion | null, m: MkMode, p: number, l: MkLang, offer: MkCalendar['offer'] | undefined): TextState => {
    const src = o?.texts[l];
    const off = offer?.[l];
    const pp = pct(p, l);
    return {
      subject: (src?.subject || '') + (m === 'discount' && src?.subject && off ? off.subject.replace('{p}', pp) : ''),
      message: src?.message || '',
      badge: src?.badge || '',
      buttonText: src?.button || '', buttonUrl: src?.url || '',
      offer: off ? off.message.replace('{p}', pp) : '',
    };
  }, []);

  const prepare = useCallback((o: MkOccasion | null) => {
    setOccasion(o);
    const m = o?.mode || 'greeting';
    const p = o?.percent || 10;
    setMode(m); setPercent(p); setValidDays(o?.validDays || 30); setMaxAmount(o?.maxAmount ?? null);
    if (o) { setSegment(o.segment); setWithContacts(false); setExcluded(new Set()); setSrcFilter('all'); setTypeFilter('all'); }
    setTexts({ de: build(o, m, p, 'de', cal?.offer), en: build(o, m, p, 'en', cal?.offer), tr: build(o, m, p, 'tr', cal?.offer) });
    setDirty({ de: false, en: false, tr: false });
    setEditor('text'); setResult(null); setConfirm(false);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [build, cal?.offer]);

  // Vorlage ohne Datum (z. B. „Neue Website“) wie einen Anlass öffnen
  const prepareTemplate = (t: MkTemplate) => {
    const today = new Date().toISOString().slice(0, 10);
    prepare({
      id: t.id, key: `${t.id}|${today.slice(0, 4)}`, year: +today.slice(0, 4), name: t.name, group: 'custom',
      date: today, end: null, remindFrom: today, remindUntil: today, status: 'upcoming', sentAt: null, campaignId: null, daysLeft: 0,
      enabled: true, leadDays: 0, afterDays: 0, isDefault: true, texts: t.texts, ...t.defaults,
    });
  };

  // Anlass vom Dashboard öffnen
  useEffect(() => {
    if (!cal) return;
    let id: string | null = null;
    try { id = sessionStorage.getItem(OCCASION_KEY); sessionStorage.removeItem(OCCASION_KEY); } catch { /* ignore */ }
    const o = id ? cal.occasions.find(x => x.id === id) : null;
    if (o) prepare(o);
    else if (!occasion && texts.de.offer === '') setTexts({ de: build(null, 'greeting', 10, 'de', cal.offer), en: build(null, 'greeting', 10, 'en', cal.offer), tr: build(null, 'greeting', 10, 'tr', cal.offer) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cal]);

  // Modus/Prozent geändert → unveränderte Sprachen neu aus der Vorlage
  const regen = (m: MkMode, p: number) => {
    setTexts(prev => {
      const next = { ...prev };
      for (const l of LANGS) {
        const fresh = build(occasion, m, p, l, cal?.offer);
        next[l] = dirty[l] ? { ...prev[l], offer: fresh.offer, subject: prev[l].subject } : { ...fresh, buttonText: prev[l].buttonText, buttonUrl: prev[l].buttonUrl };
      }
      return next;
    });
  };
  const setText = (l: MkLang, patch: Partial<TextState>) => {
    setTexts(prev => ({ ...prev, [l]: { ...prev[l], ...patch } }));
    setDirty(prev => ({ ...prev, [l]: true }));
  };

  // ---- Empfänger ----
  const yearAgo = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); }, []);
  const pool: Row[] = useMemo(() => {
    const base = (customers || []).filter(c => inSegment(c, segment, yearAgo)).map(c => ({ ...c, contact: false, firm: c.isBusiness || isCompanyDomain(c.email) }));
    const known = new Set((customers || []).map(c => c.email));
    // ausgewählte „Eski site“-Kontakte gehören immer dazu; die übrigen nur, wenn eingeblendet
    const extra = contacts.filter(c => !known.has(c.email) && (withContacts || picked.has(c.email))).map(c => ({
      email: c.email, name: c.name || '', lang: 'de' as MkLang, isBusiness: false, bookingCount: 0, lastBooking: null, optedOut: optouts.has(c.email), contact: true,
      firm: isCompanyDomain(c.email),
    }));
    return [...base, ...extra];
  }, [customers, segment, withContacts, contacts, optouts, yearAgo, picked]);
  const isOn = useCallback((r: Row) => !r.optedOut && (r.contact ? picked.has(r.email) : !excluded.has(r.email)), [picked, excluded]);
  const selected = useMemo(() => pool.filter(isOn), [pool, isOn]);
  const setOn = (rows: Row[], on: boolean) => {
    const web = rows.filter(r => !r.contact).map(r => r.email);
    const con = rows.filter(r => r.contact).map(r => r.email);
    if (web.length) setExcluded(prev => { const n = new Set(prev); web.forEach(e => (on ? n.delete(e) : n.add(e))); return n; });
    if (con.length) {
      setPicked(prev => { const n = new Set(prev); con.forEach(e => (on ? n.add(e) : n.delete(e))); return n; });
      const rows = rows_(con);
      marketingApi.savePicked(on ? { add: rows } : { remove: con })
        .catch(e => setResult({ ok: false, text: errOf(e, 'Seçim kaydedilemedi') }));
    }
  };
  const rows_ = (emails: string[]) => { const m = new Map(contacts.map(c => [c.email, c.name || ''])); return emails.map(e => ({ email: e, name: m.get(e) || '' })); };
  const clearPicked = async () => {
    try { await marketingApi.clearPicked(); setPicked(new Set()); setConfirmClear(false); }
    catch (e) { setResult({ ok: false, text: errOf(e, 'Seçim temizlenemedi') }); }
  };
  const langOf = (r: Row): MkLang => (langMode === 'customer' ? r.lang : langMode);
  const langCount = useMemo(() => {
    const c: Record<MkLang, number> = { de: 0, en: 0, tr: 0 };
    for (const r of selected) c[langMode === 'customer' ? r.lang : langMode]++;
    return c;
  }, [selected, langMode]);
  const usedLangs = LANGS.filter(l => langCount[l] > 0);
  const matchSrc = (r: Row) => srcFilter === 'all' || (srcFilter === 'contact' ? r.contact : !r.contact);
  const matchType = (r: Row) => typeFilter === 'all' || (typeFilter === 'firma' ? r.firm : typeFilter === 'privat' ? !r.firm : isOn(r));
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool.filter(r => matchSrc(r) && matchType(r) && (!q || r.email.includes(q) || r.name.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, search, srcFilter, typeFilter, isOn]);
  const countBy = (f: (r: Row) => boolean) => pool.filter(f).length;
  const segCount = (k: SegmentKey) => (customers || []).filter(c => !c.optedOut && inSegment(c, k, yearAgo)).length;
  const contactsNew = useMemo(() => { const known = new Set((customers || []).map(c => c.email)); return contacts.filter(c => !known.has(c.email)).length; }, [customers, contacts]);

  const importFile = async (file: File, kind: 'ics' | 'csv') => {
    const text = await file.text();
    const parsed = kind === 'ics' ? parseIcs(text) : parseCsv(text);
    const map = new Map(contacts.map(c => [c.email, c]));
    for (const c of parsed) if (!map.has(c.email) || (!map.get(c.email)!.name && c.name)) map.set(c.email, c);
    const list = Array.from(map.values());
    setContacts(list); saveContacts(list); setWithContacts(true);
    setResult({ ok: true, text: `${parsed.length} kişi ${kind === 'ics' ? 'takvimden' : 'listeden'} eklendi (toplam ${list.length}).` });
  };

  // ---- Senden ----
  const discount = mode === 'discount' ? { percent, validDays, maxAmount } : null;
  const composed = (l: MkLang): MkSendText => {
    const t = texts[l];
    return {
      subject: t.subject, badge: t.badge || undefined, buttonText: t.buttonText || undefined, buttonUrl: t.buttonUrl || undefined,
      message: mode === 'discount' && t.offer ? `${t.message}\n\n${t.offer}` : t.message,
    };
  };
  const body = (langs: MkLang[]): MkSendBody => ({
    occasion_id: occasion?.id || null, occasion_year: occasion?.year || null,
    texts: Object.fromEntries(langs.map(l => [l, composed(l)])),
    isHtml: editor === 'html', html: editor === 'html' ? html : undefined,
    discount, langMode,
  });
  const missingText = usedLangs.filter(l => !texts[l].subject.trim() || (editor === 'text' && !texts[l].message.trim()));

  // Live-Vorschau (entprellt)
  useEffect(() => {
    const t = texts[tab];
    if (editor === 'text' ? !t.message.trim() && !t.subject.trim() : !html.trim()) { setPreview(null); return; }
    const h = setTimeout(() => {
      marketingApi.preview({ ...body([tab]), lang: tab, name: 'Max Mustermann' })
        .then(p => { setPreview(p); setPreviewErr(''); })
        .catch(e => setPreviewErr(errOf(e, 'Önizleme yüklenemedi')));
    }, 400);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, texts, mode, percent, validDays, maxAmount, editor, html]);

  const sendTest = async () => {
    setBusy('test'); setResult(null);
    try {
      const r = await marketingApi.test({ ...body([tab]), lang: tab });
      setResult({ ok: true, text: `Test e-postası (${LANG_LABEL[tab]}) ${r.to} adresine gönderildi.` });
    } catch (e) { setResult({ ok: false, text: errOf(e, 'Test gönderilemedi') }); }
    setBusy('');
  };
  const send = async () => {
    setBusy('send'); setResult(null); setConfirm(false);
    try {
      const r = await marketingApi.send({ ...body(usedLangs), recipients: selected.map(x => ({ email: x.email, name: x.name || undefined, lang: x.lang })) });
      setResult({ ok: r.failed === 0, text: `${r.sent} kişiye gönderildi${r.failed ? `, ${r.failed} hata` : ''}${r.skippedOptout ? ` · ${r.skippedOptout} abonelikten çıkmış kişi atlandı` : ''}${r.codes ? ` · ${r.codes} kişisel indirim linki oluşturuldu` : ''}${r.dryRun ? ' (DENEME MODU – gerçek gönderim yok)' : ''}.` });
      await reloadCalendar();
    } catch (e) { setResult({ ok: false, text: errOf(e, 'Gönderim başarısız') }); }
    setBusy('');
  };

  const names = useMemo(() => Object.fromEntries([...(cal?.occasions || []), ...(cal?.templates || [])].map(o => [o.id, o.name])), [cal]);
  const input = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';
  const label = 'block text-xs font-semibold text-gray-600 mb-1';
  const step = (n: number, title: string, Icon: typeof Mail, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">{n}</span>
        <p className="font-bold text-gray-900 flex items-center gap-1.5"><Icon size={16} className="text-gray-400" /> {title}</p>
      </div>
      {extra}
    </div>
  );

  if (loadErr) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{loadErr}</div>;
  if (!cal || !customers) return <div className="flex items-center gap-2 text-gray-500 text-sm py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Yükleniyor…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Marketing</h2>
          <p className="text-sm text-gray-500">Müşterilere tebrik ve kampanya e-postası · isteğe bağlı kişisel indirim linki</p>
        </div>
        <p className="text-xs text-gray-500 flex items-center gap-1.5 max-w-md"><ShieldCheck size={14} className="text-green-600 shrink-0" />
          Her e-postaya abonelikten çıkma linki otomatik eklenir (UWG §7). Çıkanlara bir daha gönderilmez — şu an {optouts.size} kişi.</p>
      </div>

      <CampaignCalendar occasions={cal.occasions} remindersEnabled={cal.remindersEnabled} selectedId={occasion?.key || null}
        onPrepare={prepare} onChanged={reloadCalendar} sourceErrors={cal.sourceErrors} />

      {cal.templates?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3.5 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900"><LayoutTemplate size={16} className="text-gray-400" /> Hazır şablonlar</span>
          {cal.templates.map(t => (
            <button key={t.id} onClick={() => prepareTemplate(t)}
              className={cn('text-sm font-semibold px-3 py-1.5 rounded-lg border', occasion?.id === t.id ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
              {t.texts.de.badge.split(' ')[0]} {t.name}
            </button>
          ))}
          <span className="text-xs text-gray-400">Tarihten bağımsız, istediğin zaman gönderilir</span>
        </div>
      )}

      <div ref={editorRef} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-5 scroll-mt-24">
        <div className="space-y-5 min-w-0">
          {/* Kopf: Anlass + Modus */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kampanya</p>
                <p className="text-lg font-bold text-gray-900">{occasion ? `${occasion.texts.de.badge.split(' ')[0]} ${occasion.name}${occasion.id.startsWith('tpl-') ? '' : ` · ${dmy(occasion.date)}`}` : 'Serbest e-posta'}</p>
              </div>
              {occasion && <button onClick={() => prepare(null)} className="text-xs font-semibold text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"><X size={13} /> Anlası kaldır</button>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([['greeting', 'Sadece tebrik', 'Selam / hatırlatma, kupon yok', Heart], ['discount', 'Tebrik + indirim', 'Her alıcıya tek seferlik kişisel link', Gift]] as const).map(([m, t, h, Icon]) => (
                <button key={m} onClick={() => { setMode(m); regen(m, percent); }}
                  className={cn('text-left rounded-xl border-2 px-4 py-3 transition', mode === m ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}>
                  <p className="font-bold text-gray-900 flex items-center gap-2"><Icon size={16} className={mode === m ? 'text-primary-600' : 'text-gray-400'} /> {t}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{h}</p>
                </button>
              ))}
            </div>
            {mode === 'discount' && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div><label className={label}>İndirim %</label>
                  <input type="number" min={1} max={30} className={input} value={percent} onChange={e => { const p = Number(e.target.value); setPercent(p); if (p >= 1 && p <= 30) regen('discount', p); }} /></div>
                <div><label className={label}>Geçerlilik (gün)</label>
                  <input type="number" min={1} max={365} className={input} value={validDays} onChange={e => setValidDays(Number(e.target.value))} /></div>
                <div><label className={label}>En fazla € (isteğe bağlı)</label>
                  <input type="number" min={0} className={input} value={maxAmount ?? ''} placeholder="sınırsız" onChange={e => setMaxAmount(e.target.value ? Number(e.target.value) : null)} /></div>
                <p className="col-span-3 text-xs text-gray-500">Her alıcıya ayrı, tek kullanımlık link. Stammkunde ve firmalar da kullanabilir; otomatik indirimle birleşmez, büyük olan uygulanır.</p>
              </div>
            )}
          </div>

          {/* 1 Empfänger */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            {step(1, 'Alıcılar', Users, <span className="text-sm font-bold text-primary-700">{selected.length.toLocaleString('de-DE')} kişi seçili</span>)}
            <div className="flex flex-wrap gap-1.5">
              {SEGMENTS.map(s => (
                <button key={s.key} title={segment === s.key ? 'Tekrar tıkla: kaldır' : s.hint} onClick={() => { setSegment(segment === s.key ? 'none' : s.key); setExcluded(new Set()); }}
                  className={cn('text-xs font-semibold px-3 py-1.5 rounded-full border', segment === s.key ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
                  {s.label} <span className={segment === s.key ? 'text-white/70' : 'text-gray-400'}>{segCount(s.key)}</span>
                  {segment === s.key && <span className="ml-1 text-white/80">✕</span>}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {segment === 'none'
                ? 'Web müşterisi seçili değil — sadece aşağıda işaretlediklerin gönderilir.'
                : 'Seçili gruba tekrar tıklarsan kaldırılır.'}
            </p>
            <div className={cn('mt-3 rounded-xl border px-3 py-2.5', withContacts ? 'border-primary-200 bg-primary-50/40' : 'border-gray-200')}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input type="checkbox" checked={withContacts} onChange={e => { setWithContacts(e.target.checked); if (e.target.checked) setSrcFilter('contact'); else setSrcFilter('all'); }} />
                  Eski site müşterilerini listede göster <span className="text-gray-400 font-normal">(takvim/CSV · {contactsNew} kişi)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold border border-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-white">
                    <Upload size={13} /> .ics<input type="file" accept=".ics,text/calendar" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f, 'ics'); e.target.value = ''; }} />
                  </label>
                  <label className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold border border-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-white">
                    <FileText size={13} /> CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f, 'csv'); e.target.value = ''; }} />
                  </label>
                  {contacts.length > 0 && (
                    <button title="Takvim/CSV listesini temizle (seçtiklerin kalır)" onClick={() => { const keep = contacts.filter(c => picked.has(c.email)); setContacts(keep); saveContacts(keep); setWithContacts(false); }} className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-white"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              {withContacts && (
                <p className="mt-1.5 text-xs text-gray-500">Eski sitenden online rezervasyon yapan müşteriler. Seçili gelmezler — aşağıdan arayıp tek tek ya da filtreyle seç. Seçimin kaydedilir; sayfayı kapatsan da başka bilgisayardan açsan da kalır.</p>
              )}
              {picked.size > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white border border-primary-100 px-3 py-2">
                  <span className="text-sm text-gray-800"><b>{picked.size.toLocaleString('de-DE')}</b> eski site müşterisi seçili ve kayıtlı</span>
                  {confirmClear ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-600">Hepsi seçimden çıkarılsın mı?</span>
                      <button onClick={clearPicked} className="font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-md">Evet, kaldır</button>
                      <button onClick={() => setConfirmClear(false)} className="text-gray-500 px-1">Vazgeç</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => { setWithContacts(true); setSrcFilter('contact'); setTypeFilter('selected'); }} className="text-xs font-semibold text-primary-700 border border-primary-200 px-2.5 py-1 rounded-md hover:bg-primary-50">Seçilenleri göster</button>
                      <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 border border-red-200 px-2.5 py-1 rounded-md hover:bg-red-50"><Trash2 size={12} /> Seçilenlerin hepsini kaldır</button>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className={cn(input, 'pl-8')} placeholder="Ad veya e-posta ara" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button onClick={() => setOn(visible, true)} className="text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap">Görünenleri seç ({visible.length})</button>
              <button onClick={() => setOn(visible, false)} className="text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap">Kaldır</button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs">
              {withContacts && ([['all', 'Tümü', () => true], ['web', 'Web müşterileri', (r: Row) => !r.contact], ['contact', 'Eski site', (r: Row) => r.contact]] as const).map(([k, l, f]) => (
                <button key={k} onClick={() => { setSrcFilter(k); setShowMax(300); }}
                  className={cn('font-semibold px-2.5 py-1 rounded-full border', srcFilter === k ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {l} <span className={srcFilter === k ? 'text-white/60' : 'text-gray-400'}>{countBy(f)}</span>
                </button>
              ))}
              {withContacts && <span className="w-px h-4 bg-gray-200 mx-1" />}
              {([['all', 'Hepsi', () => true], ['privat', 'Özel kişiler', (r: Row) => matchSrc(r) && !r.firm], ['firma', 'Firmalar', (r: Row) => matchSrc(r) && r.firm], ['selected', 'Sadece seçililer', (r: Row) => matchSrc(r) && isOn(r)]] as const).map(([k, l, f]) => (
                <button key={k} onClick={() => { setTypeFilter(k); setShowMax(300); }}
                  className={cn('font-semibold px-2.5 py-1 rounded-full border', typeFilter === k ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {l}{k !== 'all' && <span className={typeFilter === k ? 'text-white/70' : 'text-gray-400'}> {countBy(f)}</span>}
                </button>
              ))}
            </div>
            <div className="mt-2 max-h-96 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
              {visible.length === 0 ? <p className="px-3 py-4 text-sm text-gray-400">Bu filtrede kimse yok.</p> : visible.slice(0, showMax).map(r => (
                <label key={r.email} className={cn('px-3 py-2 flex items-center gap-3 text-sm cursor-pointer hover:bg-gray-50', r.optedOut && 'opacity-50 cursor-not-allowed')}>
                  <input type="checkbox" disabled={r.optedOut} checked={isOn(r)} onChange={() => setOn([r], !isOn(r))} />
                  <span className="flex-1 min-w-0 truncate"><span className="font-medium text-gray-900">{r.name || '—'}</span> <span className="text-gray-500">{r.email}</span></span>
                  <span className="shrink-0 flex items-center gap-1 text-[11px]">
                    {r.optedOut && <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold">çıktı</span>}
                    {r.contact && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">eski site</span>}
                    {r.firm && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700" title={r.isBusiness ? 'Firma hesabı / Rechnung' : 'Şirket e-posta alan adı'}>{r.isBusiness ? 'Firma' : emailDomain(r.email)}</span>}
                    {r.bookingCount >= 2 && <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{r.bookingCount}×</span>}
                    <span title={LANG_LABEL[r.lang]}>{LANG_FLAG[r.lang]}</span>
                  </span>
                </label>
              ))}
              {visible.length > showMax && (
                <button onClick={() => setShowMax(n => n + 300)} className="w-full px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-gray-50 text-left">
                  … {visible.length - showMax} kişi daha — 300 tane daha göster
                </button>
              )}
            </div>
          </div>

          {/* 2 Inhalt */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            {step(2, 'İçerik', PenLine, (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {([['text', 'Tasarım', Type], ['html', 'HTML', Code2]] as const).map(([k, t, Icon]) => (
                  <button key={k} onClick={() => setEditor(k)} className={cn('text-xs font-semibold px-2.5 py-1 rounded-md inline-flex items-center gap-1', editor === k ? 'bg-white shadow text-gray-900' : 'text-gray-500')}><Icon size={12} /> {t}</button>
                ))}
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-1">
                {LANGS.map(l => (
                  <button key={l} onClick={() => setTab(l)}
                    className={cn('text-sm font-semibold px-3 py-1.5 rounded-lg border', tab === l ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                    {LANG_FLAG[l]} {LANG_LABEL[l]} <span className={tab === l ? 'text-white/60' : 'text-gray-400'}>{langCount[l]}</span>
                  </button>
                ))}
              </div>
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" value={langMode} onChange={e => setLangMode(e.target.value as 'customer' | MkLang)}>
                <option value="customer">Her müşteriye kendi dilinde</option>
                {LANGS.map(l => <option key={l} value={l}>Herkese {LANG_LABEL[l]}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              <div><label className={label}>Konu</label><input className={input} value={texts[tab].subject} onChange={e => setText(tab, { subject: e.target.value })} placeholder="E-posta konusu" /></div>
              {editor === 'text' ? (
                <>
                  <div><label className={label}>Mesaj <span className="font-normal text-gray-400">· „Guten Tag {'{Name}'},“ otomatik eklenir · **kalın**, # başlık, - madde</span></label>
                    <textarea rows={7} className={input} value={texts[tab].message} onChange={e => setText(tab, { message: e.target.value })} /></div>
                  {mode === 'discount' && (
                    <div><label className={label}>İndirim cümlesi <span className="font-normal text-gray-400">(mesajın altına, kupon kutusunun üstüne)</span></label>
                      <textarea rows={2} className={input} value={texts[tab].offer} onChange={e => setText(tab, { offer: e.target.value })} /></div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={label}>Rozet</label><input className={input} value={texts[tab].badge} onChange={e => setText(tab, { badge: e.target.value })} placeholder="🎄 Frohe Weihnachten" /></div>
                    {mode === 'greeting' && <>
                      <div><label className={label}>Buton metni</label><input className={input} value={texts[tab].buttonText} onChange={e => setText(tab, { buttonText: e.target.value })} placeholder="Jetzt Fahrt buchen" /></div>
                      <div><label className={label}>Buton linki</label><input className={input} value={texts[tab].buttonUrl} onChange={e => setText(tab, { buttonUrl: e.target.value })} placeholder="https://flughafen-muenchen.taxi" /></div>
                    </>}
                  </div>
                </>
              ) : (
                <div>
                  <label className={label}>HTML (tüm diller için aynı · {'{isim}'} = ad · abonelikten çıkma alt bilgisi otomatik eklenir)</label>
                  <textarea rows={12} className={cn(input, 'font-mono text-xs')} value={html} onChange={e => setHtml(e.target.value)}
                    onPaste={e => { const t = e.clipboardData.getData('text'); const f = fixMacRoman(t); if (f !== t) { e.preventDefault(); setHtml(h => h + f); } }} />
                </div>
              )}
            </div>
          </div>

          {/* 3 Senden */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            {step(3, 'Gönder', Send)}
            {missingText.length > 0 && selected.length > 0 && (
              <p className="mb-3 text-xs text-amber-700">Eksik metin: {missingText.map(l => LANG_LABEL[l]).join(', ')} — bu dildeki müşteriler Almanca metni alır.</p>
            )}
            {result && <div className={cn('mb-3 rounded-xl border px-3 py-2 text-sm', result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700')}>{result.text}</div>}
            {confirm ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm space-y-2">
                <p className="text-amber-900"><b>{selected.length.toLocaleString('de-DE')} kişiye</b> gönderilsin mi?</p>
                <ul className="text-xs text-amber-900/80 space-y-0.5">
                  <li>Segment: {SEGMENT_LABEL[segment]}{picked.size ? ` + ${picked.size} eski site müşterisi` : ''}</li>
                  <li>Dil: {usedLangs.map(l => `${LANG_FLAG[l]} ${langCount[l]}`).join(' · ')}</li>
                  <li>{mode === 'discount' ? `Her alıcıya −%${percent} kişisel link, ${validDays} gün geçerli${maxAmount ? `, en fazla ${maxAmount} €` : ''}` : 'Sadece tebrik (kupon yok)'}</li>
                  <li>Konu (DE): {texts.de.subject || texts[usedLangs[0] || 'de'].subject}</li>
                </ul>
                <div className="flex gap-2 pt-1">
                  <button onClick={send} disabled={busy !== ''} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50">
                    {busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Evet, gönder
                  </button>
                  <button onClick={() => setConfirm(false)} className="text-sm font-semibold text-gray-600 px-3 py-2">Vazgeç</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={sendTest} disabled={busy !== '' || !texts[tab].subject.trim()}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg disabled:opacity-50">
                  {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Bana test gönder ({LANG_FLAG[tab]})
                </button>
                <button onClick={() => setConfirm(true)} disabled={busy !== '' || selected.length === 0 || !usedLangs.some(l => texts[l].subject.trim())}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50">
                  {busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {selected.length.toLocaleString('de-DE')} kişiye gönder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Vorschau */}
        <div className="xl:sticky xl:top-24 self-start">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Önizleme · {LANG_FLAG[tab]} {LANG_LABEL[tab]}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{preview?.subject || texts[tab].subject || '—'}</p>
            </div>
            {previewErr && <p className="px-4 py-2 text-xs text-red-600">{previewErr}</p>}
            {preview
              ? <iframe title="E-posta önizleme" srcDoc={preview.html} sandbox="" className="w-full h-[760px] bg-[#eef1f5]" />
              : <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-gray-400 text-sm"><Check size={20} /> Yukarıdan bir anlas seç ya da metin yaz</div>}
          </div>
        </div>
      </div>

      <CampaignHistory campaigns={campaigns} names={names} />
    </div>
  );
}
