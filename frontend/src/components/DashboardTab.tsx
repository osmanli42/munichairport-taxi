'use client';

// Admin dashboard ("Übersicht"). All data comes from GET /api/admin/dashboard, which works
// in Berlin time. pickup_datetime / return_datetime are Berlin wall-clock strings, so times
// are shown by cutting the string — never through new Date(), which would shift them by the
// browser's time zone. "Now" is taken from the Berlin clock for the same reason.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Banknote, BarChart3, Building2, CalendarDays, CheckCircle2, ChevronRight,
  Clock, CreditCard, ExternalLink, Eye, FileText, History, LayoutGrid, Wallet, FileWarning, Landmark, Luggage, Phone, PlaneLanding,
  PlaneTakeoff, Receipt, RefreshCw, Repeat, TrendingDown, TrendingUp, Users, Zap, Car, Network, MousePointerClick,
  EllipsisVertical, Copy, UserRound, CarFront, Bus, MapPin, ArrowUp, ArrowDown, Euro, ChevronDown, Flag, Move,
  Megaphone, MailWarning,
} from 'lucide-react';
import { adminApi, Booking } from '@/lib/api';
import { formatPrice, cn } from '@/lib/utils';
import {
  berlinNowWall, wall, hhmm, wallMinutes, addDays, dayLabel, fmtDuration, fmtAgo, plural, MONTHS, isAirport, Card,
} from './dashboard/shared';
import QuickActions from './dashboard/QuickActions';
import EventsStrip from './dashboard/EventsStrip';
import FlightBoard from './dashboard/FlightBoard';
import { useDayArchive, ArchiveResults } from './dashboard/DayArchive';
import DriverPlan from './dashboard/DriverPlan';
import CapacityHeatmap, { CapacityEntry } from './dashboard/CapacityHeatmap';
import MissedCustomers from './dashboard/MissedCustomers';
import { ForecastCard, FunnelCard, ReceivablesCard } from './dashboard/BusinessCards';
import type { Flights, WidgetOverview } from './dashboard/types';
import { DashGrid, useDashLayout, type LayoutEntry } from './dashboard/LayoutGrid';

// Standard-Anordnung (12er-Raster); der Nutzer kann sie im Modus „Anordnen“ ändern
const DEFAULT_LAYOUT: LayoutEntry[] = [
  { id: 'attention', w: 12 },
  { id: 'kpi_rides', w: 3 }, { id: 'kpi_new', w: 3 }, { id: 'kpi_week', w: 3 }, { id: 'kpi_month', w: 3 },
  { id: 'schedule', w: 8, tall: true }, { id: 'flights', w: 4 }, { id: 'charges', w: 4 },
  { id: 'drivers', w: 3 }, { id: 'forecast', w: 3 }, { id: 'funnel', w: 3 }, { id: 'receivables', w: 3 },
  { id: 'quick', w: 12 }, { id: 'archive', w: 12 }, { id: 'events', w: 12 },
  { id: 'missed', w: 12 }, { id: 'capacity', w: 12 },
  { id: 'chart', w: 8 }, { id: 'month', w: 4 },
  { id: 'totals', w: 12 },
  { id: 'recent', w: 8 }, { id: 'reports', w: 4 },
];

// ---------------------------------------------------------------------------------------
// Types

type Agg = { count: number; revenue: number };

type Leg = Booking & {
  leg: 'hin' | 'rueck';
  leg_time: string; // 'YYYY-MM-DDTHH:mm', Berlin
  company_name?: string | null;
  driver_name?: string | null;
  driver_status?: string | null;
};

type Recent = Pick<Booking, 'id' | 'booking_number' | 'name' | 'pickup_address' | 'dropoff_address' |
  'pickup_datetime' | 'return_datetime' | 'trip_type' | 'vehicle_type' | 'price' | 'status' | 'payment_method' |
  'ueberweisung_paid_at' | 'charge_status'> & {
  company_name?: string | null;
  created_berlin: string;
};

interface DashboardData {
  now: string;
  today: string;
  legs: Leg[];
  intake: Record<'today' | 'yesterdaySameTime' | 'yesterday' | 'week' | 'prevWeek' | 'mtd' | 'prevMtd' | 'prevMonth', Agg>;
  /** The part of today / yesterday / the 7 days that was entered in the Google Calendar (already inside `intake`). */
  intakeCalendar?: Record<'today' | 'yesterday' | 'week', Agg>;
  chart: Array<{ date: string } & Agg>;
  month: { month: string; payment: Record<string, Agg>; status: Record<string, number> };
  attention: Record<AttentionKey, Leg[]> & {
    /** Card rides still to charge: tomorrow's after 20:15, today's upcoming ones always. */
    cardsUncharged?: UnchargedCard[];
    /** Monthly Search Console backlink export not uploaded yet (SEO → Backlinks). */
    seoBacklinks?: { lastUpload: string | null } | null;
    /** Pages that dropped out of Google's index (SEO → Indexierung). */
    seoIndex?: { dropped: number } | null;
    /** Weekly Google Ads report upload (Google Ads → Veri & Bağlantı) not done yet. */
    adsReports?: { lastUpload: string | null } | null;
    /** Month over (or its last day): Sammelrechnungen / calendar Rechnung rides not sent yet. */
    monthEndInvoices?: {
      companies: Array<{ company_id: number; company_name: string; month: string; rides: number; total: number }>;
      calendar: Array<{ month: string; rides: number }>;
    } | null;
    /** Marketing occasion whose reminder window is open (Admin → Marketing). */
    marketing?: Array<{ id: string; name: string; date: string; daysLeft: number; urgent: boolean }> | null;
  };
  card_deadline?: string;
  recent: Recent[];
  calendar: { enabled: boolean; error: string | null; legs: CalLeg[]; mismatches: CalMismatch[] };
  /** Calendar-only rides this month up to now (by ride date); null when switched off in Statistik. */
  calendarMonth: CalSum | null;
  calendarPrevMonth: CalSum | null;
  /** All calendar-only rides up to now; null when switched off in Statistik. */
  calendarTotal: CalSum | null;
  allTime: Agg;
}

type CalSum = { count: number; priced: number; revenue: number };
type AttentionKey = 'unconfirmed' | 'failedCharges' | 'unpaidTransfers' | 'invoiceFailed' | 'openStatus' | 'mailFailed';

type UnchargedCard = {
  id: number;
  booking_number: string;
  name: string;
  pickup_datetime: string;
  price: number;
  company_id: number | null;
  card_brand: string | null;
  card_last4: string | null;
  charge_status: string | null;
  charge_error: string | null;
  legacy_card: boolean;
  day: 'today' | 'tomorrow';
};

type CalLeg = {
  uid: string;
  leg_time: string;
  summary: string;
  location: string; // operator's notes: driver, "Get-e", "KK bende", …
  from: string | null;
  to: string | null;
  via: string[];
  guest: string | null;
  price: number | null;
  html_link: string | null;
};

type CalMismatch = {
  id: number;
  booking_number: string;
  name: string;
  price: number;
  booking_time: string;
  calendar_time: string;
  html_link: string | null;
};

interface Props {
  /** Bumped by the page after something changed a booking (e.g. a card was charged). */
  reloadToken: number;
  onOpenBooking: (id: number) => void;
  onShowCard: (b: Booking) => void;
  onCharge: (id: number) => Promise<void>;
  chargingId: number | null;
  onNewBooking: () => void;
  onGoTab: (tab: string) => void;
}

// Sections the viewer can hide (per browser). Fahrplan, KPIs and Handlungsbedarf always show.
const WIDGETS: Array<[string, string]> = [
  ['kpi_rides', 'Fahrten heute'], ['kpi_new', 'Neue Buchungen heute'], ['kpi_week', 'Letzte 7 Tage'], ['kpi_month', 'Monat bis heute'],
  ['quick', 'Schnellaktionen'], ['events', 'Feiertage & Events'], ['flights', 'Flugstatus'],
  ['charges', 'Morgen abbuchen'], ['drivers', 'Fahrer-Einsatzplan'], ['missed', 'Verpasste Kunden'],
  ['forecast', 'Monatsprognose'], ['funnel', 'Website heute'], ['receivables', 'Offene Forderungen'],
  ['capacity', 'Auslastung 7 Tage'], ['chart', 'Buchungseingang'], ['month', 'Monat im Überblick'],
  ['recent', 'Letzte Buchungen'], ['reports', 'Finanzamt-Bericht'], ['archive', 'Tagesarchiv'], ['totals', 'Vormonat & Gesamtumsatz'],
];
const HIDDEN_KEY = 'dash_hidden_widgets';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const authHeader = () => {
  try { return { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }; } catch { return {} as Record<string, string>; }
};


const CAL_PREF_KEY = 'dash_show_calendar';

