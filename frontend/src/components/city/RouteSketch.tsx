// Stylised route sketch (not a real map): city pin → curved road with the main road's label →
// airport. The city sits on the side it really lies on relative to MUC (west → left).

import { MapPin, Plane } from 'lucide-react';

export default function RouteSketch({ city, airport, road, cityWest }: { city: string; airport: string; road: string | null; cityWest: boolean }) {
  const left = cityWest ? { name: city, kind: 'city' } : { name: airport, kind: 'airport' };
  const right = cityWest ? { name: airport, kind: 'airport' } : { name: city, kind: 'city' };
  const Pin = ({ kind }: { kind: string }) => (kind === 'airport'
    ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-800 text-white shadow-md ring-2 ring-white"><Plane size={16} /></span>
    : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-primary-900 shadow-md ring-2 ring-white"><MapPin size={16} /></span>);
  return (
    <div className="relative h-36 overflow-hidden rounded-xl bg-[#e8f1e4] ring-1 ring-black/5">
      <svg viewBox="0 0 400 144" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <g stroke="#ffffff" strokeWidth="6" fill="none" opacity="0.9">
          <path d="M-10 30 C 80 40, 140 10, 230 24 S 360 60, 410 40" />
          <path d="M-10 120 C 90 100, 170 132, 260 112 S 360 96, 410 118" />
          <path d="M120 -10 C 110 50, 150 90, 130 160" />
          <path d="M300 -10 C 290 40, 320 100, 296 160" />
        </g>
        <g fill="#cfe3c6"><ellipse cx="70" cy="95" rx="40" ry="16" /><ellipse cx="330" cy="30" rx="34" ry="12" /></g>
        <path d="M44 86 C 120 40, 170 104, 230 70 S 330 50, 356 62" stroke="#2a66aa" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-start gap-1">
        <Pin kind={left.kind} /><span className="max-w-[9rem] text-xs font-bold leading-tight text-gray-900">{left.name}</span>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end gap-1 text-right">
        <Pin kind={right.kind} /><span className="max-w-[9rem] text-xs font-bold leading-tight text-gray-900">{right.name}</span>
      </div>
      {road && <span className="absolute left-1/2 top-[38%] -translate-x-1/2 rounded-md bg-primary-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">{road}</span>}
    </div>
  );
}
