// Shapes of GET /api/admin/dashboard-widgets/overview and /flights
// (backend/src/routes/admin-dashboard-widgets.ts).

export type PlanEntry = {
  time: string;
  drivers: string[];
  title: string;
  from: string | null;
  to: string | null;
  source: 'calendar' | 'booking' | 'booking_only';
  booking_id: number | null;
  booking_number: string | null;
  html_link: string | null;
  duration: number;
};

export type DriverPlan = {
  drivers: Array<{ driver: string; today: number; tomorrow: number; next: PlanEntry | null }>;
  entries: PlanEntry[];
  conflicts: Array<{ driver: string; first: PlanEntry; second: PlanEntry; gap: number; need: number }>;
  unassigned: PlanEntry[];
  known: string[];
};

export type Forecast = {
  month: string;
  realized: number;
  scheduled: number;
  per_day: number;
  remaining_days: number;
  forecast: number;
  prev_month: number;
  last_year: number;
  include_calendar: boolean;
};

export type MissedDraft = {
  session_id: string;
  pickup: string | null;
  dropoff: string | null;
  price: number | null;
  distance_km: string | null;
  vehicle: string | null;
  last_stage: string | null;
  updated_at: string;
  city: string | null;
  country: string | null;
  gclid: string | null;
  utm_source: string | null;
  ua_device: string | null;
  online: boolean;
};

export type Callback = {
  id: number;
  phone: string;
  name: string | null;
  pickup: string | null;
  dropoff: string | null;
  price: number | null;
  trip_datetime: string | null;
  created_at: string;
};

export type Receivables = {
  invoices: Array<{ id: number; invoice_number: string; total: number; due_date: string | null; reminder_level: number | null; company_name: string | null; overdue: boolean }>;
  invoices_total: number;
  overdue_total: number;
  transfers: { count: number; total: number };
  calendar_open: { count: number; total: number };
};

export type FunnelStage = { visitors: number; ads: number; prices: number; form: number; bookings: number; revenue: number };
export type Funnel = { today: FunnelStage; yesterday: FunnelStage; ads_spend_today: number | null };

export type EventKind = 'holiday' | 'custom' | 'messe' | 'school' | 'football';
export type DashEvent = { id: string; name: string; start: string; end: string; kind: EventKind; note?: string; time?: string };
export type EventSourceKind = 'messe' | 'school' | 'football';
export type EventSources = { switches: Record<EventSourceKind, boolean>; errors: Partial<Record<EventSourceKind, string>> };

export type WidgetOverview = {
  now: string;
  drivers: DriverPlan | null;
  forecast: Forecast | null;
  missed: { drafts: MissedDraft[]; callbacks: Callback[] } | null;
  receivables: Receivables | null;
  funnel: Funnel | null;
  events: DashEvent[] | null;
  event_sources: EventSources | null;
  custom_events: DashEvent[] | null;
};

export type FlightStatus = {
  flight: string;
  status: string | null;
  scheduled: string | null;
  expected: string | null;
  actual: string | null;
  terminal: string | null;
  origin: string | null;
  delay_minutes: number | null;
};

export type FlightRow = {
  time: string;
  flight: string;
  name: string;
  to: string | null;
  source: 'booking' | 'calendar';
  booking_id: number | null;
  html_link: string | null;
  live: boolean;
  status: FlightStatus | null;
};

export type Flights = { enabled: boolean; budget: { used: number; cap: number }; flights: FlightRow[] };
