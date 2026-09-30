'use client';

// Site structure from the last audit (like Screaming Frog / Semrush Site Audit):
// structured data coverage, internal links incl. orphan pages, content length.

import { useEffect, useState } from 'react';
import { Braces, FileText, Network } from 'lucide-react';
import { Card } from '@/components/dashboard/shared';
import { seoApi, nf, shortPath, Empty } from './common';

const RICH: Record<string, string> = {
  FAQPage: 'SSS (soru-cevap açılır kutuları)',
  BreadcrumbList: 'Breadcrumb (adres yolu)',
  TaxiService: 'İşletme bilgisi',
  LocalBusiness: 'İşletme bilgisi',
  Event: 'Etkinlik',
  Service: 'Hizmet',
  WebSite: 'Site adı',
  Product: 'Ürün / fiyat',
  Organization: 'Kurum / logo',
};

export default function Structure() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { seoApi('/structure').then(setD).catch(() => setD({ pages: 0 })); }, []);
  if (!d) return <div className="h-40 bg-white rounded-2xl animate-pulse" />;
  if (!d.pages) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <Card title="Yapılandırılmış veri (zengin sonuçlar)" icon={Braces}>
        <ul className="divide-y divide-gray-100">
          {d.schema.map((s: any) => (
            <li key={s.type} className="px-5 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-gray-900">{s.type}</span>
                <span className="text-xs tabular-nums text-gray-500"><b className="text-gray-900">{s.pages}</b>/{d.pages} sayfa</span>
              </div>
              {RICH[s.type] && <div className="text-[11px] text-gray-400">{RICH[s.type]}</div>}
              <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(s.pages / d.pages) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
        {d.noSchema.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-amber-700">
            Schema'sız {d.noSchema.length} sayfa: {d.noSchema.slice(0, 5).map(shortPath).join(', ')}{d.noSchema.length > 5 ? ' …' : ''}
          </div>
        )}
      </Card>

      <Card title="İç linkler" icon={Network} right={d.avgInlinks != null && <span className="text-xs text-gray-400">ort. {nf(d.avgInlinks, 1)} gelen link / sayfa</span>}>
        {!d.inlinksKnown ? <Empty>Bir sonraki taramadan sonra görünür („Şimdi tara“).</Empty> : (
          <div>
            <div className={`mx-5 mt-4 rounded-xl px-4 py-3 text-sm ${d.orphans.length ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>
              {d.orphans.length
                ? <><b>{d.orphanCount ?? d.orphans.length}</b> yetim sayfa — sitedeki hiçbir sayfa bunlara link vermiyor. Google bunları zayıf sayar.</>
                : <>Yetim sayfa yok ✓ — her sayfaya en az bir iç link var.</>}
            </div>
            {d.orphans.length > 0 && (
              <ul className="mt-2 px-5 text-xs text-gray-600 space-y-0.5 max-h-40 overflow-y-auto">
                {d.orphans.map((o: any) => <li key={o.url} className="truncate">{shortPath(o.url)}</li>)}
              </ul>
            )}
            <div className="px-5 pt-4 pb-1 text-xs font-semibold text-gray-500">En az link alan sayfalar</div>
            <ul className="px-5 pb-4 space-y-1">
              {d.weakest.map((p: any) => (
                <li key={p.url} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-gray-700">{shortPath(p.url)}</span>
                  <span className="tabular-nums font-semibold text-amber-700">{p.inlinks}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title="İçerik uzunluğu" icon={FileText} right={d.avgWords != null && <span className="text-xs text-gray-400">ort. {nf(d.avgWords)} kelime</span>}>
        <div className="px-5 pt-4 pb-1 text-xs font-semibold text-gray-500">En kısa sayfalar</div>
        <ul className="px-5 pb-4 space-y-1">
          {d.thinnest.map((p: any) => (
            <li key={p.url} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-gray-700">{shortPath(p.url)}</span>
              <span className={`tabular-nums font-semibold ${p.words < 250 ? 'text-red-600' : p.words < 500 ? 'text-amber-600' : 'text-emerald-600'}`}>{nf(p.words)}</span>
            </li>
          ))}
        </ul>
        <div className="px-5 pb-4 text-[11px] text-gray-400">Rakiplerle yarışan ana sayfalarda 500+ kelime önerilir.</div>
      </Card>
    </div>
  );
}
