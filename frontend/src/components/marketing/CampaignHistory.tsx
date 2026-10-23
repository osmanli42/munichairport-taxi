'use client';

// Marketing → Gönderim geçmişi: pro Kampagne Empfänger, eingelöste Gutscheine, Buchungen der
// Empfänger in den 30 Tagen danach (auch ohne Gutschein) und Abmeldungen.

import { History } from 'lucide-react';
import type { MkCampaign } from '@/lib/api';
import { eur } from './helpers';

export default function CampaignHistory({ campaigns, names }: { campaigns: MkCampaign[]; names: Record<string, string> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <History size={17} className="text-gray-500" />
        <div>
          <p className="font-bold text-gray-900">Gönderim geçmişi</p>
          <p className="text-xs text-gray-500">„30 günde rezervasyon“: alıcılardan e-postadan sonraki 30 günde rezervasyon yapanlar (kuponlu veya kuponsuz)</p>
        </div>
      </div>
      {campaigns.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">Henüz kampanya gönderilmedi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Tarih</th>
                <th className="text-left font-semibold px-4 py-2">Kampanya</th>
                <th className="text-right font-semibold px-4 py-2">Gönderildi</th>
                <th className="text-left font-semibold px-4 py-2">İndirim</th>
                <th className="text-right font-semibold px-4 py-2">Kupon kullanıldı</th>
                <th className="text-right font-semibold px-4 py-2">30 günde rezervasyon</th>
                <th className="text-right font-semibold px-4 py-2">Çıkan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map(c => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{new Date(c.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{c.subject}</p>
                    <p className="text-xs text-gray-500">{c.occasion_id ? names[c.occasion_id] || c.occasion_id : 'Serbest e-posta'}{c.langs ? ` · ${c.langs.replace(/,/g, ' · ')}` : ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.sent}{c.failed > 0 && <span className="text-red-600"> / {c.failed} hata</span>}
                    {c.status === 'sending' && <span className="block text-xs text-amber-600">gönderiliyor…</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{c.discount ? `−%${c.discount.percent}${c.discount.maxAmount ? ` (max ${c.discount.maxAmount} €)` : ''}` : <span className="text-gray-400">tebrik</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.discount ? <>{c.redeemed.count}{c.redeemed.count > 0 && <span className="block text-xs text-gray-500">−{eur(c.redeemed.discount)} · {eur(c.redeemed.revenue)}</span>}</> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.booked.count}{c.booked.count > 0 && <span className="block text-xs text-gray-500">{eur(c.booked.revenue)}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{c.unsubscribed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
