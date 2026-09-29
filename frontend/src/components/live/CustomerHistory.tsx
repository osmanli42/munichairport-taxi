'use client';

// Live tab: who a returning visitor is and what they booked before. Built from their
// bookings (this browser) plus bookings with the same e-mail / phone from other devices.

import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, Phone, Repeat } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';

export type CustomerHistoryData = {
  name: string;
  phone: string | null;
  email: string | null;
  language: string | null;
  count: number;
  cancelled: number;
  revenue: number;
  first_booking: string;
  other_devices: number;
  bookings: Array<{
    id: number;
    booking_number: string;
    created_utc: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_datetime: string;
    return_datetime: string | null;
    trip_type: string | null;
    vehicle_type: string;
    passengers: number;
    price: number;
    payment_method: string;
    status: string;
    company: boolean;
  }>;
};

const STATUS: Record<string, [string, string]> = {
  new: ['Yeni', 'bg-blue-100 text-blue-700'],
  confirmed: ['Onaylı', 'bg-emerald-100 text-emerald-700'],
  completed: ['Tamamlandı', 'bg-gray-100 text-gray-600'],
  cancelled: ['İptal', 'bg-red-100 text-red-700'],
};
const PAY: Record<string, string> = { card: 'Kart', cash: 'Nakit', ueberweisung: 'Havale', invoice: 'Fatura', rechnung: 'Fatura' };
const VEHICLE: Record<string, string> = { kombi: 'Kombi', van: 'Van', grossraumtaxi: 'Großraum' };

// pickup_datetime is Berlin wall-clock text — cut, don't convert.
const wallDate = (s?: string | null) => {
  const v = String(s || '').replace(' ', 'T');
  return v.length >= 16 ? `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(2, 4)} ${v.slice(11, 16)}` : '—';
};
const utcDate = (s: string) => new Date(s).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
const short = (a: string) => a.split(',')[0].replace(/Flughafen München.*/i, 'Flughafen MUC').slice(0, 40);

export default function CustomerHistory({ c, bookedNow }: { c: CustomerHistoryData; bookedNow: boolean }) {
  const [open, setOpen] = useState(!bookedNow);
  const [all, setAll] = useState(false);
  const list = all ? c.bookings : c.bookings.slice(0, 3);
  return (
    <div className="mb-2 rounded-lg border border-purple-200 bg-purple-50/70 text-xs text-purple-900">
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">👤 {c.name}</span>
          {c.phone && (
            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-purple-800 hover:underline"><Phone size={11} /> {c.phone}</a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-purple-800 hover:underline truncate max-w-[16rem]"><Mail size={11} /> {c.email}</a>
          )}
          {c.language && <span className="uppercase text-[10px] font-semibold bg-white/70 rounded px-1">{c.language}</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-purple-800">
          <span><b>{c.count}</b> sipariş</span>
          <span>Ciro <b>{formatPrice(c.revenue)}</b></span>
          {c.count > 0 && <span>Ø {formatPrice(c.revenue / c.count)}</span>}
          <span>İlk sipariş {utcDate(c.first_booking)}</span>
          {c.cancelled > 0 && <span className="text-red-600">{c.cancelled} iptal</span>}
          {c.other_devices > 0 && <span className="text-purple-600" title="Aynı e-posta veya telefon">+{c.other_devices} başka cihazdan</span>}
        </div>
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-1.5 border-t border-purple-200 text-left font-semibold hover:bg-purple-100/60"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Önceki siparişler ({c.bookings.length})
      </button>
      {open && (
        <ul className="divide-y divide-purple-100 border-t border-purple-200">
          {list.map((b) => {
            const [label, cls] = STATUS[b.status] || [b.status, 'bg-gray-100 text-gray-600'];
            return (
              <li key={b.id} className="px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{wallDate(b.pickup_datetime)}</span>
                  {b.trip_type === 'roundtrip' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-700 bg-violet-100 rounded px-1">
                      <Repeat size={9} /> Dönüş {wallDate(b.return_datetime)}
                    </span>
                  )}
                  <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', cls)}>{label}</span>
                  <span className="ml-auto font-semibold text-gray-900">{formatPrice(b.price)}</span>
                </div>
                <div className="mt-0.5 text-gray-700 truncate">{short(b.pickup_address)} → {short(b.dropoff_address)}</div>
                <div className="mt-0.5 text-[11px] text-purple-700/80">
                  {VEHICLE[b.vehicle_type] || b.vehicle_type} · {b.passengers} kişi · {PAY[b.payment_method] || b.payment_method}
                  {b.company && ' · Firma'} · sipariş {utcDate(b.created_utc)} · <span className="font-mono">{b.booking_number}</span>
                </div>
              </li>
            );
          })}
          {c.bookings.length > 3 && (
            <li>
              <button onClick={() => setAll((v) => !v)} className="w-full px-3 py-1.5 text-left text-purple-700 hover:bg-purple-100/60">
                {all ? 'Daha az göster' : `Tümünü göster (${c.bookings.length})`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
