'use client';

// Persönlicher Gutschein-Link aus der Admin-E-Mail: ?gutschein=GS-… prüfen, merken (localStorage),
// Parameter aus der Adresszeile entfernen und als schmale Leiste anzeigen, bis der Code
// eingelöst oder abgelaufen ist. Abgezogen wird auf /buchen (siehe lib/gutschein.ts).

import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { readGutschein, saveGutschein, clearGutschein, GUTSCHEIN_EVENT, StoredGutschein } from '@/lib/gutschein';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;
const HIDE_KEY = 'mt_gutschein_hidden'; // pro Sitzung zugeklappt

const TEXT: Record<string, { title: string; body: string; until: string; invalid: string }> = {
  de: { title: 'Ihr persönlicher Gutschein', body: 'auf Ihre nächste Fahrt – wird bei der Buchung automatisch abgezogen.', until: 'Gültig bis', invalid: 'Dieser Gutschein ist leider nicht mehr gültig.' },
  en: { title: 'Your personal voucher', body: 'off your next ride – deducted automatically when you book.', until: 'Valid until', invalid: 'Sorry, this voucher is no longer valid.' },
  tr: { title: 'Size özel kuponunuz', body: 'bir sonraki yolculuğunuzda – rezervasyonda otomatik düşülür.', until: 'Son geçerlilik', invalid: 'Bu kupon artık geçerli değil.' },
};

const fmtDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const fmtValue = (g: StoredGutschein, locale: string) =>
  g.type === 'fixed' ? `${g.value.toLocaleString('de-DE')} €` : locale === 'tr' ? `%${g.value}` : locale === 'en' ? `${g.value}%` : `${g.value} %`;

export default function GutscheinCapture({ locale }: { locale: string }) {
  const t = TEXT[locale] || TEXT.de;
  const [g, setG] = useState<StoredGutschein | null>(null);
  const [hidden, setHidden] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const sync = () => setG(readGutschein());
    sync();
    try { setHidden(sessionStorage.getItem(HIDE_KEY) === '1'); } catch { /* ignore */ }

    const url = new URL(window.location.href);
    const code = (url.searchParams.get('gutschein') || '').trim().toUpperCase();
    if (code) {
      url.searchParams.delete('gutschein');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      fetch(`${API_URL}/promotions/personal/${encodeURIComponent(code)}`)
        .then(r => r.json())
        .then(d => {
          if (d?.valid) {
            saveGutschein({ code, type: d.type, value: Number(d.value), end_date: d.end_date });
            try { sessionStorage.removeItem(HIDE_KEY); } catch { /* ignore */ }
            setHidden(false);
          } else {
            clearGutschein(code);
            setInvalid(true);
          }
          sync();
        })
        .catch(() => {});
    }
    window.addEventListener(GUTSCHEIN_EVENT, sync);
    return () => window.removeEventListener(GUTSCHEIN_EVENT, sync);
  }, []);

  if (invalid && !g) {
    return (
      <div className="bg-gray-100 border-b border-gray-200 text-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <span>{t.invalid}</span>
          <button onClick={() => setInvalid(false)} aria-label="Schließen" className="opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      </div>
    );
  }
  if (!g || hidden) return null;

  return (
    <div className="text-white shadow-md" style={{ background: '#0f1b2d' }}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 text-sm sm:text-base">
          <Gift size={18} className="shrink-0 text-gold-400" />
          <span className="min-w-0">
            <span className="font-semibold">{t.title}:</span>{' '}
            <strong className="bg-gold-400 text-[#0f1b2d] px-2 py-0.5 rounded font-extrabold mx-0.5 whitespace-nowrap">−{fmtValue(g, locale)}</strong>{' '}
            <span className="text-white/85">{t.body}</span>{' '}
            <span className="text-white/60 text-xs whitespace-nowrap">{t.until} {fmtDate(g.end_date)}</span>
          </span>
        </div>
        <button
          onClick={() => { setHidden(true); try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } }}
          aria-label="Schließen"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
