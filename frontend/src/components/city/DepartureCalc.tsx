'use client';

// "When should my taxi pick me up?" — flight time minus airport buffer minus the drive time for
// that hour (night / normal / rush hour from Google's traffic forecast) minus a safety margin.

import { useState } from 'react';
import { Clock, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

type T = {
  title: string; flightTime: string; flightType: string; eu: string; intl: string;
  result: string; drive: string; airport: string; buffer: string; note: string; unit: string;
};

const SAFETY_MIN = 15;

export default function DepartureCalc({ min, rush, night, t }: { min: number; rush: number | null; night: number | null; t: T }) {
  const [flight, setFlight] = useState('09:30');
  const [intl, setIntl] = useState(false);

  const [h, m] = flight.split(':').map(Number);
  const flightMin = (h || 0) * 60 + (m || 0);
  const airportMin = intl ? 180 : 120;
  // Drive time for the hour we would leave.
  const roughStart = flightMin - airportMin - min - SAFETY_MIN;
  const hour = (((Math.floor(roughStart / 60) % 24) + 24) % 24);
  const drive = hour < 6 || hour >= 22 ? (night ?? min) : (hour >= 6 && hour < 10) || (hour >= 16 && hour < 19) ? (rush ?? min) : min;
  const pickup = flightMin - airportMin - drive - SAFETY_MIN;
  const p = ((pickup % 1440) + 1440) % 1440;
  const fmt = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-gray-900"><Clock size={18} className="text-gold-600" /> {t.title}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-gray-500">
          {t.flightTime}
          <input type="time" value={flight} onChange={(e) => setFlight(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base font-semibold text-gray-900 focus:border-gold-400 focus:outline-none" />
        </label>
        <div className="text-xs font-medium text-gray-500">
          {t.flightType}
          <div className="mt-1 grid grid-cols-2 rounded-xl bg-gray-100 p-1">
            {[false, true].map((v) => (
              <button key={String(v)} type="button" onClick={() => setIntl(v)}
                className={cn('rounded-lg px-2 py-1.5 text-xs font-semibold', intl === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
                {v ? t.intl : t.eu}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-primary-900 px-4 py-3 text-white">
        <div className="text-xs text-white/70">{t.result}</div>
        <div className="text-3xl font-bold tabular-nums text-gold-400">{fmt(p)}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-white/70">
          <span>{t.drive}: ~{drive} {t.unit}</span>
          <span><Plane size={11} className="inline -mt-0.5" /> {t.airport}: {airportMin} {t.unit}</span>
          <span>{t.buffer}: {SAFETY_MIN} {t.unit}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">{t.note}</p>
    </div>
  );
}