// ---------------------------------------------------------------------------------------
// Small building blocks

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  new: { label: 'Neu', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  confirmed: { label: 'Bestätigt', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  completed: { label: 'Abgeschlossen', cls: 'bg-gray-50 text-gray-600 ring-gray-200' },
  cancelled: { label: 'Storniert', cls: 'bg-red-50 text-red-700 ring-red-200' },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { label: status, cls: 'bg-gray-50 text-gray-600 ring-gray-200' };
  return <span className={cn('inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap', s.cls)}>{s.label}</span>;
}

const PAYMENT_STYLE: Record<string, { label: string; cls: string; bar: string; Icon: typeof CreditCard }> = {
  card: { label: 'Karte', cls: 'bg-blue-50 text-blue-700', bar: 'bg-blue-500', Icon: CreditCard },
  cash: { label: 'Bar', cls: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', Icon: Banknote },
  ueberweisung: { label: 'Überweisung', cls: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', Icon: Landmark },
  transfer: { label: 'Überweisung', cls: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', Icon: Landmark },
  rechnung: { label: 'Rechnung', cls: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500', Icon: FileText },
  invoice: { label: 'Rechnung', cls: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500', Icon: FileText },
};
const paymentStyle = (m?: string | null) => PAYMENT_STYLE[m || 'cash'] || { label: m || '—', cls: 'bg-gray-50 text-gray-600', bar: 'bg-gray-400', Icon: Banknote };

function PaymentChip({ b }: { b: Pick<Booking, 'payment_method' | 'ueberweisung_paid_at' | 'charge_status'> }) {
  const p = paymentStyle(b.payment_method);
  const paid = (b.payment_method === 'ueberweisung' && b.ueberweisung_paid_at) || (b.payment_method === 'card' && b.charge_status === 'succeeded');
  const failed = b.payment_method === 'card' && b.charge_status === 'failed';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', failed ? 'bg-red-50 text-red-700' : p.cls)}>
      <p.Icon size={12} />
      {p.label}
      {paid && <CheckCircle2 size={11} />}
      {failed && <AlertTriangle size={11} />}
    </span>
  );
}

const VEHICLE_LABELS: Record<string, string> = { kombi: 'Kombi', van: 'Van', grossraumtaxi: 'Großraum' };

function DeltaChip({ cur, prev, suffix }: { cur: number; prev: number; suffix: string }) {
  if (!prev && !cur) return <span className="text-xs text-gray-400">keine Daten {suffix}</span>;
  if (!prev) return <span className="text-xs font-medium text-emerald-600">neu {suffix}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      <span className="whitespace-nowrap">{up ? '+' : ''}{pct} %</span>
      <span className="font-normal text-gray-400">{suffix}</span>
    </span>
  );
}


// ---------------------------------------------------------------------------------------
// Ride schedule

type LegState = 'past' | 'running' | 'next' | 'upcoming';

function legRoute(l: Leg) {
  // A Rückfahrt goes from the destination back to the start.
  return l.leg === 'rueck'
    ? { from: l.dropoff_address, to: l.pickup_address, via: null as string | null }
    : { from: l.pickup_address, to: l.dropoff_address, via: l.zwischenstopp_address || null };
}

const VEHICLE_ICON: Record<string, typeof Car> = { kombi: Car, van: CarFront, grossraumtaxi: Bus };

function TimeCell({ time, state, now }: { time: string; state: LegState; now: string }) {
  const minutesTo = wallMinutes(time) - wallMinutes(now);
  return (
    <div className="w-14 shrink-0 pt-0.5">
      <div className={cn('text-lg font-bold tabular-nums leading-tight', state === 'past' ? 'text-gray-500' : 'text-gray-900')}>{hhmm(time)}</div>
      <div className={cn('mt-0.5 text-[11px] font-medium', state === 'running' ? 'text-emerald-600' : state === 'next' ? 'text-blue-600' : 'text-gray-400')}>
        {state === 'past' ? 'vorbei' : state === 'running' ? 'läuft' : minutesTo < 24 * 60 ? `in ${fmtDuration(minutesTo)}` : dayLabel(time.slice(0, 10), { weekday: 'short' })}
      </div>
    </div>
  );
}

/** Start und Ziel je in einer eigenen Zeile – volle Adresse, nur am Zeilenende gekürzt (Tooltip zeigt alles) */
function Route({ from, to, via }: { from: string | null | undefined; to: string | null | undefined; via?: string | null }) {
  const FromIcon = isAirport(from) ? PlaneLanding : MapPin;
  const ToIcon = isAirport(to) ? PlaneTakeoff : Flag;
  return (
    <div className="mt-1 space-y-0.5 text-sm">
      <div className="flex min-w-0 items-center gap-2" title={from || ''}>
        <FromIcon size={14} className="shrink-0 text-blue-500" aria-hidden />
        <span className="sr-only">Von:</span>
        <span className="truncate text-gray-800">{from || '—'}</span>
      </div>
      {via && (
        <div className="flex min-w-0 items-center gap-2 pl-[22px] text-xs text-gray-500" title={via}>
          <span className="truncate">über {via}</span>
        </div>
      )}
      {to && (
        <div className="flex min-w-0 items-center gap-2" title={to}>
          <ToIcon size={14} className="shrink-0 text-emerald-600" aria-hidden />
          <span className="sr-only">Nach:</span>
          <span className="truncate text-gray-800">{to}</span>
        </div>
      )}
    </div>
  );
}

/** ⋮-Menü einer Fahrplan-Zeile */
function RowMenu({ items }: { items: Array<{ label: string; Icon: typeof Clock; onClick?: () => void; href?: string }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Aktionen"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <EllipsisVertical size={17} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-gray-200">
          {items.map(({ label, Icon, onClick, href }) => {
            const cls = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50';
            return href ? (
              <a key={label} role="menuitem" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={cls} onClick={() => setOpen(false)}>
                <Icon size={15} className="text-gray-400" aria-hidden /> {label}
              </a>
            ) : (
              <button key={label} role="menuitem" type="button" className={cls} onClick={() => { setOpen(false); onClick?.(); }}>
                <Icon size={15} className="text-gray-400" aria-hidden /> {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const copyText = (t: string) => { try { navigator.clipboard?.writeText(t); } catch { /* ignore */ } };

function rowCls(state: LegState, extra?: string) {
  return cn(
    'flex items-start gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:bg-blue-50',
    state === 'past' && 'opacity-70',
    state === 'next' && 'bg-blue-50/60 hover:bg-blue-50',
    state === 'running' && 'bg-emerald-50/60 hover:bg-emerald-50',
    state !== 'next' && state !== 'running' && 'hover:bg-gray-50',
    extra,
  );
}

function LegRow({ l, state, now, onOpen }: { l: Leg; state: LegState; now: string; onOpen: () => void }) {
  const { from, to, via } = legRoute(l);
  const roundtrip = l.trip_type === 'roundtrip';
  const VIcon = VEHICLE_ICON[l.vehicle_type] || Car;
  const money = (
    <>
      <div className="text-base font-bold tabular-nums text-gray-900">{formatPrice(l.price)}</div>
      {roundtrip && <div className="-mt-0.5 text-[10px] text-gray-400">Hin + Rück gesamt</div>}
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <PaymentChip b={l} />
        <StatusChip status={l.status} />
      </div>
    </>
  );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={rowCls(state)}
    >
      <TimeCell time={l.leg_time} state={state} now={now} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="max-w-full truncate text-[15px] font-semibold text-gray-900">{l.name}</span>
          {roundtrip && (
            <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              l.leg === 'rueck' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700')}>
              <Repeat size={11} /> {l.leg === 'rueck' ? 'Rückfahrt' : 'Hinfahrt'}
            </span>
          )}
          {l.company_name && <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600"><Building2 size={11} /> {l.company_name}</span>}
          {state === 'next' && <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nächste Fahrt</span>}
        </div>
        <Route from={from} to={to} via={via} />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><VIcon size={13} /> {VEHICLE_LABELS[l.vehicle_type] || l.vehicle_type}</span>
          <span className="inline-flex items-center gap-1"><Users size={12} /> {l.passengers}</span>
          {!!l.luggage_count && <span className="inline-flex items-center gap-1"><Luggage size={12} /> {l.luggage_count}</span>}
          {l.leg === 'hin' && l.flight_number && <span className="inline-flex items-center gap-1 font-semibold text-gray-700"><PlaneLanding size={12} /> {l.flight_number}</span>}
          {l.driver_name && <span className="inline-flex items-center gap-1 text-emerald-700"><UserRound size={12} /> {l.driver_name}</span>}
          {l.phone && (
            <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-blue-600">
              <Phone size={12} /> {l.phone}
            </a>
          )}
          {l.notes?.includes('🐾') && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title="Haustier im Käfig">🐾 Haustier</span>}
          <span className="font-mono text-gray-400">{l.booking_number}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">{money}</div>
      </div>
      <div className="hidden w-36 shrink-0 flex-col items-end gap-1 text-right sm:flex">{money}</div>
      <div className="shrink-0">
        <RowMenu items={[
          { label: 'Buchung öffnen', Icon: Eye, onClick: onOpen },
          ...(l.phone ? [{ label: `Anrufen ${l.phone}`, Icon: Phone, href: `tel:${l.phone}` }] : []),
          { label: 'Buchungsnummer kopieren', Icon: Copy, onClick: () => copyText(l.booking_number) },
        ]} />
      </div>
    </div>
  );
}

// Rides that exist only in the operator's Google Calendar (phone, Get-e, partners).
const RE_FLIGHT = /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}[A-Z]?$/;

function CalendarRow({ c, state, now }: { c: CalLeg; state: LegState; now: string }) {
  const from = c.from || c.summary;
  const to = c.to;
  const flight = RE_FLIGHT.test(c.summary.trim()) ? c.summary.trim() : null;
  const title = c.guest || (flight ? `Flug ${flight}` : 'Kalender-Fahrt');
  const open = () => { if (c.html_link) window.open(c.html_link, '_blank', 'noopener'); };
  const money = (
    <>
      <div className="text-base font-bold tabular-nums text-gray-900">{c.price ? formatPrice(c.price) : '—'}</div>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700"><ExternalLink size={11} /> im Kalender</span>
    </>
  );
  return (
    <div
      role={c.html_link ? 'link' : undefined}
      tabIndex={c.html_link ? 0 : undefined}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
      title="Im Google Kalender öffnen"
      className={rowCls(state, 'border-l-[3px] border-teal-400 pl-[13px] sm:pl-[17px]')}
    >
      <TimeCell time={c.leg_time} state={state} now={now} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="max-w-full truncate text-[15px] font-semibold text-gray-900">{title}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
            <CalendarDays size={11} /> Kalender
          </span>
          {state === 'next' && <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nächste Fahrt</span>}
        </div>
        <Route from={from} to={to} via={c.via.length ? c.via.join(', ') : null} />
        {(flight || c.location) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            {flight && <span className="inline-flex items-center gap-1 font-semibold text-gray-700"><PlaneLanding size={12} /> {flight}</span>}
            {c.location && <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-gray-600"><UserRound size={12} className="shrink-0" /> <span className="truncate">{c.location}</span></span>}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">{money}</div>
      </div>
      <div className="hidden w-36 shrink-0 flex-col items-end gap-1 text-right sm:flex">{money}</div>
      <div className="shrink-0">
        {c.html_link ? <RowMenu items={[{ label: 'Im Kalender öffnen', Icon: ExternalLink, href: c.html_link }]} /> : <span className="block h-8 w-8" />}
      </div>
    </div>
  );
}

type Item = { kind: 'booking'; time: string; leg: Leg } | { kind: 'calendar'; time: string; cal: CalLeg };

function daySummary(items: Item[]) {
  const legs = items.flatMap((i) => (i.kind === 'booking' ? [i.leg] : []));
  const cals = items.flatMap((i) => (i.kind === 'calendar' ? [i.cal] : []));
  const unique = new Map<number, Leg>();
  for (const l of legs) unique.set(l.id, l);
  const revenue = Array.from(unique.values()).reduce((s, l) => s + (Number(l.price) || 0), 0);
  const byPay: Record<string, number> = {};
  for (const l of legs) {
    const k = paymentStyle(l.payment_method).label;
    byPay[k] = (byPay[k] || 0) + 1;
  }
  return {
    count: items.length,
    hin: legs.filter((l) => l.leg === 'hin').length,
    rueck: legs.filter((l) => l.leg === 'rueck').length,
    revenue,
    byPay,
    cal: cals.length,
    calRevenue: cals.reduce((s, c) => s + (Number(c.price) || 0), 0),
  };
}

function itemStates(items: Item[], now: string): LegState[] {
  const nowMin = wallMinutes(now);
  let nextGiven = false;
  return items.map((it) => {
    const start = wallMinutes(it.time);
    const dur = it.kind === 'booking' ? Math.max(Number(it.leg.duration_minutes) || 0, 30) : 45;
    if (nowMin >= start + dur || (it.kind === 'booking' && it.leg.status === 'completed')) return 'past';
    if (nowMin >= start) return 'running';
    if (!nextGiven) { nextGiven = true; return 'next'; }
    return 'upcoming';
  });
}

type ScheduleView = 'heute' | 'morgen' | 'woche';
const COLLAPSED_ROWS = 8;

function Schedule({ items, now, onOpen, calendar, showCal, onToggleCal }: {
  items: Item[]; now: string; onOpen: (id: number) => void;
  calendar: DashboardData['calendar']; showCal: boolean; onToggleCal: () => void;
}) {
  const [view, setView] = useState<ScheduleView>('heute');
  const [expanded, setExpanded] = useState(false);
  const today = now.slice(0, 10);
  const tomorrow = addDays(today, 1);
  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      const d = it.time.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(it);
    }
    return m;
  }, [items]);

  const days = view === 'heute' ? [today] : view === 'morgen' ? [tomorrow] : Array.from(byDay.keys()).sort();
  const count = (d: string) => byDay.get(d)?.length || 0;
  const tabs: Array<{ id: ScheduleView; label: string; n: number }> = [
    { id: 'heute', label: 'Heute', n: count(today) },
    { id: 'morgen', label: 'Morgen', n: count(tomorrow) },
    { id: 'woche', label: '7 Tage', n: items.length },
  ];
  const viewItems = days.flatMap((d) => byDay.get(d) || []);
  const total = viewItems.length;
  const sum = daySummary(viewItems);

  // Eingeklappt: höchstens 8 Zeilen, beginnend kurz vor der nächsten Fahrt (heute), damit Anstehendes sichtbar bleibt
  const todayStates = view === 'heute' ? itemStates(viewItems, now) : null;
  const firstOpen = todayStates ? Math.max(0, todayStates.findIndex((s) => s !== 'past')) : 0;
  const startAt = !expanded && total > COLLAPSED_ROWS ? Math.max(0, Math.min(firstOpen - 2, total - COLLAPSED_ROWS)) : 0;
  const endAt = !expanded && total > COLLAPSED_ROWS ? startAt + COLLAPSED_ROWS : total;
  let shown = 0;

  return (
    <Card
      title={view === 'heute' ? 'Fahrplan – Heute' : view === 'morgen' ? 'Fahrplan – Morgen' : 'Fahrplan – 7 Tage'}
      icon={CalendarDays}
      right={(
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex flex-1 gap-1 sm:flex-none" role="tablist" aria-label="Zeitraum">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={view === t.id}
                onClick={() => { setView(t.id); setExpanded(false); }}
                className={cn('inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors sm:flex-none',
                  view === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100')}
              >
                {t.label}
                <span className={cn('min-w-[1.5rem] rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums', view === t.id ? 'bg-primary-900/90 text-white' : 'bg-gray-100 text-gray-600')}>{t.n}</span>
              </button>
            ))}
          </div>
          {calendar.enabled && (
            <button
              onClick={onToggleCal}
              title={calendar.error ? `Kalender: ${calendar.error}` : 'Fahrten aus dem Google Kalender ein-/ausblenden'}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset transition-colors',
                calendar.error ? 'bg-red-50 text-red-600 ring-red-200'
                  : showCal ? 'bg-white text-blue-700 ring-blue-200 hover:bg-blue-50' : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50')}
            >
              <CalendarDays size={15} />
              Kalender {calendar.error ? '⚠' : showCal ? 'an' : 'aus'}
            </button>
          )}
        </div>
      )}
    >
      {total === 0 ? (
        <div className="px-5 py-12 text-center">
          <CalendarDays size={28} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            {view === 'heute' ? 'Heute keine Fahrten' : view === 'morgen' ? 'Morgen keine Fahrten' : 'Keine Fahrten in den nächsten 7 Tagen'}
          </p>
        </div>
      ) : (
        <>
          {days.map((d) => {
            const dayItems = byDay.get(d) || [];
            if (!dayItems.length) return null;
            const states: LegState[] = d === today ? itemStates(dayItems, now) : dayItems.map(() => 'upcoming');
            const firstUpcoming = states.findIndex((s) => s !== 'past');
            const rows = dayItems.map((it, i) => {
              const idx = shown++;
              if (idx < startAt || idx >= endAt) return null;
              return (
                <div key={it.kind === 'booking' ? `${it.leg.id}-${it.leg.leg}` : `cal-${it.cal.uid}-${it.time}`}>
                  {d === today && i === firstUpcoming && firstUpcoming > 0 && (
                    <div className="flex items-center gap-2 px-5 py-1 text-[11px] font-bold text-red-500">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> Jetzt {hhmm(now)} <span className="h-px flex-1 bg-red-300" />
                    </div>
                  )}
                  {it.kind === 'booking'
                    ? <LegRow l={it.leg} state={states[i]} now={now} onOpen={() => onOpen(it.leg.id)} />
                    : <CalendarRow c={it.cal} state={states[i]} now={now} />}
                </div>
              );
            });
            if (rows.every((r) => r === null)) return null;
            const ds = daySummary(dayItems);
            return (
              <div key={d}>
                {view === 'woche' && (
                  <div className="flex items-center justify-between border-y border-gray-100 bg-gray-50/95 px-5 py-2 text-xs">
                    <span className="font-semibold text-gray-700">
                      {d === today ? 'Heute' : d === tomorrow ? 'Morgen' : dayLabel(d, { weekday: 'long' })}
                      <span className="font-normal text-gray-400"> · {dayLabel(d, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </span>
                    <span className="text-gray-500">{plural(ds.count, 'Fahrt', 'Fahrten')}{ds.cal > 0 && <span className="text-teal-600"> · {ds.cal} Kalender</span>}</span>
                  </div>
                )}
                <div className="divide-y divide-gray-100">{rows}</div>
              </div>
            );
          })}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {total > COLLAPSED_ROWS && (
                <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  {expanded ? 'Weniger anzeigen' : `Alle ${total} Fahrten anzeigen`}
                  <ArrowRight size={15} className={cn('transition-transform', expanded && '-rotate-90')} />
                </button>
              )}
              <span className="text-xs text-gray-500">
                {sum.rueck > 0 && <>{sum.hin} Hin · {sum.rueck} Rück · </>}
                {Object.entries(sum.byPay).map(([k, n]) => `${n} ${k}`).join(' · ')}
                {sum.cal > 0 && <span className="text-teal-600"> · {sum.cal} Kalender</span>}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-600">Umsatz ({view === 'heute' ? 'Heute' : view === 'morgen' ? 'Morgen' : '7 Tage'}): </span>
              <span className="text-lg font-bold tabular-nums text-emerald-600">{formatPrice(sum.revenue)}</span>
              {sum.calRevenue > 0 && <span className="block text-[11px] text-teal-600">+ Kalender ca. {formatPrice(sum.calRevenue)}</span>}
            </div>
          </footer>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Attention panel

function AttentionPanel({ a, mismatches, deadline, onOpen, onGoTab, hideWhenEmpty }: {
  a: DashboardData['attention']; mismatches: CalMismatch[]; deadline: string; onOpen: (id: number) => void; onGoTab: (tab: string) => void;
  hideWhenEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cards = a.cardsUncharged || [];
  // A failed charge for a ride that is already listed under "nicht abgebucht" shows once.
  const cardIds = new Set(cards.map((c) => c.id));
  a = { ...a, failedCharges: a.failedCharges.filter((l) => !cardIds.has(l.id)) };
  const groups: Array<{ key: AttentionKey; title: string; hint: string; Icon: typeof Clock; tone: string }> = [
    { key: 'mailFailed', title: 'Buchungsmail nicht zugestellt', hint: 'Automatischer Versand mehrmals fehlgeschlagen — Bestätigung im Buchungsdetail erneut senden', Icon: MailWarning, tone: 'text-red-600 bg-red-50' },
    { key: 'failedCharges', title: 'Kartenzahlung fehlgeschlagen', hint: 'Stripe-Abbuchung erneut versuchen oder Kunde kontaktieren', Icon: CreditCard, tone: 'text-red-600 bg-red-50' },
    { key: 'unconfirmed', title: 'Noch nicht bestätigt', hint: 'Neue Buchungen mit anstehender Fahrt', Icon: Clock, tone: 'text-blue-600 bg-blue-50' },
    { key: 'unpaidTransfers', title: 'Überweisung offen', hint: 'Fahrt in ≤ 3 Tagen oder vorbei, Zahlung nicht verbucht', Icon: Landmark, tone: 'text-amber-600 bg-amber-50' },
    { key: 'invoiceFailed', title: 'Rechnung nicht versendet', hint: 'Automatischer Versand nach 3 Versuchen abgebrochen', Icon: FileWarning, tone: 'text-red-600 bg-red-50' },
    { key: 'openStatus', title: 'Fahrt vorbei, Status offen', hint: 'Noch „Bestätigt“ — auf „Abgeschlossen“ setzen', Icon: Receipt, tone: 'text-gray-600 bg-gray-100' },
  ];
  const seo = a.seoBacklinks || null;
  const seoIdx = a.seoIndex || null;
  const adsRep = a.adsReports || null;
  const monthEnd = a.monthEndInvoices || null;
  const monthEndCount = monthEnd ? monthEnd.companies.length + monthEnd.calendar.length : 0;
  const mkt = a.marketing || [];
  const openMarketing = (id: string) => {
    try { sessionStorage.setItem('mt_marketing_occasion', id); } catch { /* ignore */ }
    onGoTab('marketing');
  };
  const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const total = groups.reduce((s, g) => s + (a[g.key] || []).length, 0) + mismatches.length + cards.length + (seo ? 1 : 0) + (seoIdx ? 1 : 0) + (adsRep ? 1 : 0) + monthEndCount + mkt.length;
  const short = (t: string) => `${dayLabel(t.slice(0, 10), { day: '2-digit', month: '2-digit' })} ${hhmm(t)}`;
  // Eingeklappt: nur Stichworte; dringende (rot) zuerst
  const chips: Array<{ label: string; urgent: boolean }> = [
    ...(cards.length ? [{ label: `Karte nicht abgebucht (${cards.length})`, urgent: true }] : []),
    ...(monthEndCount ? [{ label: `Monatsende-Rechnungen (${monthEndCount})`, urgent: true }] : []),
    ...(adsRep ? [{ label: 'Google-Ads-Reports', urgent: true }] : []),
    ...(seoIdx ? [{ label: 'Google-Index fällt', urgent: true }] : []),
    ...(seo ? [{ label: 'Backlink-CSV', urgent: true }] : []),
    ...groups.filter((g) => (a[g.key] || []).length).map((g) => ({ label: `${g.title} (${(a[g.key] || []).length})`, urgent: g.tone.includes('red') })),
    ...mkt.map((m) => ({ label: `📣 ${m.name.replace(/\s*\(.*\)$/, '')}`, urgent: m.urgent })),
    ...(mismatches.length ? [{ label: `Zeit weicht vom Kalender ab (${mismatches.length})`, urgent: false }] : []),
  ];
  if (hideWhenEmpty && total === 0) return null;
  return (
    <Card
      title="Handlungsbedarf"
      icon={AlertTriangle}
      className={total > 0 ? 'ring-red-200' : undefined}
      right={total > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{total}</span>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-blue-600 hover:bg-blue-50">
            {open ? 'Einklappen' : 'Alle anzeigen'} <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      ) : undefined}
    >
      {total === 0 ? (
        <div className="px-5 py-8 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
          <p className="mt-2 text-sm font-medium text-gray-700">Alles erledigt</p>
          <p className="text-xs text-gray-400">Keine offenen Zahlungen, Bestätigungen oder Rechnungen.</p>
        </div>
      ) : !open ? (
        <div className="flex flex-wrap gap-2 px-5 py-3">
          {chips.map((c) => (
            <button key={c.label} onClick={() => setOpen(true)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset',
                c.urgent ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100' : 'bg-gray-50 text-gray-700 ring-gray-200 hover:bg-gray-100')}>
              {c.urgent && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}{c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {cards.length > 0 && (
            <div className="px-5 py-3 bg-red-50/60">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white bg-red-500 animate-pulse"><CreditCard size={15} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-700">Kreditkarte nicht abgebucht <span className="font-normal">({cards.length} · {formatPrice(cards.reduce((s, c) => s + c.price, 0))})</span></div>
                  <div className="text-[11px] text-red-600/80">
                    {cards.some((c) => c.day === 'tomorrow') ? `Fahrt morgen — sollte bis ${deadline} Uhr abgebucht sein` : 'Fahrt heute steht bevor'}
                  </div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {cards.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => onOpen(c.id)} className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-xs ring-1 ring-red-100 hover:ring-red-300">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-700 shrink-0">{c.day === 'today' ? 'Heute' : 'Morgen'} {hhmm(c.pickup_datetime)}</span>
                        <span className="truncate font-medium text-gray-800">{c.name}</span>
                        <span className="ml-auto shrink-0 font-semibold text-gray-900">{formatPrice(c.price)}</span>
                        <ChevronRight size={13} className="shrink-0 text-gray-300" />
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500 font-mono">
                        {c.company_id ? 'Firmenkarte' : c.card_last4 ? `${(c.card_brand || 'Karte').toUpperCase()} •••• ${c.card_last4}` : c.legacy_card ? 'alte Karte – manuell' : 'keine Karte hinterlegt'}
                        {c.charge_status === 'failed' && <span className="text-red-600 font-sans"> · fehlgeschlagen{c.charge_error ? `: ${c.charge_error}` : ''}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {monthEnd && monthEndCount > 0 && (
            <div className="px-5 py-3 bg-red-50/60">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white bg-red-500 animate-pulse"><FileText size={15} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-700">Monatsende: Rechnungen senden <span className="font-normal">({monthEndCount})</span></div>
                  <div className="text-[11px] text-red-600/80">Gesammelte Fahrten des Monats sind noch nicht abgerechnet</div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {monthEnd.companies.map((c) => (
                  <li key={`${c.company_id}-${c.month}`}>
                    <button onClick={() => onGoTab('b2b')} className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-xs ring-1 ring-red-100 hover:ring-red-300">
                      <div className="flex items-center gap-2">
                        <Building2 size={13} className="shrink-0 text-red-500" />
                        <span className="truncate font-medium text-gray-800">{c.company_name}</span>
                        <span className="shrink-0 text-gray-500">{monthName(c.month)} · {c.rides} Fahrt{c.rides === 1 ? '' : 'en'}</span>
                        <span className="ml-auto shrink-0 font-semibold text-gray-900">{formatPrice(c.total)}</span>
                        <ChevronRight size={13} className="shrink-0 text-gray-300" />
                      </div>
                      <div className="mt-0.5 text-[11px] text-red-600/80">Sammelrechnung fehlt · B2B Business</div>
                    </button>
                  </li>
                ))}
                {monthEnd.calendar.map((c) => (
                  <li key={`cal-${c.month}`}>
                    <button onClick={() => onGoTab('kalender')} className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-xs ring-1 ring-red-100 hover:ring-red-300">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={13} className="shrink-0 text-red-500" />
                        <span className="truncate font-medium text-gray-800">Google Kalender</span>
                        <span className="shrink-0 text-gray-500">{monthName(c.month)} · {c.rides} Rechnungsfahrt{c.rides === 1 ? '' : 'en'}</span>
                        <ChevronRight size={13} className="ml-auto shrink-0 text-gray-300" />
                      </div>
                      <div className="mt-0.5 text-[11px] text-red-600/80">Noch nicht abgerechnet · Kalender</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mkt.length > 0 && (
            <div className="px-5 py-3 bg-amber-50/60">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white bg-amber-500"><Megaphone size={15} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-800">Marketing: E-Mail senden <span className="font-normal">({mkt.length})</span></div>
                  <div className="text-[11px] text-amber-700/80">Anlass steht bevor — Vorlage ist fertig, nur Empfänger prüfen und senden</div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {mkt.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => openMarketing(m.id)} className={cn('w-full rounded-lg bg-white px-2 py-1.5 text-left text-xs ring-1 hover:ring-amber-300', m.urgent ? 'ring-red-200' : 'ring-amber-100')}>
                      <div className="flex items-center gap-2">
                        <Megaphone size={13} className={cn('shrink-0', m.urgent ? 'text-red-500' : 'text-amber-500')} />
                        <span className="truncate font-medium text-gray-800">{m.name}</span>
                        <span className={cn('ml-auto shrink-0', m.urgent ? 'font-semibold text-red-600' : 'text-gray-500')}>
                          {new Date(`${m.date}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · {m.daysLeft > 0 ? `in ${m.daysLeft} Tagen` : m.daysLeft === 0 ? 'heute' : 'läuft'}
                        </span>
                        <ChevronRight size={13} className="shrink-0 text-gray-300" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {adsRep && (
            <button onClick={() => onGoTab('ads')} className="w-full px-5 py-3 bg-red-50/60 text-left hover:bg-red-50">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white bg-red-500"><MousePointerClick size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-red-700">Google Ads: Wochen-Reports hochladen</div>
                  <div className="text-[11px] text-red-600/80">
                    Kampagnen / Suchbegriffe / Keywords (CSV){adsRep.lastUpload ? ` · zuletzt ${new Date(adsRep.lastUpload).toLocaleDateString('de-DE')}` : ' · noch nie hochgeladen'}
                  </div>
                </div>
                <ChevronRight size={15} className="mt-1 shrink-0 text-red-300" />
              </div>
            </button>
          )}
          {seoIdx && (
            <button onClick={() => onGoTab('seo')} className="w-full px-5 py-3 bg-red-50/60 text-left hover:bg-red-50">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white bg-red-500"><Network size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-red-700">SEO: Google-Index fällt — {seoIdx.dropped} Seite{seoIdx.dropped === 1 ? '' : 'n'} unter dem 7-Tage-Höchststand</div>
                  <div className="text-[11px] text-red-600/80">Die Zahl indexierter Seiten sinkt wirklich · SEO → Indexierung</div>
                </div>
                <ChevronRight size={15} className="mt-1 shrink-0 text-red-300" />
              </div>
            </button>
          )}
          {seo && (
            <button onClick={() => onGoTab('seo')} className="w-full px-5 py-3 bg-red-50/60 text-left hover:bg-red-50">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white bg-red-500"><Network size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-red-700">SEO: Backlink-CSV hochladen</div>
                  <div className="text-[11px] text-red-600/80">
                    Monatlicher Search-Console-Export (Links) fehlt{seo.lastUpload ? ` · zuletzt ${new Date(seo.lastUpload).toLocaleDateString('de-DE')}` : ' · noch nie hochgeladen'}
                  </div>
                </div>
                <ChevronRight size={15} className="mt-1 shrink-0 text-red-300" />
              </div>
            </button>
          )}
          {mismatches.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-teal-700 bg-teal-50"><CalendarDays size={15} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">Zeit weicht vom Kalender ab <span className="text-gray-400 font-normal">({mismatches.length})</span></div>
                  <div className="text-[11px] text-gray-400">Buchung und Google-Kalender-Termin nennen verschiedene Zeiten</div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {mismatches.slice(0, 5).map((m) => (
                  <li key={`${m.id}-${m.calendar_time}`}>
                    <button onClick={() => onOpen(m.id)} className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-800">{m.name}</span>
                        <span className="font-mono text-gray-400 shrink-0">{m.booking_number}</span>
                        <ChevronRight size={13} className="ml-auto shrink-0 text-gray-300" />
                      </div>
                      <div className="mt-0.5 text-gray-500">
                        Buchung <span className="font-semibold text-gray-700">{short(m.booking_time)}</span>
                        {' · '}Kalender <span className="font-semibold text-teal-700">{short(m.calendar_time)}</span>
                      </div>
                    </button>
                  </li>
                ))}
                {mismatches.length > 5 && <li className="px-2 text-[11px] text-gray-400">+ {mismatches.length - 5} weitere</li>}
              </ul>
            </div>
          )}
          {groups.filter((g) => (a[g.key] || []).length).map((g) => (
            <div key={g.key} className="px-5 py-3">
              <div className="flex items-start gap-2.5">
                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', g.tone)}><g.Icon size={15} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{g.title} <span className="text-gray-400 font-normal">({(a[g.key] || []).length})</span></div>
                  <div className="text-[11px] text-gray-400">{g.hint}</div>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {a[g.key].slice(0, 5).map((l) => (
                  <li key={l.id}>
                    <button onClick={() => onOpen(l.id)} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                      <span className="font-mono text-gray-400 shrink-0">{short(l.leg_time)}</span>
                      <span className="truncate font-medium text-gray-800">{l.name}</span>
                      <span className="ml-auto shrink-0 font-semibold text-gray-700">{formatPrice(l.price)}</span>
                      <ChevronRight size={13} className="shrink-0 text-gray-300" />
                    </button>
                  </li>
                ))}
                {(a[g.key] || []).length > 5 && <li className="px-2 text-[11px] text-gray-400">+ {(a[g.key] || []).length - 5} weitere</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Card charges for tomorrow

function TomorrowCharges({ cards, tomorrow, chargingId, onCharge, onShowCard, onOpen }: {
  cards: Booking[]; tomorrow: string; chargingId: number | null;
  onCharge: (id: number) => void; onShowCard: (b: Booking) => void; onOpen: (id: number) => void;
}) {
  const open = cards.filter((b) => b.charge_status !== 'succeeded');
  const total = cards.reduce((s, b) => s + (Number(b.price) || 0), 0);
  return (
    <Card
      title="Morgen abbuchen"
      icon={CreditCard}
      right={<span className="text-xs text-gray-500">{dayLabel(tomorrow, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>}
      className={open.length ? 'ring-amber-200' : undefined}
    >
      {cards.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">Keine Kartenzahlungen für morgen</p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {cards.map((b) => {
              const chargeable = !!(b.company_id || b.stripe_payment_method_id);
              return (
                <li key={b.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <button onClick={() => onOpen(b.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold tabular-nums text-primary-700">{hhmm(b.pickup_datetime)}</span>
                        <span className="truncate text-sm font-medium text-gray-900">{b.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {b.company_id ? '🏢 Firmenkarte' : b.stripe_payment_method_id
                          ? `${(b.card_brand || 'Karte').toUpperCase()} •••• ${b.card_last4 || ''}`
                          : b.card_number ? `Alt · •••• ${b.card_number.slice(-4)}` : '—'}
                      </div>
                    </button>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-gray-900 tabular-nums">{formatPrice(b.price)}</div>
                      <div className="mt-1">
                        {chargeable ? (
                          b.charge_status === 'succeeded' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={12} /> Abgebucht</span>
                          ) : (
                            <button
                              onClick={() => onCharge(b.id)}
                              disabled={chargingId === b.id}
                              title={b.charge_status === 'failed' ? (b.charge_error || undefined) : undefined}
                              className={cn('inline-flex items-center gap-1 text-xs font-semibold text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50',
                                b.charge_status === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700')}
                            >
                              <Zap size={12} />
                              {chargingId === b.id ? 'Wird abgebucht…' : b.charge_status === 'failed' ? 'Erneut versuchen' : 'Abbuchen'}
                            </button>
                          )
                        ) : b.card_number ? (
                          <button onClick={() => onShowCard(b)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 rounded-lg">
                            <Eye size={12} /> Karte
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <footer className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">{open.length ? `${open.length} offen` : 'Alle abgebucht'}</span>
            <span className="font-bold text-gray-900">{formatPrice(total)}</span>
          </footer>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Booking intake chart

function IntakeChart({ chart, today }: { chart: DashboardData['chart']; today: string }) {
  const max = Math.max(1, ...chart.map((c) => c.revenue));
  const total = chart.reduce((s, c) => s + c.revenue, 0);
  const count = chart.reduce((s, c) => s + c.count, 0);
  return (
    <Card
      title="Buchungseingang — 14 Tage"
      icon={TrendingUp}
      right={<span className="text-xs text-gray-500 hidden sm:inline">Ø {formatPrice(total / chart.length)} / Tag</span>}
    >
      <div className="px-5 pt-4 flex items-baseline gap-3">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{formatPrice(total)}</span>
        <span className="text-sm text-gray-500">{count} Buchungen</span>
      </div>
      <div className="px-3 sm:px-5 pb-4 pt-3">
        <div className="flex items-end gap-1 sm:gap-2 h-40">
          {chart.map((c) => {
            const h = c.revenue ? Math.max(4, Math.round((c.revenue / max) * 100)) : 0;
            const isToday = c.date === today;
            const weekend = [0, 6].includes(new Date(`${c.date}T12:00:00Z`).getUTCDay());
            return (
              <div key={c.date} className="group relative flex-1 h-full flex flex-col justify-end items-center" title={`${dayLabel(c.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${c.count} Buchungen · ${formatPrice(c.revenue)}`}>
                <span className={cn('text-[10px] tabular-nums mb-1', c.count ? 'text-gray-500' : 'text-gray-300')}>{c.count}</span>
                <div
                  className={cn('w-full rounded-t-md transition-all', isToday ? 'bg-primary-600' : weekend ? 'bg-primary-200' : 'bg-primary-300', 'group-hover:bg-primary-500')}
                  style={{ height: `${h}%`, minHeight: c.revenue ? 4 : 2, opacity: c.revenue ? 1 : 0.35 }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 sm:gap-2 mt-1.5">
          {chart.map((c) => (
            <div key={c.date} className={cn('flex-1 text-center text-[10px] leading-tight', c.date === today ? 'font-bold text-primary-700' : 'text-gray-400')}>
              <div>{dayLabel(c.date, { weekday: 'short' }).replace('.', '')}</div>
              <div>{c.date.slice(8, 10)}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Month overview

function MonthOverview({ month }: { month: DashboardData['month'] }) {
  const pay = Object.entries(month.payment).sort((a, b) => b[1].revenue - a[1].revenue);
  const revenue = pay.reduce((s, [, a]) => s + a.revenue, 0);
  const st = month.status;
  const all = Object.values(st).reduce((s, n) => s + n, 0);
  const cancelled = st.cancelled || 0;
  const monthName = MONTHS[+month.month.slice(5, 7) - 1];
  return (
    <Card title={`${monthName} im Überblick`} icon={BarChart3}>
      <div className="px-5 py-4 space-y-5">
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">Zahlungsarten</div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
            {pay.map(([k, a]) => (
              <div key={k} className={paymentStyle(k).bar} style={{ width: `${revenue ? (a.revenue / revenue) * 100 : 0}%` }} title={`${paymentStyle(k).label}: ${formatPrice(a.revenue)}`} />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5">
            {pay.length === 0 && <li className="text-sm text-gray-400">Noch keine Buchungen</li>}
            {pay.map(([k, a]) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className={cn('w-2.5 h-2.5 rounded-full', paymentStyle(k).bar)} />
                <span className="text-gray-700">{paymentStyle(k).label}</span>
                <span className="text-xs text-gray-400">{a.count}×</span>
                <span className="ml-auto font-semibold tabular-nums text-gray-900">{formatPrice(a.revenue)}</span>
                <span className="w-10 text-right text-xs text-gray-400 tabular-nums">{revenue ? Math.round((a.revenue / revenue) * 100) : 0} %</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">Buchungsstatus</div>
          <div className="grid grid-cols-2 gap-2">
            {(['completed', 'confirmed', 'new', 'cancelled'] as const).map((k) => (
              <div key={k} className="rounded-xl bg-gray-50 px-3 py-2">
                <div className="text-lg font-bold tabular-nums text-gray-900">{st[k] || 0}</div>
                <div className="text-[11px] text-gray-500">{STATUS_STYLE[k].label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Stornoquote: <span className={cn('font-semibold', all && cancelled / all > 0.1 ? 'text-red-600' : 'text-gray-700')}>{all ? Math.round((cancelled / all) * 100) : 0} %</span>
            <span className="text-gray-400"> ({cancelled} von {all})</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Latest bookings

function RecentBookings({ recent, now, onOpen }: { recent: Recent[]; now: string; onOpen: (id: number) => void }) {
  return (
    <Card title="Letzte Buchungen" icon={Clock}>
      <ul className="divide-y divide-gray-100">
        {recent.map((b) => (
          <li key={b.id}>
            <button onClick={() => onOpen(b.id)} className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-900">{b.name}</span>
                  {b.company_name && <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"><Building2 size={11} /> {b.company_name}</span>}
                  {b.trip_type === 'roundtrip' && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded"><Repeat size={11} /> Hin + Rück</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  <span className="font-mono text-gray-400">{b.booking_number}</span>
                  {' · gebucht '}{fmtAgo(b.created_berlin, now)}
                  {' · Fahrt '}{dayLabel(wall(b.pickup_datetime).slice(0, 10), { weekday: 'short', day: '2-digit', month: '2-digit' })} {hhmm(b.pickup_datetime)}
                </div>
              </div>
              <div className="shrink-0 hidden md:block"><PaymentChip b={b} /></div>
              <div className="shrink-0 w-20 text-right font-semibold tabular-nums text-gray-900">{formatPrice(b.price)}</div>
              <div className="shrink-0 hidden sm:block w-28 text-right"><StatusChip status={b.status} /></div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// Reports

function ReportsCard() {
  const nowWall = berlinNowWall();
  const [month, setMonth] = useState(+nowWall.slice(5, 7));
  const [year, setYear] = useState(+nowWall.slice(0, 4));
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null);
  const years = [year - 1, year, year + 1].filter((y) => y >= 2025);
  return (
    <Card title="Finanzamt — Kreditkartenbericht" icon={FileText}>
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select value={month} onChange={(e) => setMonth(+e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={adminApi.getFinanzamtReport(month, year)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
          >
            <FileText size={14} /> PDF
          </a>
          <button
            onClick={async () => {
              setSyncing(true);
              setResult(null);
              try {
                setResult(await adminApi.autoSyncStripe(month, year));
              } catch (err: any) {
                alert('Stripe Sync Fehler: ' + (err.response?.data?.error || err.message));
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-medium"
          >
            <Zap size={14} /> {syncing ? 'Läuft…' : 'Stripe Sync'}
          </button>
        </div>
        {result && (
          <div className="text-xs text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
            ✅ <strong>{result.matched}</strong> Zahlungen zugeordnet
            {result.unmatched > 0 && <> · <span className="text-orange-600">⚠ {result.unmatched} nicht zugeordnet</span></>}
            {' '}(von {result.total})
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------
// KPI card (Kopfzeile)

function Delta({ cur, prev, title }: { cur: number; prev: number; title: string }) {
  if (!prev) return null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span title={title} className={cn('inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{up ? '+' : ''}{pct} %
    </span>
  );
}

const SPARK_TONE = {
  blue: ['bg-blue-200', 'bg-blue-500'], amber: ['bg-amber-200', 'bg-amber-500'],
  violet: ['bg-violet-200', 'bg-violet-500'], emerald: ['bg-emerald-200', 'bg-emerald-500'],
} as const;
const ICON_TONE = {
  blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-500',
  violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600',
} as const;

function MiniBars({ values, tone, title }: { values: number[]; tone: keyof typeof SPARK_TONE; title: string }) {
  const v = values.slice(-10);
  if (v.length < 2 || !v.some((x) => x > 0)) return null;
  const max = Math.max(1, ...v);
  return (
    <div className="flex h-8 shrink-0 items-end gap-[2px]" title={title} aria-hidden>
      {v.map((x, i) => (
        <span key={i} className={cn('w-[3px] rounded-sm', i === v.length - 1 ? SPARK_TONE[tone][1] : SPARK_TONE[tone][0])}
          style={{ height: `${Math.max(10, (x / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function HeadKpi({ label, Icon, tone, value, delta, sub, spark, sparkTitle, footer }: {
  label: string; Icon: typeof Clock; tone: keyof typeof ICON_TONE; value: React.ReactNode;
  delta?: React.ReactNode; sub?: React.ReactNode; spark?: number[]; sparkTitle?: string; footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ICON_TONE[tone])}><Icon size={22} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold leading-tight text-gray-700">{label}</span>
            {spark && <MiniBars values={spark} tone={tone as keyof typeof SPARK_TONE} title={sparkTitle || ''} />}
          </div>
          <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</span>
            {delta}
          </div>
        </div>
      </div>
      {sub && <div className="mt-2 text-[13px] leading-snug text-gray-500">{sub}</div>}
      {footer && <div className="mt-auto pt-2.5">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// KPI card

// "648 Buchungen + Kalender 12.345 € (310 Fahrten)"
function CalSplit({ bookings, cal }: { bookings: Agg; cal: CalSum | null }) {
  if (!cal || cal.count === 0) return <>{plural(bookings.count, 'Buchung', 'Buchungen')}</>;
  return (
    <>
      {plural(bookings.count, 'Buchung', 'Buchungen')} {formatPrice(bookings.revenue)}
      <span className="block text-teal-600">+ Kalender {formatPrice(cal.revenue)} ({plural(cal.count, 'Fahrt', 'Fahrten')})</span>
    </>
  );
}

function Kpi({ label, value, sub, footer, Icon, tone }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; footer?: React.ReactNode; Icon: typeof Clock; tone: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-100 flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', tone)}><Icon size={17} /></span>
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-sm text-gray-500 mt-0.5">{sub}</div>}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------

export default function DashboardTab({ reloadToken, onOpenBooking, onShowCard, onCharge, chargingId, onNewBooking, onGoTab }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cards, setCards] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [now, setNow] = useState(berlinNowWall());
  // Per-viewer choice whether calendar-only rides show in the schedule (default: on).
  const [showCal, setShowCal] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(CAL_PREF_KEY) === '0') setShowCal(false); } catch { /* ignore */ }
  }, []);
  const [widgets, setWidgets] = useState<WidgetOverview | null>(null);
  const [flights, setFlights] = useState<Flights | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    try { setHidden(new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'))); } catch { /* ignore */ }
  }, []);
  const show = (id: string) => !hidden.has(id);
  const toggleWidget = (id: string) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
    return next;
  });

  const loadWidgets = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/admin/dashboard-widgets/overview`, { headers: authHeader() });
      if (r.ok) setWidgets(await r.json());
    } catch { /* widgets are optional */ }
  }, []);
  const loadFlights = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/admin/dashboard-widgets/flights`, { headers: authHeader() });
      if (r.ok) setFlights(await r.json());
    } catch { /* optional */ }
  }, []);
  const toggleFlights = async (on: boolean) => {
    await fetch(`${API_URL}/admin/dashboard-widgets/flight-status`, {
      method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: on }),
    }).catch(() => {});
    loadFlights();
  };
  useEffect(() => {
    loadFlights();
    const t = setInterval(loadFlights, 5 * 60_000);
    return () => clearInterval(t);
  }, [loadFlights]);

  const toggleCal = () => setShowCal((v) => {
    try { localStorage.setItem(CAL_PREF_KEY, v ? '0' : '1'); } catch { /* ignore */ }
    return !v;
  });

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    const list: Item[] = data.legs.map((leg) => ({ kind: 'booking' as const, time: leg.leg_time, leg }));
    if (showCal && data.calendar?.enabled) {
      for (const cal of data.calendar.legs) list.push({ kind: 'calendar', time: cal.leg_time, cal });
    }
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [data, showCal]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      loadWidgets();
      const [d, c] = await Promise.all([adminApi.getDashboard(), adminApi.getTomorrowCards()]);
      setData(d);
      setCards(c);
      setError(null);
      setLoadedAt(berlinNowWall());
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [loadWidgets]);

  useEffect(() => { load(); }, [load, reloadToken]);
  useEffect(() => {
    const refresh = setInterval(load, 60_000);
    const clock = setInterval(() => setNow(berlinNowWall()), 15_000);
    return () => { clearInterval(refresh); clearInterval(clock); };
  }, [load]);

  const archive = useDayArchive();
  const lay = useDashLayout(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);

  if (!data) {
    return error ? (
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="mt-3 text-sm font-medium text-primary-600 hover:underline">Erneut laden</button>
      </div>
    ) : (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-white rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-36 bg-white rounded-2xl" />)}</div>
        <div className="h-96 bg-white rounded-2xl" />
      </div>
    );
  }

  const today = now.slice(0, 10);
  const todayItems = items.filter((i) => i.time.slice(0, 10) === today);
  const todayLegs = todayItems.flatMap((i) => (i.kind === 'booking' ? [i.leg] : []));
  const todayCal = todayItems.length - todayLegs.length;
  const states = itemStates(todayItems, now);
  const done = states.filter((s) => s === 'past').length;
  const nextIdx = states.findIndex((s) => s === 'next' || s === 'running');
  const nextUpcoming = (nextIdx >= 0 ? todayItems[nextIdx] : null) ?? items.find((i) => i.time > now) ?? null;
  const itemName = (i: Item) => (i.kind === 'booking' ? i.leg.name : i.cal.guest || i.cal.summary || 'Kalender-Fahrt');
  const openItem = (i: Item) => {
    if (i.kind === 'booking') onOpenBooking(i.leg.id);
    else if (i.cal.html_link) window.open(i.cal.html_link, '_blank', 'noopener');
  };
  const it = data.intake;
  const capacity: CapacityEntry[] = items.map((i) => (i.kind === 'booking'
    ? { time: i.time, bus: ['van', 'grossraumtaxi'].includes(i.leg.vehicle_type), label: i.leg.name }
    : { time: i.time, bus: /bus/i.test(i.cal.location), label: i.cal.guest || i.cal.summary }));
  const monthName = MONTHS[+data.month.month.slice(5, 7) - 1];
  const prevMonthName = MONTHS[(+data.month.month.slice(5, 7) + 10) % 12];

  // Mini-Balken: Buchungseingang je Tag (14 Tage, letzter = heute) und Fahrten je Tag (nächste 7 Tage)
  const chartRev = data.chart.map((c) => c.revenue);
  const monthRev = data.chart.filter((c) => c.date.slice(0, 7) === data.month.month).map((c) => c.revenue);
  const ridesNext7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    return items.filter((x) => x.time.slice(0, 10) === d).length;
  });

  return (
    <div className="space-y-5">
      {/* Kopf: Titel links, Anordnen + Widgets + Stand rechts */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 2xl:flex-nowrap">
        <div className="min-w-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Übersicht</h2>
          <p className="mt-0.5 text-[15px] text-gray-500">
            {dayLabel(today, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="font-semibold text-gray-800 tabular-nums">{hhmm(now)} Uhr</span>
            <span className="text-gray-400"> (Berlin)</span>
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-x-2 gap-y-2 2xl:flex-nowrap">
          <button
            onClick={() => { setEditing((v) => !v); setPicker(false); }}
            aria-pressed={editing}
            className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold ring-1 ring-inset',
              editing ? 'bg-blue-600 text-white ring-blue-600 hover:bg-blue-700' : 'bg-white text-gray-800 ring-gray-200 hover:bg-gray-50')}
            title="Bereiche verschieben und Größe ändern"
          >
            {editing ? <><CheckCircle2 size={16} /> Fertig</> : <><Move size={16} /> Anordnen</>}
          </button>
          <button
            onClick={() => setPicker((v) => !v)}
            aria-expanded={picker}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-medium text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
          >
            <LayoutGrid size={16} /> Widgets
          </button>
          <button
            onClick={() => { load(); loadFlights(); }}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-medium text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
            title="Aktualisiert sich jede Minute automatisch"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loadedAt ? `Stand ${hhmm(loadedAt)}` : 'Aktualisieren'}
          </button>
          {picker && (
            <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 p-3">
              <div className="text-xs font-semibold text-gray-500 px-1 pb-2">Angezeigte Bereiche</div>
              {WIDGETS.map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 px-1 py-1.5 text-sm text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={show(id)} onChange={() => toggleWidget(id)} className="rounded" />
                  {label}
                </label>
              ))}
              <button onClick={() => setPicker(false)} className="mt-2 w-full text-xs text-gray-500 hover:text-gray-800">Schließen</button>
            </div>
          )}
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">Aktualisierung fehlgeschlagen: {error}</div>}

      {editing && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-200">
          <Move size={18} className="shrink-0 text-blue-600" />
          <span className="flex-1">Bereiche an der blauen Leiste ziehen und ablegen (oder ↑ ↓). Breite mit ¼ ⅓ ½ ⅔ 1, „Hoch“ = zwei Bereiche daneben. Wird in diesem Browser gespeichert.</span>
          <button onClick={() => { if (confirm('Anordnung auf Standard zurücksetzen?')) lay.reset(); }} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100">Standard</button>
          <button onClick={() => setEditing(false)} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">Fertig</button>
        </div>
      )}

      <DashGrid
        lay={lay}
        editing={editing}
        fixed={['attention', 'schedule']}
        onHide={toggleWidget}
        labels={{ ...Object.fromEntries(WIDGETS), attention: 'Handlungsbedarf', schedule: 'Fahrplan', kpi_month: `${monthName} bis heute` }}
        blocks={{
          attention: <AttentionPanel hideWhenEmpty={!editing} a={data.attention} mismatches={data.calendar?.mismatches || []} deadline={data.card_deadline ?? '20:15'} onOpen={onOpenBooking} onGoTab={onGoTab} />,
          kpi_rides: show('kpi_rides') ? (
        <HeadKpi
          label="Fahrten heute"
          Icon={Car}
          tone="blue"
          value={<>{todayItems.length}<span className="ml-1.5 text-sm font-medium text-gray-400">· {done} erledigt</span></>}
          sub={[
            todayLegs.some((l) => l.leg === 'rueck')
              ? plural(todayLegs.filter((l) => l.leg === 'hin').length, 'Hinfahrt', 'Hinfahrten') + ' · '
                + plural(todayLegs.filter((l) => l.leg === 'rueck').length, 'Rückfahrt', 'Rückfahrten')
              : `${todayItems.length - done} noch offen`,
            todayCal > 0 ? `${todayCal} aus Kalender` : '',
          ].filter(Boolean).join(' · ')}
          spark={ridesNext7}
          sparkTitle="Fahrten je Tag: heute + 6 Tage"
          footer={nextUpcoming ? (
            <button onClick={() => openItem(nextUpcoming)} className="flex w-full items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-left text-xs hover:bg-gray-100">
              <Clock size={13} className="shrink-0 text-blue-500" />
              <span className="shrink-0 text-gray-500">Nächste:</span>
              <span className="shrink-0 font-semibold text-gray-900">
                {nextUpcoming.time.slice(0, 10) === today ? '' : `${dayLabel(nextUpcoming.time.slice(0, 10), { weekday: 'short' })} `}{hhmm(nextUpcoming.time)}
              </span>
              <span className="truncate text-gray-600">{itemName(nextUpcoming)}</span>
              <span className="ml-auto shrink-0 font-medium text-blue-600">
                {wallMinutes(nextUpcoming.time) <= wallMinutes(now) ? 'läuft' : `in ${fmtDuration(wallMinutes(nextUpcoming.time) - wallMinutes(now))}`}
              </span>
            </button>
          ) : undefined}
        />
          ) : null,
          kpi_new: show('kpi_new') ? (
        <HeadKpi
          label="Neue Buchungen heute"
          Icon={Euro}
          tone="amber"
          value={formatPrice(it.today.revenue)}
          delta={<Delta cur={it.today.revenue} prev={it.yesterdaySameTime.revenue} title="vs. gestern bis zur gleichen Uhrzeit" />}
          sub={`${plural(it.today.count, 'Buchung', 'Buchungen')}${data.intakeCalendar?.today.count ? ` (${data.intakeCalendar.today.count} aus Kalender)` : ''} · gestern ${it.yesterday.count}`}
          spark={chartRev}
          sparkTitle="Buchungseingang je Tag, letzte 14 Tage"
        />
          ) : null,
          kpi_week: show('kpi_week') ? (
        <HeadKpi
          label="Letzte 7 Tage"
          Icon={CalendarDays}
          tone="violet"
          value={formatPrice(it.week.revenue)}
          delta={<Delta cur={it.week.revenue} prev={it.prevWeek.revenue} title="vs. die 7 Tage davor" />}
          sub={`${plural(it.week.count, 'Buchung', 'Buchungen')}${data.intakeCalendar?.week.count ? ` (${data.intakeCalendar.week.count} aus Kalender)` : ''}`}
          spark={chartRev.slice(-7)}
          sparkTitle="Buchungseingang je Tag, letzte 7 Tage"
        />
          ) : null,
          kpi_month: show('kpi_month') ? (
        <HeadKpi
          label={`${monthName} bis heute`}
          Icon={BarChart3}
          tone="emerald"
          value={formatPrice(it.mtd.revenue + (data.calendarMonth?.revenue ?? 0))}
          delta={<Delta cur={it.mtd.revenue} prev={it.prevMtd.revenue} title="Buchungen vs. Vormonat bis zum gleichen Tag" />}
          sub={<CalSplit bookings={it.mtd} cal={data.calendarMonth} />}
          spark={monthRev}
          sparkTitle={`Buchungseingang je Tag im ${monthName} (max. 14 Tage)`}
        />
          ) : null,
          schedule: <Schedule items={items} now={now} onOpen={onOpenBooking} calendar={data.calendar} showCal={showCal} onToggleCal={toggleCal} />,
          flights: show('flights') ? <FlightBoard data={flights} today={today} onOpen={onOpenBooking} onToggle={toggleFlights} /> : null,
          charges: show('charges') ? <TomorrowCharges
            cards={cards}
            tomorrow={addDays(today, 1)}
            chargingId={chargingId}
            onCharge={(id) => { onCharge(id).finally(load); }}
            onShowCard={onShowCard}
            onOpen={onOpenBooking}
          /> : null,
          drivers: show('drivers') ? <DriverPlan plan={widgets?.drivers ?? null} now={now} onOpen={onOpenBooking} /> : null,
          forecast: show('forecast') ? <ForecastCard f={widgets?.forecast ?? null} /> : null,
          funnel: show('funnel') ? <FunnelCard f={widgets?.funnel ?? null} /> : null,
          receivables: show('receivables') ? <ReceivablesCard r={widgets?.receivables ?? null} onGoTab={onGoTab} /> : null,
          quick: show('quick') ? <QuickActions onNewBooking={onNewBooking} onGoTab={onGoTab} onSynced={load} /> : null,
          archive: show('archive') ? <ArchiveResults a={archive} withControls /> : null,
          events: show('events') && widgets?.events
            ? <EventsStrip events={widgets.events} custom={widgets.custom_events || []} sources={widgets.event_sources} today={today} onSaved={loadWidgets} />
            : null,
          missed: show('missed') ? <MissedCustomers data={widgets?.missed ?? null} onGoLive={() => onGoTab('live')} /> : null,
          capacity: show('capacity') ? <CapacityHeatmap entries={capacity} today={today} /> : null,
          chart: show('chart') ? <IntakeChart chart={data.chart} today={today} /> : null,
          month: show('month') ? <MonthOverview month={data.month} /> : null,
          totals: show('totals') ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Kpi
                label={`${prevMonthName} (Vormonat)`}
                Icon={History}
                tone="bg-amber-50 text-amber-600"
                value={formatPrice(it.prevMonth.revenue + (data.calendarPrevMonth?.revenue ?? 0))}
                sub={<CalSplit bookings={it.prevMonth} cal={data.calendarPrevMonth} />}
                footer={<span className="text-xs text-gray-400">ganzer Monat</span>}
              />
              <Kpi
                label="Gesamtumsatz"
                Icon={Wallet}
                tone="bg-gray-100 text-gray-700"
                value={formatPrice(data.allTime.revenue + (data.calendarTotal?.revenue ?? 0))}
                sub={<CalSplit bookings={data.allTime} cal={data.calendarTotal} />}
                footer={<span className="text-xs text-gray-400">{data.calendarTotal ? 'seit 2023, inkl. Kalender' : 'alle Buchungen seit Start der Website'}</span>}
              />
            </div>
          ) : null,
          recent: show('recent') ? <RecentBookings recent={data.recent} now={now} onOpen={onOpenBooking} /> : null,
          reports: show('reports') ? <ReportsCard /> : null,
        }}
      />

      <p className="text-[11px] text-gray-400">
        Umsätze nach Buchungsdatum (ohne Stornos){data.calendar?.enabled && showCal ? ' — Kalender-Fahrten zählen dort an dem Tag, an dem sie eingetragen wurden' : ''}. Fahrplan: Fahrten nach Abholzeit, Hin- und Rückfahrt einzeln{data.calendar?.enabled && showCal ? ', inkl. Fahrten, die nur im Google Kalender stehen' : ''}.
      </p>
    </div>
  );
}
