'use client';

import { useState, useEffect } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

const FAKE_BOOKINGS = [
  // Deutsche
  { name: 'Thomas M.', dest: 'zum Flughafen München' },
  { name: 'Hans B.', dest: 'Flughafen München' },
  { name: 'Maria W.', dest: 'zum Hauptbahnhof' },
  { name: 'Klaus F.', dest: 'nach Neuhausen' },
  { name: 'Anna S.', dest: 'Terminal 1, MUC' },
  { name: 'Julia H.', dest: 'nach Maxvorstadt' },
  { name: 'Stefan K.', dest: 'MUC Terminal 2' },
  // Türkisch
  { name: 'Ahmet K.', dest: 'Terminal 2, MUC' },
  { name: 'Elif D.', dest: 'nach Bogenhausen' },
  { name: 'Mehmet A.', dest: 'zum Flughafen München' },
  { name: 'Zeynep B.', dest: 'Flughafen München' },
  { name: 'Fatma C.', dest: 'zum Flughafen München' },
  { name: 'Emre Y.', dest: 'nach Schwabing' },
  // Englisch / Amerikanisch
  { name: 'Sarah L.', dest: 'nach Schwabing' },
  { name: 'James T.', dest: 'MUC Terminal 1' },
  { name: 'Emma H.', dest: 'Terminal 2, MUC' },
  { name: 'David W.', dest: 'zum Marriott Hotel' },
  { name: 'Robert B.', dest: 'nach Pasing' },
  // Italienisch
  { name: 'Marco R.', dest: 'Flughafen München' },
  { name: 'Giulia P.', dest: 'Terminal 2, MUC' },
  { name: 'Luca B.', dest: 'zum Flughafen München' },
  // Französisch
  { name: 'Pierre D.', dest: 'MUC Terminal 1' },
  { name: 'Sophie M.', dest: 'nach Sendling' },
  // Spanisch
  { name: 'Carlos G.', dest: 'zum Flughafen München' },
  { name: 'María L.', dest: 'Terminal 2, MUC' },
  // Arabisch
  { name: 'Omar A.', dest: 'Flughafen München' },
  { name: 'Fatima H.', dest: 'nach Moosach' },
  // Indisch
  { name: 'Raj P.', dest: 'MUC Terminal 2' },
  { name: 'Priya S.', dest: 'zum Flughafen München' },
  // Osteuropäisch
  { name: 'Piotr K.', dest: 'Terminal 1, MUC' },
  { name: 'Ivana M.', dest: 'zum Hauptbahnhof' },
  // Chinesisch / Koreanisch
  { name: 'Wei L.', dest: 'Flughafen München' },
  { name: 'Min-Jun K.', dest: 'zum Marriott Hotel' },
];

type SocialItem = { name: string; dest: string; minsAgo: number };

export default function SocialProofToast({ locale }: { locale: string }) {
  const [items, setItems] = useState<SocialItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/bookings/recent-social`)
      .then(r => r.json())
      .then((real: SocialItem[]) => {
        const fakeWithMins = FAKE_BOOKINGS.map(b => ({
          ...b,
          minsAgo: Math.floor(Math.random() * 55) + 3,
        }));
        const shuffled = [...fakeWithMins].sort(() => Math.random() - 0.5);
        const realMapped = (Array.isArray(real) ? real : []).map(r => ({
          name: r.name,
          dest: r.dest,
          minsAgo: Math.min(r.minsAgo, 120),
        }));
        const merged = [...realMapped, ...shuffled];
        merged.sort(() => Math.random() - 0.5);

        try {
          const raw = localStorage.getItem('mt_last_booking');
          if (raw) {
            const lb = JSON.parse(raw);
            if (Date.now() - lb.ts < 5 * 60 * 1000) {
              merged.unshift({ name: lb.name, dest: lb.dest, minsAgo: 1 });
            }
          }
        } catch {}

        setItems(merged.slice(0, 30));
      })
      .catch(() => {
        const fallback: SocialItem[] = FAKE_BOOKINGS.map(b => ({
          ...b,
          minsAgo: Math.floor(Math.random() * 55) + 3,
        })).sort(() => Math.random() - 0.5);
        try {
          const raw = localStorage.getItem('mt_last_booking');
          if (raw) {
            const lb = JSON.parse(raw);
            if (Date.now() - lb.ts < 5 * 60 * 1000) {
              fallback.unshift({ name: lb.name, dest: lb.dest, minsAgo: 1 });
            }
          }
        } catch {}
        setItems(fallback.slice(0, 30));
      });
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const showDelay = setTimeout(() => setVisible(true), 3000);
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent(i => (i + 1) % items.length);
        setVisible(true);
      }, 600);
    }, 12000);
    return () => { clearTimeout(showDelay); clearInterval(cycle); };
  }, [items]);

  if (items.length === 0) return null;
  const b = items[current];
  const label = locale === 'tr'
    ? `${b.minsAgo} dk önce: ${b.name} rezervasyon yaptı ✓`
    : locale === 'en'
    ? `${b.minsAgo} min ago: ${b.name} booked a ride ✓`
    : `Vor ${b.minsAgo} Min: ${b.name} hat Fahrt ${b.dest} gebucht ✓`;

  return (
    <div
      className="fixed bottom-6 left-4 z-50 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', pointerEvents: 'none' }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm">
        <span className="text-2xl">🚖</span>
        <div>
          <p className="text-xs font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">flughafen-muenchen.taxi</p>
        </div>
      </div>
    </div>
  );
}
