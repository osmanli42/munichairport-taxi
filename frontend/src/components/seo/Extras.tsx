'use client';

// Rakipler, Görevler, Bağlantı sub-tabs.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Link2, ListChecks, RefreshCw, Swords, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { seoApi, Empty, shortPath } from './common';

const KIND: Record<string, [string, string]> = {
  setup: ['Kurulum', 'bg-violet-100 text-violet-700'],
  technical: ['Teknik', 'bg-red-100 text-red-700'],
  keyword: ['Kelime', 'bg-sky-100 text-sky-700'],
  ctr: ['CTR', 'bg-amber-100 text-amber-700'],
  content: ['İçerik', 'bg-emerald-100 text-emerald-700'],
  speed: ['Hız', 'bg-orange-100 text-orange-700'],
  competitor: ['Rakip', 'bg-gray-100 text-gray-700'],
};

export function Tasks() {
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [show, setShow] = useState<'open' | 'done' | 'ignored'>('open');
  const load = useCallback(() => { seoApi('/tasks').then((j) => setTasks(j.tasks)).catch(() => setTasks([])); }, []);
  useEffect(() => { load(); }, [load]);
  async function set(t: any, status: string) {
    setTasks((l) => (l || []).map((x) => (x.key === t.key ? { ...x, status } : x)));
    await seoApi(`/tasks/${t.key}`, { method: 'PUT', body: JSON.stringify({ status, title: t.title }) }).catch(load);
  }
  if (!tasks) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  const list = tasks.filter((t) => t.status === show);
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  return (
    <Card
      title="Görevler"
      icon={ListChecks}
      right={(
        <div className="flex rounded-xl bg-gray-100 p-1 text-xs">
          {([['open', 'Açık'], ['done', 'Yapıldı'], ['ignored', 'Yoksayıldı']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setShow(k)} className={cn('px-2.5 py-1 rounded-lg font-medium', show === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>{l} ({count(k)})</button>
          ))}
        </div>
      )}
    >
      {list.length === 0 ? <Empty>{show === 'open' ? 'Açık görev yok ✓' : '—'}</Empty> : (
        <ul className="divide-y divide-gray-100">
          {list.map((t) => {
            const [label, cls] = KIND[t.kind] || KIND.technical;
            return (
              <li key={t.key} className="px-5 py-3.5 flex gap-4">
                <div className="w-10 shrink-0 text-center">
                  <div className="text-lg font-bold text-primary-700 tabular-nums">{t.impact}</div>
                  <div className="text-[10px] text-gray-400">etki</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', cls)}>{label}</span>
                    <span className="font-semibold text-gray-900 text-sm">{t.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">{t.detail}</p>
                  {t.urls?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {t.urls.slice(0, 6).map((u: string) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary-700 bg-primary-50 rounded px-1.5 py-0.5 hover:underline"><ExternalLink size={10} />{shortPath(u)}</a>
                      ))}
                      {t.urls.length > 6 && <span className="text-[11px] text-gray-400">+{t.urls.length - 6}</span>}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col gap-1.5">
                  {t.status !== 'done' && <button onClick={() => set(t, 'done')} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"><CheckCircle2 size={13} /> Yapıldı</button>}
                  {t.status !== 'ignored' && <button onClick={() => set(t, 'ignored')} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"><XCircle size={13} /> Yoksay</button>}
                  {t.status !== 'open' && <button onClick={() => set(t, 'open')} className="text-xs text-primary-600 hover:underline">Geri al</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">Görevler her açılışta güncel verilerden yeniden hesaplanır. Sorun ortadan kalkınca görev kendiliğinden listeden düşer.</p>
    </Card>
  );
}

export function Competitors() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { seoApi('/competitors').then(setD).catch(() => setD({ available: false })); }, []);
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  if (!d.available) return <Card title="Rakipler" icon={Swords}><Empty>Haftalık rakip analizi henüz yok (her pazartesi 09:00 çalışır).</Empty></Card>;
  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">Google.de ilk 10 sonucu, {new Date(d.ts).toLocaleDateString('de-DE')} (haftalık, SerpAPI). Bizim site yeşil işaretli.</p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {d.keywords.map((k: any) => {
          const plan = d.plans.find((p: any) => p.keyword === k.keyword);
          return (
            <Card key={k.keyword} title={`„${k.keyword}“`} icon={Swords}>
              <ol className="divide-y divide-gray-50">
                {k.top10.map((r: any) => {
                  const ours = /flughafen-muenchen\.taxi/.test(r.link);
                  return (
                    <li key={r.position} className={cn('px-5 py-1.5 flex items-center gap-3 text-xs', ours && 'bg-emerald-50')}>
                      <span className="w-5 text-right font-bold text-gray-500">{r.position}</span>
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className={cn('truncate hover:underline', ours ? 'font-bold text-emerald-700' : 'text-gray-800')}>{new URL(r.link).host.replace(/^www\./, '')}</a>
                      <span className="truncate text-gray-400">{r.title}</span>
                    </li>
                  );
                })}
              </ol>
              {plan?.gaps?.filter((g: any) => g.action !== 'OK').length > 0 && (
                <div className="px-5 py-3 border-t border-gray-100 text-xs">
                  <div className="font-semibold text-gray-700 mb-1">1. sıradakine göre eksikler</div>
                  <ul className="space-y-0.5 text-gray-600">
                    {plan.gaps.filter((g: any) => g.action !== 'OK').map((g: any) => <li key={g.criterion}>• {g.criterion}: {g.action}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {d.suggestions?.length > 0 && (
        <Card title="Yeni kelime fikirleri (Google önerileri)" icon={Link2}>
          <div className="p-5 flex flex-wrap gap-2">
            {d.suggestions.slice(0, 40).map((s: string) => <span key={s} className="text-xs rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">{s}</span>)}
          </div>
        </Card>
      )}
    </div>
  );
}

export function Connect({ onConnected }: { onConnected: () => void }) {
  const [st, setSt] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => { seoApi('/status?fresh=1').then(setSt).catch((e) => setMsg(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!st) return <div className="h-40 bg-white rounded-2xl animate-pulse" />;
  const g = st.gsc;
  async function sync(full = false) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await seoApi('/sync', { method: 'POST', body: JSON.stringify({ full }) });
      setMsg(r.started === 'history' ? 'Geçmiş 16 ay yükleniyor (birkaç dakika sürebilir)…' : `${r.recent?.rows ?? 0} satır güncellendi`);
      onConnected();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); load(); }
  }
  const project = String(g.error || '').match(/project (\d+)/)?.[1];
  return (
    <Card title="Google Search Console bağlantısı" icon={Link2}>
      <div className="p-5 space-y-4 text-sm">
        <div className={cn('rounded-xl px-4 py-3', g.connected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>
          {g.connected
            ? <>✅ Bağlı: <b>{g.site}</b> ({g.permission}) · {g.rows.toLocaleString('de-DE')} satır veri · son senkron {g.last_sync ? new Date(g.last_sync).toLocaleString('de-DE') : '—'}</>
            : <>⚠️ Bağlı değil{g.error ? `: ${g.error_kind === 'api_disabled' ? 'Search Console API kapalı' : g.error_kind === 'no_access' ? 'servis hesabına yetki verilmemiş' : g.error}` : ''}</>}
        </div>
        {!g.connected && (
          <ol className="list-decimal pl-5 space-y-2 text-gray-700">
            {g.error_kind === 'api_disabled' && (
              <li>
                Google Cloud'da API'yi aç:{' '}
                <a className="text-primary-600 underline" target="_blank" rel="noopener noreferrer" href={`https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview${project ? `?project=${project}` : ''}`}>Search Console API → Etkinleştir</a>
              </li>
            )}
            <li>
              <a className="text-primary-600 underline" target="_blank" rel="noopener noreferrer" href="https://search.google.com/search-console/users">Search Console → Ayarlar → Kullanıcılar ve izinler</a> → <b>Kullanıcı ekle</b>
            </li>
            <li>E-posta: <code className="bg-gray-100 rounded px-1.5 py-0.5 select-all">{g.email || '—'}</code> · İzin: <b>Kısıtlı</b></li>
            <li>Birkaç dakika sonra aşağıdaki "Bağlantıyı test et"e bas.</li>
          </ol>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 ring-1 ring-gray-200 hover:bg-gray-50"><RefreshCw size={14} /> Bağlantıyı test et</button>
          {g.connected && <button onClick={() => sync(false)} disabled={busy} className="rounded-xl px-3 py-2 bg-primary-600 text-white disabled:opacity-50">Şimdi senkronize et</button>}
          {g.connected && <button onClick={() => sync(true)} disabled={busy} className="rounded-xl px-3 py-2 ring-1 ring-gray-200 disabled:opacity-50">16 ay geçmişi yeniden yükle</button>}
        </div>
        {msg && <p className="text-xs text-gray-600">{msg}</p>}
        <p className="text-[11px] text-gray-400">Veri her gece 04:10'da güncellenir (Google verisi 2–3 gün gecikmeli gelir). Erişim sadece okuma.</p>
      </div>
    </Card>
  );
}
