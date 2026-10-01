'use client';

// Backlink building checklist: where to list the business, the registration link and the texts to
// paste. The admin registers by hand; status is kept on the server (backend: services/seo/outreach.ts).

import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Clock, Copy, ExternalLink, Hammer, RotateCcw, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { seoApi } from './common';

type Src = {
  key: string; name: string; group: string; group_label: string; url: string; domain: string; minutes: number; how: string;
  status: 'todo' | 'done' | 'skip'; done_at: string | null; link_live: boolean;
};
const GROUP_TONE: Record<string, string> = {
  maps: 'bg-emerald-50 text-emerald-700', directory: 'bg-sky-50 text-sky-700', reviews: 'bg-amber-50 text-amber-700',
  social: 'bg-violet-50 text-violet-700', partner: 'bg-rose-50 text-rose-700',
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function CopyBtn({ text, label = 'Kopyala' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setOk(true); setTimeout(() => setOk(false), 1500);
  }
  return (
    <button onClick={copy} className={cn('shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
      {ok ? <Check size={12} /> : <Copy size={12} />} {ok ? 'Kopyalandı' : label}
    </button>
  );
}

function Row({ s, onSet, big }: { s: Src; onSet: (key: string, status: Src['status']) => void; big?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-start', big ? 'p-4 rounded-xl ring-1 ring-primary-100 bg-primary-50/30' : 'px-5 py-3')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('font-semibold text-gray-900', big ? 'text-base' : 'text-sm', s.status === 'skip' && 'line-through text-gray-400')}>{s.name}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', GROUP_TONE[s.group])}>{s.group_label}</span>
          <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400"><Clock size={11} /> ~{s.minutes} dk</span>
          {s.link_live && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white"><CheckCircle2 size={11} /> link geldi</span>}
          {s.status === 'done' && !s.link_live && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">yapıldı {s.done_at && fmt(s.done_at)}</span>}
        </div>
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">{s.how}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {s.url && (
          <a href={s.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
            Sayfayı aç <ExternalLink size={12} />
          </a>
        )}
        {s.status === 'todo' ? (
          <>
            <button onClick={() => onSet(s.key, 'done')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><Check size={12} /> Yaptım</button>
            <button onClick={() => onSet(s.key, 'skip')} title="Bu siteyi atla" className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"><SkipForward size={12} /> Geç</button>
          </>
        ) : (
          <button onClick={() => onSet(s.key, 'todo')} title="Geri al" className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"><RotateCcw size={12} /> Geri al</button>
        )}
      </div>
    </div>
  );
}

export default function Outreach() {
  const [d, setD] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [openText, setOpenText] = useState<string | null>(null);
  const load = useCallback(() => { seoApi('/backlinks/outreach').then(setD).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(key: string, status: Src['status']) {
    setD(await seoApi(`/backlinks/outreach/${key}`, { method: 'PUT', body: JSON.stringify({ status }) }));
  }

  if (!d) return <div className="h-40 bg-white rounded-2xl animate-pulse" />;
  const sources: Src[] = d.sources;
  const today = sources.filter((s) => d.today.includes(s.key));
  const live = sources.filter((s) => s.link_live).length;
  const short = d.texts.filter((t: any) => !t.text.includes('\n'));
  const long = d.texts.filter((t: any) => t.text.includes('\n'));

  return (
    <Card title="Backlink kurma" icon={Hammer} right={
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span><b className="text-gray-900">{d.done}</b> / {d.total} yapıldı{live ? <> · <b className="text-emerald-600">{live}</b> link geldi</> : null}</span>
        <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(d.done / d.total) * 100}%` }} /></div>
      </div>
    }>
      <div className="p-5 space-y-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900">Bugünün işleri</h4>
            <span className="text-[11px] text-gray-400">Sayfayı aç → aşağıdaki metinleri kopyala-yapıştır → „Yaptım“</span>
          </div>
          {today.length ? (
            <div className="space-y-2">{today.map((s) => <Row key={s.key} s={s} onSet={setStatus} big />)}</div>
          ) : (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Listedeki her şey yapıldı ✓ Haftada 3–5 otel/partner e-postası göndermeye devam et.</div>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">Hazır metinler <span className="font-normal text-gray-400">— her yerde aynı ad, adres, telefon (Google bunları karşılaştırır)</span></h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {short.map((t: any) => (
              <div key={t.key} className="flex items-center gap-2 min-w-0 py-1 border-b border-gray-50">
                <span className="w-32 shrink-0 text-[11px] text-gray-500">{t.label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-900" title={t.text}>{t.text}</span>
                <CopyBtn text={t.text} />
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {long.map((t: any) => (
              <div key={t.key} className="rounded-xl ring-1 ring-gray-100">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button onClick={() => setOpenText(openText === t.key ? null : t.key)} className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold text-gray-800">
                    <ChevronDown size={14} className={cn('transition-transform text-gray-400', openText === t.key && 'rotate-180')} /> {t.label}
                  </button>
                  <CopyBtn text={t.text} />
                </div>
                {openText === t.key && <pre className="whitespace-pre-wrap break-words border-t border-gray-100 px-3 py-2 font-sans text-xs text-gray-700">{t.text}</pre>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <button onClick={() => setShowAll(!showAll)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
            <ChevronDown size={14} className={cn('transition-transform', showAll && 'rotate-180')} /> Tüm liste ({sources.length})
          </button>
        </div>
      </div>
      {showAll && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {sources.map((s) => <Row key={s.key} s={s} onSet={setStatus} />)}
        </div>
      )}
      <p className="px-5 pb-4 text-[11px] text-gray-400 leading-relaxed">
        „Link geldi“ etiketi aylık Search Console Links CSV’sinde o site görününce otomatik çıkar{!d.has_links_upload && ' (henüz CSV yüklenmedi)'}.
        Forum yorumu ve otomatik link ekleme bilerek yok: Google bunu link spam sayar ve siteyi cezalandırabilir.
      </p>
    </Card>
  );
}
