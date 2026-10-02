'use client';

// Booking card on a city landing page: trip-type tabs above the normal SearchBar. The city and "Flughafen München"
// are pre-filled as hints only (requireSelection): like on the home page, the customer must pick a full address
// (street + house number) from the suggestions and an airport terminal before the price is calculated.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const SearchBar = dynamic(() => import('@/components/SearchBar'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[252px] sm:h-[239px] lg:h-[65px] rounded-2xl bg-gray-100" />,
});

const AIRPORT_HINT = 'Flughafen München';
export type Mode = 'oneway' | 'return' | 'arrival';

export default function CityBooking({ pickup, tabs, people, initialMode = 'oneway' }: { pickup: string; tabs: [string, string, string]; people: [string, string]; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const back = new Date(tomorrow);
  back.setDate(back.getDate() + 7);
  const toCity = mode === 'arrival';
  return (
    <div className="rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/5 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {(['oneway', 'return', 'arrival'] as Mode[]).map((m, i) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn('shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm',
                mode === m ? 'bg-gold-400 text-primary-900 shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {tabs[i]}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-xs text-gray-600 sm:flex">
          <Users size={18} className="text-primary-600" />
          <span><b className="block text-gray-900">{people[0]}</b>{people[1]}</span>
        </div>
      </div>
      <SearchBar
        key={mode}
        requireSelection
        initialValues={{
          pickup: toCity ? AIRPORT_HINT : pickup,
          dropoff: toCity ? pickup : AIRPORT_HINT,
          date: tomorrow.toISOString().split('T')[0],
          time: '10:00',
          passengers: 2,
          hasReturn: mode === 'return',
          returnDate: back.toISOString().split('T')[0],
          returnTime: '16:00',
        }}
      />
    </div>
  );
}
