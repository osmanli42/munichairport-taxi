'use client';

// Google index monitor — every sitemap URL checked daily with the Search Console URL Inspection
// API: indexed or not, why not, dropped pages, sitemap status + submit (backend: services/seo/indexing.ts).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, Info, Map, RefreshCw, Search, Send, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Switch } from '@/components/dashboard/shared';
import { seoApi, Empty, Kpi, shortPath } from './common';

type Page = {
  url: string; verdict: string | null; coverage: string | null; last_crawl: string | null; checked_at: string | null; error: string | null;
  google_canonical: string | null; user_canonical: string | null; indexed_since: string | null; dropped_at: string | null;
  section: 'main' | 'blog' | 'en' | 'tr'; reason_key: string; reason: string | null; fix: string | null; canonical_mismatch: boolean; canonical_fixed: boolean;
};
type Filter = 'all' | 'indexed' | 'not' | 'dropped' | 'unchecked';

const SECTIONS: Record<string, string> = { main: 'Ana sayfalar (DE)', blog: 'Şehir sayfaları (DE)', en: 'İngilizce /en', tr: 'Türkçe /tr' };
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');
const dateTime = (s: string | null) => (s ? new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const inspectLink = (site: string, url: string) =>
  `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site)}&id=${encodeURIComponent(url)}`;

function Status({ p }: { p: Page }) {
  if (p.error) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Hata</span>;
  if (!p.checked_at) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Kontrol edilmedi</span>;
  if (p.verdict === 'PASS') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={12} /> İndeksli</span>;
  if (p.dropped_at) return <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white"><XCircle size={12} /> Düştü</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><AlertTriangle size={12} /> İndekste değil</span>;
}

function TrendBars({ history }: { history: Array<{ date: string; total: number; indexed: number }> }) {
  if (history.length < 2) return <p className="text-xs text-gray-400">Trend birkaç günlük kontrolden sonra görünür.</p>;
  const max = Math.max(...history.map((h) => h.total), 1);
  return (
    <div className="flex items-end gap-[3px] h-16" title="Günlük indeksli sayfa sayısı">
      {history.map((h) => (
        <div key={h.date} className="flex-1 min-w-[3px] rounded-t bg-gray-100 relative" style={{ height: `${(h.total / max) * 100}%` }}>
          <div className="absolute bottom-0 inset-x-0 rounded-t bg-emerald-500" style={{ height: `${h.total ? (h.indexed / h.total) * 100 : 0}%` }} title={`${h.date}: ${h.indexed}/${h.total}`} />
        </div>
      ))}
    </div>
  );
}

export default function Indexing({ onRemindersChange }: { onRemindersChange?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sectionF, setSectionF] = useState<string>('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(60);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    seoApi('/indexing').then((j) => { setD(j); setErr(null); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  // Poll while a full check runs.
  useEffect(() => {
    if (!d?.running) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [d, load]);

  async function runAll(force: boolean) {
    setBusy('run');
    try { await seoApi('/indexing/run', { method: 'POST', body: JSON.stringify({ force }) }); load(); } finally { setBusy(null); }
  }
  async function inspectOne(url: string) {
    setBusy(url);
    try { await seoApi('/indexing/inspect', { method: 'POST', body: JSON.stringify({ url }) }); load(); onRemindersChange?.(); } finally { setBusy(null); }
  }
  async function submit() {
    setBusy('sitemap'); setMsg(null);
    try { await seoApi('/indexing/sitemap', { method: 'POST' }); setMsg('Sitemap Google’a gönderildi ✓'); load(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(null); }
  }
  async function toggle() {
    await seoApi('/indexing/settings', { method: 'PUT', body: JSON.stringify({ enabled: !d.enabled }) });
    load(); onRemindersChange?.();
  }

  const pages: Page[] = d?.pages || [];
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pages.filter((p) => {
      if (sectionF && p.section !== sectionF) return false;
      if (needle && !p.url.toLowerCase().includes(needle)) return false;
      if (filter === 'indexed') return p.verdict === 'PASS';
      if (filter === 'not') return !!p.checked_at && !p.error && p.verdict !== 'PASS';
      if (filter === 'dropped') return !!p.dropped_at && p.verdict !== 'PASS';
      if (filter === 'unchecked') return !p.checked_at || !!p.error;
      return true;
    }).sort((a, b) => {
      // Problems first: dropped → not indexed → unchecked → indexed.
      const w = (p: Page) => (p.dropped_at && p.verdict !== 'PASS' ? 0 : p.checked_at && p.verdict !== 'PASS' ? 1 : !p.checked_at ? 2 : 3);
      return w(a) - w(b) || a.url.localeCompare(b.url);
    });
  }, [pages, filter, sectionF, q]);

  if (err) return <Card title="Google indeksi" icon={FileSearch}><Empty>{err}</Empty></Card>;
  if (!d) return <div className="h-40 bg-white rounded-2xl animate-pulse" />;
  if (!d.connected) return <Card title="Google indeksi" icon={FileSearch}><Empty>Search Console bağlanınca görünür (Bağlantı sekmesi).</Empty></Card>;

  const s = d.summary;
  const share = s.checked ? Math.round((s.indexed / s.checked) * 100) : 0;
  const counts: Record<Filter, number> = {
    all: pages.length,
    indexed: s.indexed,
    not: s.not_indexed,
    dropped: pages.filter((p) => p.dropped_at && p.verdict !== 'PASS').length,
    unchecked: s.unchecked,
  };
  const sm = (d.sitemaps || [])[0];
  const run = d.running;

  return (
    <div className="space-y-6">
      {s.dropped > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200 px-5 py-4">
          <XCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <div className="font-semibold text-red-700">{s.dropped} sayfa Google indeksinden düştü</div>
            <div className="text-red-600/80 text-xs mt-0.5">Önceki kontrolde indeksliydi, şimdi değil. Aşağıda „Düşenler“ filtresine bak; sebebi ve yapılacak iş satırda yazıyor.</div>
          </div>
          <button onClick={() => setFilter('dropped')} className="ml-auto shrink-0 text-xs font-semibold text-red-700 hover:underline">Göster →</button>
        </div>
      )}

      {s.canonical_stale > 10 && (
        <div className="flex items-start gap-3 rounded-2xl bg-sky-50 ring-1 ring-sky-100 px-5 py-4 text-sm">
          <Info className="text-sky-600 shrink-0 mt-0.5" size={18} />
          <div>
            <div className="font-semibold text-sky-900">{s.canonical_stale} sayfada Google hâlâ eski taramayı görüyor</div>
            <div className="text-sky-800/80 text-xs mt-0.5 leading-relaxed">
              Google bu sayfaları son taradığında (çoğu Haziran–Eylül) sayfalar kanonik olarak Almanca sürümü gösteriyordu; bu yüzden /en ve /tr sayfalarının çoğu
              „Alternative Seite“ veya „Gecrawlt – nicht indexiert“. Sayfalar bugün doğru (kendi kanoniği + hreflang). Google yeniden taradıkça indeksli sayısı artmalı —
              gidişatı aşağıdaki 90 günlük grafikten izle.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="İndeksli sayfa" value={<>{s.indexed}<span className="text-base text-gray-400 font-medium"> / {s.total}</span></>}
          sub={s.checked ? `kontrol edilenlerin %${share}’i` : 'henüz kontrol yok'} tone="text-emerald-600" icon={<CheckCircle2 size={16} />} />
        <Kpi label="İndekste değil" value={s.not_indexed} sub="Google bulmuş ama almamış / tanımıyor" tone={s.not_indexed ? 'text-amber-600' : 'text-gray-900'} icon={<AlertTriangle size={16} />} />
        <Kpi label="Düşen (14 gün)" value={s.dropped} sub="önce indeksliydi" tone={s.dropped ? 'text-red-600' : 'text-gray-900'} icon={<XCircle size={16} />} />
        <Kpi label="Son kontrol" value={<span className="text-lg">{dateTime(s.last_check)}</span>} sub={s.unchecked ? `${s.unchecked} sayfa sırada` : 'tüm sitemap kontrol edildi'} icon={<RefreshCw size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card title="Bölümlere göre" icon={FileSearch} className="lg:col-span-2" right={
          <div className="flex items-center gap-3">
            {run ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600"><RefreshCw size={13} className="animate-spin" /> {run.done}/{run.total} kontrol ediliyor…</span>
            ) : (
              <button onClick={() => runAll(s.unchecked === 0)} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline disabled:text-gray-400">
                <RefreshCw size={13} className={cn(busy === 'run' && 'animate-spin')} /> {s.unchecked ? 'Eksikleri kontrol et' : 'Hepsini yeniden kontrol et'}
              </button>
            )}
          </div>
        }>
          <div className="p-5 space-y-3">
            {['main', 'blog', 'en', 'tr'].filter((k) => d.sections[k]).map((k) => {
              const x = d.sections[k];
              return (
                <button key={k} onClick={() => setSectionF(sectionF === k ? '' : k)} className="w-full text-left">
                  <div className="flex items-center gap-3">
                    <span className={cn('w-40 shrink-0 text-sm', sectionF === k ? 'font-semibold text-primary-700' : 'text-gray-700')}>{SECTIONS[k]}</span>
                    <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(x.indexed / x.total) * 100}%` }} />
                      <div className="h-full bg-amber-300" style={{ width: `${((x.checked - x.indexed) / x.total) * 100}%` }} />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-gray-600"><b className="text-gray-900">{x.indexed}</b> / {x.total}</span>
                  </div>
                </button>
              );
            })}
            <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> indeksli</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-300" /> indekste değil</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200" /> henüz kontrol edilmedi</span>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2">İndeksli sayfa — son 90 gün</div>
              <TrendBars history={d.history} />
            </div>
          </div>
        </Card>

        <Card title="Sitemap" icon={Map}>
          <div className="p-5 space-y-3 text-sm">
            {sm ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{shortPath(sm.path)}</span>
                  {sm.errors ? <span className="text-xs font-semibold text-red-600">{sm.errors} hata</span>
                    : sm.is_pending ? <span className="text-xs font-semibold text-amber-600">işleniyor</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={13} /> Erfolgreich</span>}
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-xs">
                  <dt className="text-gray-500">Gönderilen URL</dt><dd className="text-right font-medium">{sm.submitted}</dd>
                  <dt className="text-gray-500">Google son okuma</dt><dd className="text-right">{dateTime(sm.last_downloaded)}</dd>
                  <dt className="text-gray-500">Son gönderim</dt><dd className="text-right">{dateTime(sm.last_submitted)}</dd>
                  {sm.warnings > 0 && <><dt className="text-gray-500">Uyarı</dt><dd className="text-right text-amber-600">{sm.warnings}</dd></>}
                </dl>
              </>
            ) : <p className="text-xs text-gray-500">Search Console’da sitemap yok.</p>}
            <button onClick={submit} disabled={!d.can_submit || busy === 'sitemap'}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:bg-gray-300">
              <Send size={13} /> {busy === 'sitemap' ? 'Gönderiliyor…' : 'Sitemap’i şimdi gönder'}
            </button>
            {!d.can_submit && <p className="text-[11px] text-amber-700">Göndermek için Search Console’da servis hesabına „Uneingeschränkt“ yetkisi gerekir.</p>}
            {msg && <p className="text-[11px] text-gray-600">{msg}</p>}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <Switch on={!!d.enabled} onChange={toggle} label="Otomatik izleme" />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Açıkken: her gün 06:20’de tüm sitemap sayfaları kontrol edilir, düşen sayfa SEO sekmesinde ve Handlungsbedarf’ta kırmızı uyarı olur;
                her deploy’dan sonra sitemap Google’a otomatik gönderilir (günde en fazla 1).
                {d.last_auto_submit && <> Son otomatik gönderim: {dateTime(d.last_auto_submit)}.</>}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {d.reasons.length > 0 && (
        <Card title="Neden indekste değil?" icon={AlertTriangle}>
          <ul className="divide-y divide-gray-100">
            {d.reasons.map((r: any) => (
              <li key={r.key} className="px-5 py-3 flex items-start gap-3">
                <span className="w-9 shrink-0 text-right text-lg font-bold tabular-nums text-gray-900">{r.count}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{r.label}</div>
                  {r.fix && <div className="text-xs text-gray-500">→ {r.fix}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Sayfalar" icon={Search} right={
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="URL ara…" className="w-44 rounded-lg border border-gray-200 py-1.5 pl-7 pr-2 text-xs" />
        </div>
      }>
        <div className="px-5 pt-3 pb-2 flex gap-1 overflow-x-auto">
          {([['all', 'Tümü'], ['dropped', 'Düşenler'], ['not', 'İndekste değil'], ['indexed', 'İndeksli'], ['unchecked', 'Kontrol edilmedi']] as Array<[Filter, string]>).map(([k, label]) => (
            <button key={k} onClick={() => { setFilter(k); setLimit(60); }}
              className={cn('shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold', filter === k ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
              {label} <span className={cn('rounded-full px-1.5 text-[10px]', filter === k ? 'bg-white/25' : k === 'dropped' && counts[k] ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600')}>{counts[k]}</span>
            </button>
          ))}
          {sectionF && <button onClick={() => setSectionF('')} className="shrink-0 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">{SECTIONS[sectionF]} ✕</button>}
        </div>
        {list.length === 0 ? <Empty>Bu filtrede sayfa yok.</Empty> : (
          <ul className="divide-y divide-gray-100">
            {list.slice(0, limit).map((p) => (
              <li key={p.url} className={cn('px-5 py-2.5', p.dropped_at && p.verdict !== 'PASS' && 'bg-red-50/50')}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 max-w-full truncate text-sm font-medium text-gray-900 hover:text-primary-700 hover:underline">{shortPath(p.url)}</a>
                  <Status p={p} />
                  {p.canonical_mismatch && (p.canonical_fixed
                    ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500" title={`Google’ın son taramasında sayfa kanonik olarak ${p.user_canonical} gösteriyordu. Sayfa bugün doğru — yeniden taranınca düzelir.`}>eski tarama</span>
                    : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700" title={`Sayfanın kanoniği: ${p.user_canonical}`}>kanonik başka URL</span>)}
                  <div className="ml-auto flex items-center gap-3 text-xs">
                    <span className="text-gray-400 whitespace-nowrap" title="Google son tarama">taranma {date(p.last_crawl)}</span>
                    <button onClick={() => inspectOne(p.url)} disabled={!!busy} className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline disabled:text-gray-400">
                      <RefreshCw size={12} className={cn(busy === p.url && 'animate-spin')} /> Kontrol et
                    </button>
                    <a href={inspectLink(d.site, p.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:underline" title="Search Console’da aç — oradan „Indexierung beantragen“">
                      GSC <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
                {p.verdict !== 'PASS' && (p.coverage || p.error) && (
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="text-gray-400">Google:</span> {p.error || p.coverage}
                    {p.fix && <span className="block text-gray-500">→ {p.fix}</span>}
                    {p.dropped_at && <span className="block text-red-600">düştü: {dateTime(p.dropped_at)}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {list.length > limit && (
          <div className="px-5 py-3 border-t border-gray-100 text-center">
            <button onClick={() => setLimit(limit + 100)} className="text-xs font-semibold text-primary-600 hover:underline">Daha fazla göster ({list.length - limit})</button>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-gray-400 leading-relaxed px-1">
        „Indexierung beantragen“ butonu için Google normal sayfalara API sunmuyor; gerekirse satırdaki <b>GSC</b> bağlantısıyla sayfayı Search Console’da açıp oradan iste.
        Normalde gerek yok — sitemap ve site içi linkler yeterli.
      </p>
    </div>
  );
}
