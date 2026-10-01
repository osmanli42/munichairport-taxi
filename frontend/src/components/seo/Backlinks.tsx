'use client';

// Backlinks tab: Search Console „Links“ CSV snapshots (new / lost domains, most linked pages)
// + visits that came through links on other websites (own tracking, with bookings).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, BellRing, ExternalLink, Globe, Info, Link2, Trash2, TrendingDown, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Switch } from '@/components/dashboard/shared';
import { seoApi, nf, eur, shortPath, Kpi, Empty } from './common';
import Outreach from './Outreach';

const KIND: Record<string, string> = { pages: 'Verweisende Seiten', sites: 'Top-verlinkende Websites', targets: 'Top-verlinkte Seiten' };
const SRC: Record<string, [string, string]> = {
  ai: ['Yapay zekâ', 'bg-violet-100 text-violet-700'],
  social: ['Sosyal medya', 'bg-sky-100 text-sky-700'],
  messenger: ['Mesajlaşma', 'bg-teal-100 text-teal-700'],
  web: ['Web sitesi', 'bg-gray-100 text-gray-600'],
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Backlinks({ onRemindersChange }: { onRemindersChange?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState(90);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    seoApi(`/backlinks?days=${days}`).then(setD).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    const done: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const csv = await f.text();
        const r = await seoApi('/backlinks/import', { method: 'POST', body: JSON.stringify({ filename: f.name, csv }) });
        done.push(`${f.name}: ${r.rows} satır (${KIND[r.kind] || r.kind})`);
      }
      setMsg({ ok: true, text: `Yüklendi — ${done.join(' · ')}` });
      load();
      onRemindersChange?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(id: number) {
    if (!confirm('Bu yüklemeyi silmek istiyor musun?')) return;
    await seoApi(`/backlinks/import/${id}`, { method: 'DELETE' });
    load();
    onRemindersChange?.();
  }

  async function toggleReminder() {
    await seoApi('/backlinks/reminder', { method: 'PUT', body: JSON.stringify({ enabled: !d?.reminder?.enabled }) });
    load();
    onRemindersChange?.();
  }

  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;

  const domains: any[] = d.domains || [];
  const newCount = domains.filter((x) => x.isNew).length;
  const refs: any[] = d.referrals || [];
  const refSessions = refs.reduce((a, r) => a + r.sessions, 0);
  const refBookings = refs.reduce((a, r) => a + r.bookings, 0);
  const refRevenue = refs.reduce((a, r) => a + r.revenue, 0);

  return (
    <div className="space-y-6">
      {d.reminder?.due && (
        <button onClick={() => fileRef.current?.click()} className="w-full text-left flex items-center gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200 px-5 py-4 hover:bg-red-100">
          <AlertTriangle className="text-red-600 shrink-0" size={22} />
          <div className="flex-1">
            <div className="font-semibold text-red-800">Bu ayın backlink CSV'si henüz yüklenmedi</div>
            <div className="text-sm text-red-700">
              Search Console → Links → „Externe Links exportieren“ → CSV. Yükleyince bu uyarı, SEO butonundaki 1 ve Handlungsbedarf'taki satır kaybolur.
              {d.reminder.lastUpload && <> Son yükleme: {fmt(d.reminder.lastUpload)}.</>}
            </div>
          </div>
          <Upload size={18} className="text-red-700 shrink-0" />
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Link veren domain" value={d.latest ? nf(domains.length) : '—'}
          delta={d.previous ? <span className={cn('text-xs font-semibold', domains.length >= (domains.length - newCount + d.lost.length) ? 'text-emerald-600' : 'text-red-600')}>+{newCount} / −{d.lost.length}</span> : undefined}
          sub={d.latest ? `Search Console · ${fmt(d.latest.created_at)}` : 'CSV yükle'} />
        <Kpi label="Toplam backlink" value={d.latest ? nf(domains.reduce((a, x) => a + x.links, 0)) : '—'} />
        <Kpi label={`Linkten gelen ziyaret (${days} gün)`} value={nf(refSessions)} sub={`${refs.length} site`} />
        <Kpi label="Linkten gelen rezervasyon" value={nf(refBookings)} sub={refRevenue ? eur(refRevenue) : undefined} tone="text-emerald-700" />
      </div>

      <Outreach />

      {/* Upload */}
      <Card title="Search Console backlink verisi" icon={Upload} right={
        <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5" title="Her ayın 1'inden itibaren, o ay yükleme yapılmadıysa SEO butonunda 1 ve Handlungsbedarf'ta uyarı">
          <BellRing size={14} className="text-gray-400" />
          <Switch on={d.reminder?.enabled !== false} onChange={toggleReminder} label="Aylık hatırlatma" />
        </span>
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          <Upload size={13} /> {busy ? 'Yükleniyor…' : 'CSV yükle'}
        </button>
        </div>
      }>
        <input ref={fileRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <div className="flex gap-2">
            <Info size={16} className="text-primary-500 shrink-0 mt-0.5" />
            <div>
              Google, backlink raporunu API ile vermiyor; dışa aktarıp buraya yüklemen gerekiyor (ayda bir yeterli, her yükleme bir öncekiyle karşılaştırılır):
              <ol className="mt-1 list-decimal pl-5 space-y-0.5 text-gray-700">
                <li>Search Console (<b>info@freising.taxi</b>) → mülk <b>https://flughafen-muenchen.taxi/</b> → sol menü <b>Links</b></li>
                <li>Sağ üstte <b>„Externe Links exportieren“</b> → <b>„Neueste Links“</b> → <b>CSV herunterladen</b></li>
                <li>İndirilen ZIP'i aç, içindeki CSV'yi buraya yükle. İstersen „Top-verlinkende Websites“ ve „Top-verlinkte Seiten“ tablolarının CSV'lerini de yükleyebilirsin.</li>
              </ol>
            </div>
          </div>
          {msg && <div className={cn('rounded-lg px-3 py-2 text-xs', msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>{msg.text}</div>}
          {d.imports?.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-gray-500 mb-1">Yüklemeler</div>
              <ul className="text-xs space-y-1">
                {d.imports.map((i: any) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <span className="text-gray-400 tabular-nums">{fmt(i.created_at)}</span>
                    <span className="text-gray-700 truncate">{i.filename}</span>
                    <span className="rounded bg-gray-100 px-1.5 text-gray-500">{KIND[i.kind] || i.kind}</span>
                    <span className="text-gray-400">{nf(i.rows_count)} satır</span>
                    <button onClick={() => remove(i.id)} className="ml-auto text-gray-300 hover:text-red-500" aria-label="Sil"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Linking domains */}
        <Card title="Link veren siteler" icon={Globe} right={d.previous && <span className="text-xs text-gray-400">{fmt(d.previous.created_at)} yüklemesine göre</span>}>
          {!d.latest ? <Empty>Henüz Search Console CSV'si yüklenmedi.</Empty> : (
            <>
              <ul className="divide-y divide-gray-100">
                {(showAll ? domains : domains.slice(0, 20)).map((x) => (
                  <li key={x.domain} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <img src={`https://www.google.com/s2/favicons?domain=${x.domain}&sz=32`} alt="" width={16} height={16} className="shrink-0 rounded" loading="lazy" />
                    <a href={x.sample || `https://${x.domain}`} target="_blank" rel="noopener noreferrer nofollow" className="truncate flex-1 font-medium text-gray-900 hover:underline">{x.domain}</a>
                    {x.isNew && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">yeni</span>}
                    <span className="text-xs tabular-nums text-gray-500 whitespace-nowrap">{nf(x.links)} link</span>
                  </li>
                ))}
              </ul>
              {domains.length > 20 && (
                <button onClick={() => setShowAll((v) => !v)} className="w-full border-t border-gray-100 py-2.5 text-sm font-semibold text-primary-600 hover:bg-gray-50">
                  {showAll ? 'Daha az göster' : `Tümünü göster (${domains.length})`}
                </button>
              )}
            </>
          )}
        </Card>

        <div className="space-y-6">
          {/* Lost */}
          <Card title="Kaybedilen backlinkler" icon={TrendingDown}>
            {!d.previous ? <Empty>İkinci yüklemeden sonra görünür.</Empty> : d.lost.length === 0 ? <Empty>Kayıp yok ✓</Empty> : (
              <ul className="divide-y divide-gray-100">
                {d.lost.slice(0, 20).map((x: any) => (
                  <li key={x.domain} className="px-5 py-2 flex items-center gap-3 text-sm">
                    <span className="truncate flex-1 text-gray-700">{x.domain}</span>
                    <span className="text-xs text-gray-400">önce {nf(x.links)} link</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Most linked pages */}
          <Card title="En çok link alan sayfalarımız" icon={Link2}>
            {!d.targets?.length ? <Empty>„Top-verlinkte Seiten“ CSV'si yüklenince görünür.</Empty> : (
              <ul className="divide-y divide-gray-100">
                {d.targets.map((t: any) => (
                  <li key={t.target} className="px-5 py-2 flex items-center gap-3 text-sm">
                    <span className="truncate flex-1 text-gray-700">{shortPath(t.target)}</span>
                    <span className="text-xs tabular-nums text-gray-500">{nf(t.links)} link</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Referral traffic */}
      <Card title="Başka sitelerdeki linklerden gelen ziyaretçiler" icon={ExternalLink} right={
        <div className="flex rounded-lg bg-gray-50 ring-1 ring-gray-200 p-0.5 text-xs">
          {[28, 90, 365].map((n) => (
            <button key={n} onClick={() => setDays(n)} className={cn('px-2.5 py-1 rounded-md font-medium', days === n ? 'bg-primary-600 text-white' : 'text-gray-600')}>{n} gün</button>
          ))}
        </div>
      }>
        <div className="px-5 pt-3 text-xs text-gray-500">Sitenin kendi verisi: gerçekten tıklanan ve müşteri getiren linkler (arama motorları ve ödeme sayfaları hariç).</div>
        {refs.length === 0 ? <Empty>Bu dönemde başka siteden gelen ziyaret yok.</Empty> : (
          <ul className="mt-2 divide-y divide-gray-100">
            {refs.map((r) => (
              <li key={r.host} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <img src={`https://www.google.com/s2/favicons?domain=${r.host}&sz=32`} alt="" width={16} height={16} className="shrink-0 rounded" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium text-gray-900">{r.host}</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', (SRC[r.source] || SRC.web)[1])}>{(SRC[r.source] || SRC.web)[0]}</span>
                  </div>
                  {r.landings.length > 0 && <div className="truncate text-[11px] text-gray-400">→ {r.landings.join(', ')}</div>}
                </div>
                <span className="text-xs tabular-nums text-gray-500 whitespace-nowrap">{nf(r.sessions)} ziyaret</span>
                <span className={cn('w-20 text-right text-xs font-semibold tabular-nums whitespace-nowrap', r.bookings ? 'text-emerald-600' : 'text-gray-300')}>{r.bookings} rez.</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
