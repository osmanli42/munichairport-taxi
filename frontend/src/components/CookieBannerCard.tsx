'use client';

// System tab: Cookie-Banner als Leiste unten (Seite bleibt benutzbar) oder als Popup mittig
// (Seite abgedunkelt), plus Annahmequote je Darstellung aus der eigenen Besucherstatistik
// (GET /api/admin/consent-stats). So lässt sich vergleichen: Wie viele Google-Ads-Besucher
// gehen ohne Klick, wie viele stimmen zu, wie viele buchen.
import { useCallback, useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { adminApi, settingsApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

type Style = 'popup' | 'bottom';
interface StyleStats { style: Style; shown: number; all: number; necessary: number; custom: number; none: number; ads: number; ads_left_fast: number; booked: number }

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

export default function CookieBannerCard() {
  const [style, setStyle] = useState<Style | null>(null);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState<StyleStats[] | null>(null);

  useEffect(() => {
    settingsApi.getAll().then((s) => setStyle(s.cookie_banner_style === 'popup' ? 'popup' : 'bottom')).catch(() => setStyle('bottom'));
  }, []);

  const loadStats = useCallback(async () => {
    let token = '';
    try { token = localStorage.getItem('admin_token') || ''; } catch { /* ignore */ }
    try {
      const r = await fetch(`${API_URL}/admin/consent-stats?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setStats((await r.json()).styles || []);
    } catch { /* keep */ }
  }, [days]);
  useEffect(() => { loadStats(); }, [loadStats]);

  async function choose(next: Style) {
    if (style === next) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateSettings({ cookie_banner_style: next });
      setStyle(updated?.cookie_banner_style === 'popup' ? 'popup' : 'bottom');
    } catch { /* keep state */ }
    setSaving(false);
  }

  const btn = (s: Style, label: string) => (
    <button key={s} type="button" disabled={saving || style == null} onClick={() => choose(s)}
      className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${style === s ? 'bg-primary-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cookie size={18} className="text-gray-700" />
            <h3 className="font-bold text-gray-900 text-lg">Cookie-Banner</h3>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl">
            <b>Unten:</b> schmale Leiste am unteren Rand, die Seite bleibt sichtbar und benutzbar — weniger Besucher gehen sofort.
            {' '}<b>Popup:</b> Fenster in der Mitte, Seite abgedunkelt, bis eine Wahl getroffen ist — mehr Zustimmungen, aber mehr Absprünge.
            Ohne Zustimmung „Marketing“ wird eine Buchung nicht an Google Ads gemeldet (sie kommt trotzdem an).
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {btn('bottom', 'Unten')}
          {btn('popup', 'Popup')}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-700">Auswertung (Erstbesuche, Banner gezeigt)</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs border rounded-lg px-2 py-1 bg-white">
            <option value={7}>7 Tage</option>
            <option value={14}>14 Tage</option>
            <option value={30}>30 Tage</option>
          </select>
        </div>
        {!stats ? (
          <p className="text-xs text-gray-400">Lädt…</p>
        ) : stats.length === 0 ? (
          <p className="text-xs text-gray-500">Noch keine Daten — die Messung startet mit dieser Version.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-1.5 pr-3 font-medium">Darstellung</th>
                  <th className="py-1.5 pr-3 font-medium">Gezeigt</th>
                  <th className="py-1.5 pr-3 font-medium">Alle akzeptiert</th>
                  <th className="py-1.5 pr-3 font-medium">Nur notwendige</th>
                  <th className="py-1.5 pr-3 font-medium">Auswahl</th>
                  <th className="py-1.5 pr-3 font-medium">Keine Wahl</th>
                  <th className="py-1.5 pr-3 font-medium" title="Google-Ads-Besucher, die in unter 30 s ohne einen einzigen Klick gegangen sind">Ads: sofort weg</th>
                  <th className="py-1.5 font-medium">Gebucht</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.style} className="border-b border-gray-50 tabular-nums">
                    <td className="py-1.5 pr-3 font-semibold">{s.style === 'bottom' ? 'Unten' : 'Popup'}{s.style === style ? ' ✓' : ''}</td>
                    <td className="py-1.5 pr-3">{s.shown}</td>
                    <td className="py-1.5 pr-3">{pct(s.all, s.shown)}</td>
                    <td className="py-1.5 pr-3">{pct(s.necessary, s.shown)}</td>
                    <td className="py-1.5 pr-3">{pct(s.custom, s.shown)}</td>
                    <td className="py-1.5 pr-3">{pct(s.none, s.shown)}</td>
                    <td className="py-1.5 pr-3">{pct(s.ads_left_fast, s.ads)} <span className="text-gray-400 text-xs">({s.ads_left_fast}/{s.ads})</span></td>
                    <td className="py-1.5">{pct(s.booked, s.shown)} <span className="text-gray-400 text-xs">({s.booked})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2">
          Zum Vergleich vor der Umstellung (Popup, 3.–17.10., alle Google-Ads-Besucher): 11 % gingen in unter 30 s ohne jeden Klick (mobil 12 %).
        </p>
      </div>
    </div>
  );
}
