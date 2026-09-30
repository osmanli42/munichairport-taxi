'use client';

// Title & Meta check: every page from the last audit as a Google snippet preview,
// with a green check when title/meta/H1/status are all fine.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, RefreshCw, Search, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { seoApi, shortPath, Empty } from './common';

type Page = {
  url: string; status: number | null; title: string; meta: string; h1_count: number | null; noindex: boolean;
  problems: Array<{ type: string; severity: 'error' | 'warning' | 'notice' }>; ok: boolean;
};
type Filter = 'main' | 'cities' | 'problems' | 'all';

const CITY = /\/blog\/taxi-(?!flughafen-muenchen$).+-flughafen-muenchen$/;
const PAGE_SIZE = 25;

const lang = (path: string) => (path.startsWith('/en') ? 'EN' : path.startsWith('/tr') ? 'TR' : 'DE');
const lenTone = (n: number, min: number, max: number) => (n >= min && n <= max ? 'text-emerald-600' : n > max + 10 || n < min / 2 ? 'text-red-600' : 'text-amber-600');

export default function MetaCheck() {
  const [d, setD] = useState<{ audit: any; pages: Page[]; labels: Record<string, string> } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('main');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    seoApi('/meta').then((r) => { setD(r); setRunning(r.audit?.running || null); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  // While an audit runs: poll progress, reload the list when it is done.
  useEffect(() => {
    if (!running) return;
    poll.current = setInterval(async () => {
      try {
        const st = await seoApi('/status');
        if (st.audit?.running) setRunning(st.audit.running);
        else { setRunning(null); load(); }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [running ? 'on' : 'off', load]); // eslint-disable-line react-hooks/exhaustive-deps

  const startAudit = async () => {
    try {
      const r = await seoApi('/audit', { method: 'POST' });
      setRunning(r.running || { done: 0, total: 0 });
    } catch (e: any) { setErr(e.message); }
  };

  const pages = d?.pages || [];
  const bad = pages.filter((p) => !p.ok);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pages
      .filter((p) => {
        const path = shortPath(p.url);
        if (filter === 'main' && CITY.test(path)) return false;
        if (filter === 'cities' && !CITY.test(path)) return false;
        if (filter === 'problems' && p.ok) return false;
        if (s && !(`${path} ${p.title} ${p.meta}`.toLowerCase().includes(s))) return false;
        return true;
      })
      .sort((a, b) => Number(a.ok) - Number(b.ok));
  }, [pages, filter, q]);

  useEffect(() => { setLimit(PAGE_SIZE); }, [filter, q]);

  if (err) return <Card title="Title & Meta kontrolü" icon={FileSearch}><Empty>{err}</Empty></Card>;
  if (!d) return <div className="h-40 bg-white rounded-2xl animate-pulse" />;

  const last = d.audit?.last;
  const allOk = pages.length > 0 && bad.length === 0;
  const chips: Array<[Filter, string]> = [
    ['main', 'Ana sayfalar'],
    ['cities', 'Şehir sayfaları'],
    ['problems', `Sorunlu (${bad.length})`],
    ['all', `Tümü (${pages.length})`],
  ];

  return (
    <Card
      title="Title & Meta kontrolü"
      icon={FileSearch}
      right={
        <button
          onClick={startAudit}
          disabled={!!running}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          <RefreshCw size={13} className={cn(running && 'animate-spin')} />
          {running ? `Taranıyor… ${running.done}/${running.total || '?'}` : 'Şimdi tara'}
        </button>
      }
    >
      {/* Summary */}
      <div className={cn('mx-5 mt-5 flex items-center gap-4 rounded-2xl px-5 py-4 ring-1',
        !pages.length ? 'bg-gray-50 ring-gray-100' : allOk ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200')}>
        {!pages.length ? <FileSearch size={36} className="text-gray-400 shrink-0" />
          : allOk ? <CheckCircle2 size={40} className="text-emerald-600 shrink-0" />
          : <AlertTriangle size={36} className="text-amber-600 shrink-0" />}
        <div className="min-w-0">
          <div className={cn('text-lg font-bold', !pages.length ? 'text-gray-700' : allOk ? 'text-emerald-800' : 'text-amber-900')}>
            {!pages.length ? 'Henüz tarama yok' : allOk ? `Tüm sayfalar OK — ${pages.length}/${pages.length}` : `${pages.length - bad.length}/${pages.length} sayfa OK · ${bad.length} sayfada sorun var`}
          </div>
          <div className="text-xs text-gray-600">
            Kontrol: durum kodu 200, title 30–60 karakter, meta açıklama 70–160, tekrar yok, tek H1, noindex yok, canonical doğru.
            {last && <> Son tarama: {new Date(last.finished_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
        {chips.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors',
              filter === k ? 'bg-primary-600 text-white ring-primary-600' : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-300')}
          >
            {label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sayfa, title veya meta ara…"
            className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* Snippet list */}
      {list.length === 0 ? <Empty>{filter === 'problems' ? 'Sorunlu sayfa yok ✓' : 'Sonuç yok'}</Empty> : (
        <ul className="mt-3 divide-y divide-gray-100">
          {list.slice(0, limit).map((p) => {
            const path = shortPath(p.url);
            const worst = p.problems.some((x) => x.severity === 'error') ? 'error' : p.problems.some((x) => x.severity === 'warning') ? 'warning' : p.problems.length ? 'notice' : null;
            return (
              <li key={p.url} className="px-5 py-3.5 flex gap-3">
                <div className="pt-0.5 shrink-0">
                  {p.ok ? <CheckCircle2 size={20} className="text-emerald-600" />
                    : worst === 'error' ? <XCircle size={20} className="text-red-600" />
                    : <AlertTriangle size={20} className="text-amber-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-600">{lang(path)}</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="truncate text-emerald-700 hover:underline">flughafen-muenchen.taxi{path === '/' ? '' : path}</a>
                  </div>
                  <div className="mt-0.5 text-[17px] leading-snug text-[#1a0dab] break-words">{p.title || <span className="italic text-red-600">Title yok</span>}</div>
                  <div className="mt-0.5 text-sm leading-snug text-gray-600 break-words">{p.meta || <span className="italic text-red-600">Meta açıklama yok</span>}</div>
                  {p.problems.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.problems.map((x) => (
                        <span key={x.type} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium',
                          x.severity === 'error' ? 'bg-red-50 text-red-700' : x.severity === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600')}>
                          {d.labels[x.type] || x.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex shrink-0 flex-col items-end gap-0.5 text-[11px] tabular-nums text-gray-400">
                  <span>Title <b className={lenTone(p.title.length, 30, 60)}>{p.title.length}</b>/60</span>
                  <span>Meta <b className={lenTone(p.meta.length, 70, 160)}>{p.meta.length}</b>/160</span>
                  {p.status !== 200 && <span className="text-red-600 font-bold">HTTP {p.status ?? '—'}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > limit && (
        <div className="px-5 py-3 border-t border-gray-100 text-center">
          <button onClick={() => setLimit((l) => l + PAGE_SIZE * 2)} className="text-sm font-semibold text-primary-600 hover:underline">
            Daha fazla göster ({list.length - limit} sayfa daha)
          </button>
        </div>
      )}
    </Card>
  );
}
