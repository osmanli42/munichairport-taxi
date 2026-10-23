import axios from 'axios';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_BASE_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add token to admin requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token && (config.url?.startsWith('/admin') || config.url?.startsWith('/plz-surcharges') || config.url?.startsWith('/pflichtgebiet/exclusions') || config.url?.startsWith('/fixed-routes') || config.url?.startsWith('/auto-discounts') || config.url?.startsWith('/promotions/admin') || config.method === 'put' || config.method === 'delete')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface BookingFormData {
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  vehicle_type: 'kombi' | 'van' | 'grossraumtaxi';
  passengers: number;
  name: string;
  phone: string;
  email: string;
  flight_number?: string;
  flight_validated?: string;
  flight_info?: string;
  pickup_sign?: string;
  child_seat?: boolean;
  child_seat_details?: string;
  luggage_count?: number;
  notes?: string;
  distance_km?: number;
  duration_minutes?: number;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  payment_method: 'cash' | 'card';
  language: string;
  trip_type?: string;
  return_datetime?: string;
  fahrrad_count?: number;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  anfahrt_cost?: number;
}

export interface Booking {
  id: number;
  booking_number: string;
  /** Wie oft dieser Kunde (gleiche E-Mail oder Telefon) insgesamt gebucht hat — nur in der Admin-Liste */
  customer_booking_count?: number;
  status: 'new' | 'confirmed' | 'completed' | 'cancelled';
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  vehicle_type: string;
  passengers: number;
  name: string;
  phone: string;
  /** Canonical E.164, derived on booking creation. NULL on rows created before this existed. */
  phone_e164?: string | null;
  /** Twilio line type ('mobile' | 'landline' | 'nonFixedVoip' | …). NULL unless Twilio Lookup is configured. */
  phone_line_type?: string | null;
  email: string;
  flight_number?: string;
  flight_validated?: string;
  flight_info?: string;
  child_seat: number;
  child_seat_details?: string;
  luggage_count: number;
  fahrrad_count?: number;
  notes?: string;
  distance_km?: number;
  duration_minutes?: number;
  price: number;
  payment_method: string;
  language: string;
  trip_type?: string;
  return_datetime?: string;
  created_at: string;
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  // Legacy raw-card fields — only present on bookings placed before the Stripe
  // tokenization migration. New bookings never populate these.
  card_holder?: string | null;
  card_number?: string | null;
  card_expiry?: string | null;
  card_cvv?: string | null;
  steuersatz?: number | null;
  stripe_charge_id?: string | null;
  stripe_payment_date?: string | null;
  pickup_sign?: string;
  zwischenstopp_address?: string;
  promo_code?: string;
  discount_amount?: number;
  anfahrt_cost?: number;
  company_id?: number | null;
  company_name?: string | null;
  charge_status?: 'pending' | 'succeeded' | 'failed' | null;
  charge_error?: string | null;
  // Customer-requested invoice (see autoRechnungJob on the backend)
  rechnung_required?: number | null;
  rechnung_adresse?: string | null;
  rechnung_number?: string | null;
  rechnung_sent_at?: string | null;
  rechnung_error?: string | null;
  // Proforma-Rechnung (admin-only, sent before the ride to bank-transfer customers)
  proforma_number?: string | null;
  proforma_sent_at?: string | null;
  proforma_adresse?: string | null;
  ueberweisung_paid_at?: string | null;
}

// Rides that exist only in the Google Calendar (see backend services/calendarRides.ts).
export interface CalendarStats {
  enabled: boolean;
  include: boolean;
  sync: {
    last: { at: string; events: number; rides: number; error: string | null } | null;
    synced_at: string | null;
    events: number;
    rides: number;
    duplicates: number;
    bookings: number;
    cancelled: number;
  };
  monthly: Array<{ month: string; count: number; priced: number; revenue: number }>;
  mtd: { current: { count: number; revenue: number }; previous: { count: number; revenue: number } };
  bookingYears: Array<{ year: string; count: number; revenue: number }>;
}

export interface Price {
  id: number;
  vehicle_type: string;
  base_price: number;
  price_per_km: number;
  roundtrip_discount: number;
  fahrrad_price: number;
  fahrrad_enabled: number;
  child_seat_price: number;
  max_passengers: number;
  max_luggage: number;
  min_price: number;
  min_price_km: number;
  updated_at: string;
}

// Public API
export const bookingsApi = {
  create: async (data: BookingFormData) => {
    const response = await api.post('/bookings', data);
    return response.data;
  },

  calculatePrice: async (vehicle_type: string, distance_km: number) => {
    const response = await api.post('/bookings/calculate-price', { vehicle_type, distance_km });
    return response.data;
  },

  getByNumber: async (booking_number: string) => {
    const response = await api.get(`/bookings/${booking_number}`);
    return response.data;
  },
};

// Live tracking (customer page, driver app, admin) has its own client: lib/tracking.ts.

export const pricesApi = {
  getAll: async (): Promise<Price[]> => {
    const response = await api.get('/prices');
    return response.data;
  },
};

export const settingsApi = {
  getAll: async (): Promise<Record<string, string>> => {
    const response = await api.get('/settings');
    return response.data;
  },
};

export interface PlzSurcharge {
  id: number;
  plz: string;
  stadt: string;
  surcharge: number;
}

export const plzSurchargesApi = {
  getAll: async (): Promise<PlzSurcharge[]> => {
    const response = await api.get('/plz-surcharges');
    return response.data;
  },
  create: async (plz: string, stadt: string, surcharge: number): Promise<PlzSurcharge[]> => {
    const response = await api.post('/plz-surcharges', { plz, stadt, surcharge });
    return response.data;
  },
  update: async (id: number, surcharge: number, stadt: string): Promise<PlzSurcharge[]> => {
    const response = await api.put(`/plz-surcharges/${id}`, { surcharge, stadt });
    return response.data;
  },
  remove: async (id: number): Promise<PlzSurcharge[]> => {
    const response = await api.delete(`/plz-surcharges/${id}`);
    return response.data;
  },
};

export interface PflichtgebietConfig {
  id: number;
  enabled: number;
  mode: 'floor' | 'replace';
  radius_km: number;
  roundtrip_discount_enabled: number;
  airport_enabled: number;
  airport_lat: number;
  airport_lng: number;
  betriebssitz_enabled: number;
  betriebssitz_lat: number;
  betriebssitz_lng: number;
  ip_bypass_enabled: number;
  ip_bypass_distance_km: number;
}

export interface PflichtgebietTarif {
  vehicle_type: string;
  grundgebuehr: number;
  min_per_km: number;
}

export interface PflichtgebietExclusion {
  id: number;
  plz: string;
  ort: string;
  enabled: number;
}

export const pflichtgebietApi = {
  get: async (): Promise<{ config: PflichtgebietConfig | null; tarife: PflichtgebietTarif[] }> => {
    const response = await api.get('/pflichtgebiet');
    return response.data;
  },
  updateConfig: async (config: Partial<PflichtgebietConfig>): Promise<PflichtgebietConfig> => {
    const response = await api.put('/pflichtgebiet', config);
    return response.data;
  },
  updateTarif: async (vehicle_type: string, grundgebuehr: number, min_per_km: number): Promise<PflichtgebietTarif> => {
    const response = await api.put(`/pflichtgebiet/tarife/${vehicle_type}`, { grundgebuehr, min_per_km });
    return response.data;
  },
  getExclusions: async (): Promise<PflichtgebietExclusion[]> => {
    const response = await api.get('/pflichtgebiet/exclusions');
    return response.data;
  },
  addExclusion: async (plz: string, ort: string): Promise<PflichtgebietExclusion[]> => {
    const response = await api.post('/pflichtgebiet/exclusions', { plz, ort });
    return response.data;
  },
  removeExclusion: async (id: number): Promise<PflichtgebietExclusion[]> => {
    const response = await api.delete(`/pflichtgebiet/exclusions/${id}`);
    return response.data;
  },
};

// Automatische Rabatte (Rabatte-Tab) — kod gerektirmeyen, kural bazlı indirimler
export interface AutoDiscount {
  id: number;
  name: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  zone_scope: 'inside' | 'outside' | 'any';
  min_km: number | null;
  max_km: number | null;
  trip_time_from: number | null;
  trip_time_to: number | null;
  booking_time_from: number | null;
  booking_time_to: number | null;
  label_de: string | null;
  label_en: string | null;
  label_tr: string | null;
  show_in_banner: number;
  show_countdown: number;
  show_remaining: number;
  price_basis: 'any' | 'pflichttarif' | 'normal';
  visitor_min_km: number | null;
  visitor_max_km: number | null;
  visitor_unknown_ok: number;
  /** Ab dem wievielten Besuch des Geräts die Regel greift (null = egal, min. 2) */
  visit_min: number | null;
  /** 1 = Rabatt gilt auch auf Festpreisrouten (Standard 0 — kein Rabatt auf Festpreise) */
  allow_fixed_routes: number;
  weekday_mask: string | null;
  booking_index_max: number | null;
  daily_max_uses: number | null;
  max_uses: number | null;
  used_count: number;
  max_discount_amount: number | null;
  vehicle_types: string | null;
  trip_types: string | null;
  start_date: string | null;
  end_date: string | null;
  booking_start_date: string | null;
  booking_end_date: string | null;
  active: number;
  priority: number;
  stackable_with_promo: number;
  /** "Ruhiger Tag": nur wenn pace (gebucht/erwartet) des Fahrtdatums darunter liegt (0.5 = 50 %) */
  demand_pace_max: number | null;
  /** Höchstzahl rabattierter Buchungen je Fahrtdatum */
  trip_date_max_uses: number | null;
  /** Besucherkreis: null = Standard, 'fern' = nur > IP-Bypass-km, 'nah' = nur darunter, 'alle' */
  ip_bypass_mode: 'fern' | 'nah' | 'alle' | null;
  /** Wert bei Hin & Rück statt discount_value */
  roundtrip_value: number | null;
  /** 1 = Firmen-/Rechnungskunden ausgeschlossen */
  exclude_business: number;
  /** Fahrt höchstens so viele Tage nach heute (null = egal) */
  max_days_ahead: number | null;
  /** "Boş saat": Fenster ±Minuten um die Abholzeit (null = aus) */
  gap_window_minutes: number | null;
  /** Höchstzahl Fahrten im Fenster (0 = leer) */
  gap_max_rides: number | null;
  /** Leerfahrt: Abholung höchstens so weit vom Ziel einer geplanten Fahrt (null = aus) */
  leer_radius_km: number | null;
  /** Leerfahrt-Fenster nach der geschätzten Ankunft (Minuten) */
  leer_after_min: number | null;
  leer_before_min: number | null;
  /** 'muenchen' = nur Flughafen → Stadt München, Abholung in München; null = überall */
  leer_area: 'muenchen' | null;
  /** München-Modus: Fahrtziel höchstens so weit vom Marienplatz (Umland), null = 15 km */
  leer_end_km: number | null;
  /** München-Modus: PLZ, deren Fahrtziel nicht zählt (null = Standardliste, '' = keine) */
  leer_exclude_plz: string | null;
}

export interface LeerItem {
  start: string; from: string; to: string; label: string;
  freeAt: string; windowFrom: string; windowTo: string;
  usedBy: { start: string; from: string; label: string } | null;
}
export interface LeerOverview {
  enabled: boolean;
  rule: { id: number; name: string; type: 'percent' | 'fixed'; value: number } | null;
  radiusKm: number; afterMin: number; beforeMin: number; area: 'muenchen' | null; endKm: number; excludePlz: string[];
  items: LeerItem[];
  stats: { bookings: number; discount: number; revenue: number };
}

export interface GapDay {
  date: string;
  rides: number;
  hours: number[]; // 24 Werte: Fahrten je Stunde
  slots: ({ id: number; name: string; type: 'percent' | 'fixed'; value: number } | null)[]; // 48 Halbstunden
}
export interface GapOverview {
  enabled: boolean;
  days: GapDay[];
  stats: { bookings: number; discount: number; revenue: number };
}

export interface DemandDay {
  date: string;
  booked: number;
  expected: number;
  pace: number | null;
  leadHours: number;
  samples: number[];
  rule: { id: number; name: string; type: 'percent' | 'fixed'; value: number } | null;
}
export interface DemandOverview {
  settings: { enabled: boolean; minExpected: number; horizonDays: number };
  days: DemandDay[];
  stats: { bookings: number; discount: number; revenue: number };
}

export interface SearchBucket { searches: number; booked: number }
export interface SearchStats {
  from: string; to: string;
  totals: { searches: number; sessions: number; booked: number; bookings: number };
  byHour: SearchBucket[];
  defaultTime: SearchBucket;
  byBlock: (SearchBucket & { key: string })[];
  byWeekday: SearchBucket[];
  byLead: (SearchBucket & { key: string })[];
  discount: { shown: SearchBucket; notShown: SearchBucket };
  upcoming: (SearchBucket & { date: string })[];
}

// Persönliche Gutschein-Links (Rabatte → „Kişisel indirim“)
export type GutscheinReason = 'entschuldigung' | 'danke' | 'allgemein';
export interface PersonalGutscheinInput {
  name: string;
  email: string;
  lang: 'de' | 'en' | 'tr';
  percent: number;
  valid_days?: number;
  end_date?: string;
  reason: GutscheinReason;
  subject?: string;
  message?: string;
  note?: string;
}
export interface PersonalGutschein {
  id: number;
  code: string;
  percent: number;
  name: string | null;
  email: string | null;
  lang: 'de' | 'en' | 'tr';
  reason: GutscheinReason | null;
  note: string | null;
  subject: string | null;
  end_date: string;
  sent_at: string | null;
  created_at: string;
  status: 'open' | 'used' | 'expired' | 'inactive';
  url: string;
  booking: { id: number; booking_number: string; discount: number; price: number; status: string; booked_at: string; pickup: string } | null;
}

export const personalGutscheinApi = {
  list: async (): Promise<PersonalGutschein[]> => (await api.get('/promotions/admin/personal')).data,
  preview: async (body: PersonalGutscheinInput): Promise<{ subject: string; html: string; end_date: string; defaults: { subject: string; message: string } }> =>
    (await api.post('/promotions/admin/personal/preview', body)).data,
  create: async (body: PersonalGutscheinInput & { send: boolean }): Promise<{ id: number; code: string; url: string; end_date: string; sent: boolean; sendError: string | null }> =>
    (await api.post('/promotions/admin/personal', body)).data,
  send: async (id: number) => (await api.post(`/promotions/admin/personal/${id}/send`)).data,
  deactivate: async (id: number) => (await api.put(`/promotions/admin/personal/${id}/deactivate`)).data,
};

// Marketing (Admin → Marketing): Kampagnenkalender, Empfänger, Versand mit Gutschein-Link
export type MkLang = 'de' | 'en' | 'tr';
export type MkSegment = 'all' | 'privat' | 'business' | 'stamm' | 'business_stamm';
export type MkMode = 'greeting' | 'discount';
export interface MkText { subject: string; message: string; badge: string; button?: string; url?: string }
export interface MkOccasion {
  id: string; key: string; year: number; name: string;
  group: 'ferien' | 'fest' | 'business' | 'season' | 'custom';
  date: string; end: string | null; remindFrom: string; remindUntil: string;
  status: 'due' | 'upcoming' | 'sent' | 'skipped' | 'missed';
  sentAt: string | null; campaignId: number | null; daysLeft: number;
  enabled: boolean; leadDays: number; afterDays: number; segment: MkSegment; mode: MkMode;
  percent: number; validDays: number; maxAmount: number | null; isDefault: boolean;
  texts: Record<MkLang, MkText>;
}
export interface MkTemplate {
  id: string; name: string; texts: Record<MkLang, MkText>;
  defaults: { segment: MkSegment; mode: MkMode; percent: number; validDays: number; maxAmount: number | null };
}
export interface MkCalendar {
  occasions: MkOccasion[]; templates: MkTemplate[]; remindersEnabled: boolean; sourceErrors: string[];
  offer: Record<MkLang, { subject: string; message: string }>;
}
export interface MkCustomer {
  email: string; name: string; lastBooking: string | null; bookingCount: number;
  lang: MkLang; isBusiness: boolean; optedOut: boolean;
}
export interface MkSendText { subject: string; message: string; badge?: string; buttonText?: string; buttonUrl?: string }
export interface MkDiscount { percent: number; validDays?: number; endDate?: string; maxAmount?: number | null }
export interface MkSendBody {
  occasion_id?: string | null; occasion_year?: number | null;
  recipients?: Array<{ email: string; name?: string; lang?: MkLang }>;
  langMode?: 'customer' | MkLang; lang?: MkLang;
  texts: Partial<Record<MkLang, MkSendText>>;
  isHtml?: boolean; html?: string; discount?: MkDiscount | null;
}
export interface MkCampaign {
  id: number; occasion_id: string | null; occasion_year: number | null; status: string; subject: string;
  recipients: number; sent: number; failed: number; langs: string | null; created_at: string;
  discount: { percent: number; maxAmount: number | null; until: string } | null;
  redeemed: { count: number; discount: number; revenue: number };
  booked: { count: number; revenue: number };
  unsubscribed: number;
}

export const marketingApi = {
  calendar: async (): Promise<MkCalendar> => (await api.get('/admin/marketing2/calendar')).data,
  reminders: async (): Promise<{ count: number }> => (await api.get('/admin/marketing2/reminders')).data,
  saveOccasion: async (id: string, s: Partial<Pick<MkOccasion, 'enabled' | 'leadDays' | 'afterDays' | 'segment' | 'mode' | 'percent' | 'validDays' | 'maxAmount'>>) =>
    (await api.put(`/admin/marketing2/occasions/${encodeURIComponent(id)}/settings`, s)).data,
  resetOccasion: async (id: string) => (await api.delete(`/admin/marketing2/occasions/${encodeURIComponent(id)}/settings`)).data,
  skip: async (id: string, year: number) => (await api.post(`/admin/marketing2/occasions/${encodeURIComponent(id)}/skip`, { year })).data,
  unskip: async (id: string, year: number) => (await api.delete(`/admin/marketing2/occasions/${encodeURIComponent(id)}/skip`, { params: { year } })).data,
  setReminders: async (enabled: boolean) => (await api.put('/admin/marketing2/reminders-enabled', { enabled })).data,
  addCustom: async (c: { name: string; monthDay: string; leadDays: number; segment: MkSegment; mode: MkMode; percent: number; subject: string; message: string }) =>
    (await api.post('/admin/marketing2/custom-occasions', c)).data,
  deleteCustom: async (id: string) => (await api.delete(`/admin/marketing2/custom-occasions/${encodeURIComponent(id)}`)).data,
  customers: async (): Promise<{ customers: MkCustomer[]; optouts: string[] }> => (await api.get('/admin/marketing2/customers')).data,
  preview: async (b: MkSendBody & { name?: string }): Promise<{ subject: string; html: string }> => (await api.post('/admin/marketing2/preview', b)).data,
  test: async (b: MkSendBody): Promise<{ to: string }> => (await api.post('/admin/marketing2/test', b)).data,
  send: async (b: MkSendBody): Promise<{ campaignId: number; sent: number; failed: number; skippedOptout: number; codes: number; dryRun: boolean; errors: Array<{ email: string; error: string }> }> =>
    (await api.post('/admin/marketing2/send', b, { timeout: 900000 })).data,
  campaigns: async (): Promise<MkCampaign[]> => (await api.get('/admin/marketing2/campaigns')).data,
};

export const autoDiscountsApi = {
  searchStats: async (from: string, to: string): Promise<SearchStats> => {
    const response = await api.get('/auto-discounts/admin/search-stats', { params: { from, to } });
    return response.data;
  },
  demand: async (): Promise<DemandOverview> => {
    const response = await api.get('/auto-discounts/admin/demand');
    return response.data;
  },
  leer: async (): Promise<LeerOverview> => {
    const response = await api.get('/auto-discounts/admin/leer');
    return response.data;
  },
  gaps: async (): Promise<GapOverview> => {
    const response = await api.get('/auto-discounts/admin/gaps');
    return response.data;
  },
  getAll: async (): Promise<AutoDiscount[]> => {
    const response = await api.get('/auto-discounts/admin/list');
    return response.data;
  },
  create: async (data: Partial<AutoDiscount>) => {
    const response = await api.post('/auto-discounts/admin', data);
    return response.data;
  },
  update: async (id: number, data: Partial<AutoDiscount>) => {
    const response = await api.put(`/auto-discounts/admin/${id}`, data);
    return response.data;
  },
  toggle: async (id: number, active: boolean) => {
    const response = await api.put(`/auto-discounts/admin/${id}`, { active });
    return response.data;
  },
  remove: async (id: number) => {
    const response = await api.delete(`/auto-discounts/admin/${id}`);
    return response.data;
  },
};

// Fixed-price routes (Festpreisrouten) API
export interface FixedRoute {
  id: number; name: string; pickup_keywords: string; dropoff_keywords: string;
  price_kombi: number; price_van: number; price_grossraumtaxi: number;
  bidirectional: number; enabled: number;
}
export const fixedRoutesApi = {
  getAll: async (): Promise<FixedRoute[]> => {
    const response = await api.get('/fixed-routes');
    return response.data;
  },
  create: async (data: Partial<FixedRoute>): Promise<{ id: number }> => {
    const response = await api.post('/fixed-routes', data);
    return response.data;
  },
  update: async (id: number, data: Partial<FixedRoute>): Promise<void> => {
    await api.put(`/fixed-routes/${id}`, data);
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`/fixed-routes/${id}`);
  },
};

export interface StornoInfo {
  id: number;
  storno_number: string;
  kind?: 'single' | 'sammel';
  original_number: string;
  original_date?: string | null;
  amount: number | string;
  reason: string | null;
  sent_to: string | null;
  sent_at: string | null;
  send_error: string | null;
  created_at: string;
  created_by?: string | null;
  booking_id?: number | null;
  booking_number?: string | null;
  booking_name?: string | null;
  company_name?: string | null;
}

// Admin API
export const adminApi = {
  /** Returns { token } or, when 2FA is on, { mfa_required, mfa_token }. */
  login: async (username: string, password: string) => {
    let device_token: string | undefined;
    try { device_token = localStorage.getItem('admin_trusted_device') || undefined; } catch { /* private mode */ }
    const response = await api.post('/admin/login', { username, password, device_token });
    return response.data as { token?: string; username?: string; mfa_required?: boolean; mfa_token?: string };
  },

  login2fa: async (body: { mfa_token: string; code?: string; recovery_code?: string; remember: boolean }) => {
    const response = await api.post('/admin/login/2fa', body);
    return response.data as { token: string; username: string; device_token?: string };
  },

  twoFactorStatus: async () => {
    const response = await api.get('/admin/2fa/status');
    return response.data as { enabled: boolean; enabled_at: string | null; recovery_codes_left: number; username: string };
  },

  twoFactorSetup: async () => {
    const response = await api.post('/admin/2fa/setup');
    return response.data as { secret: string; otpauth_url: string; qr: string };
  },

  twoFactorEnable: async (code: string) => {
    const response = await api.post('/admin/2fa/enable', { code });
    return response.data as { success: boolean; recovery_codes: string[] };
  },

  twoFactorDisable: async (password: string, code: string) => {
    const response = await api.post('/admin/2fa/disable', { password, code });
    return response.data as { success: boolean; token: string };
  },

  twoFactorNewRecoveryCodes: async (code: string) => {
    const response = await api.post('/admin/2fa/recovery-codes', { code });
    return response.data as { success: boolean; recovery_codes: string[] };
  },

  getBookings: async (params?: {
    status?: string;
    vehicle_type?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    // Erweiterte Filter (backend/src/routes/admin.ts GET /bookings)
    payment?: string;
    customer?: string;
    rechnung?: string;
    paid?: string;
    source?: string;
    trip?: string;
    repeat?: string;
    same_as?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) => {
    // Leere Filter nicht mitschicken
    const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null));
    const response = await api.get('/admin/bookings', { params: clean });
    return response.data;
  },

  getBooking: async (id: number) => {
    const response = await api.get(`/admin/bookings/${id}`);
    return response.data;
  },

  updateStatus: async (id: number, status: string, cancel?: { cancel_reason: string; cancel_note: string; notify: boolean }) => {
    const response = await api.patch(`/admin/bookings/${id}/status`, { status, ...(cancel || {}) });
    return response.data;
  },

  stornoBookingInvoice: async (id: number, body: { reason_key: string; reason: string; send: boolean }) => {
    const response = await api.post(`/admin/bookings/${id}/storno`, body);
    return response.data as { success: boolean; storno: StornoInfo; email_error: string | null };
  },

  getBookingStornos: async (id: number) => {
    const response = await api.get(`/admin/bookings/${id}/stornos`);
    return response.data as StornoInfo[];
  },

  getStornos: async () => {
    const response = await api.get('/admin/stornos');
    return response.data as StornoInfo[];
  },

  resendStorno: async (id: number, email?: string) => {
    const response = await api.post(`/admin/stornos/${id}/send`, email ? { email } : {});
    return response.data;
  },

  deleteBooking: async (id: number) => {
    const response = await api.delete(`/admin/bookings/${id}`);
    return response.data;
  },

  createBooking: async (data: Partial<Booking>): Promise<Booking> => {
    const response = await api.post('/admin/bookings', data);
    return response.data;
  },

  updateBooking: async (id: number, data: Partial<Booking>): Promise<Booking> => {
    const response = await api.put(`/admin/bookings/${id}`, data);
    return response.data;
  },

  sendFinalConfirmation: async (id: number, force = false) => {
    const response = await api.post(`/admin/bookings/${id}/final-confirmation`, { force });
    return response.data as { success: boolean; sent_at: string; to: string };
  },

  resendAdminNotification: async (id: number): Promise<{ success: boolean; to: string }> => {
    const response = await api.post(`/admin/bookings/${id}/resend-admin-notification`, {});
    return response.data;
  },

  resendConfirmation: async (id: number): Promise<{ success: boolean }> => {
    const response = await api.post(`/admin/bookings/${id}/resend-confirmation`, {});
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  getStatistics: async () => {
    const response = await api.get('/admin/statistics');
    return response.data;
  },

  getVisitorGeoStats: async (range: 'today' | '7d' | '30d' | '6m' | 'all') => {
    const response = await api.get(`/admin/visitor-geo-stats?range=${range}`);
    return response.data;
  },

  updatePrice: async (vehicle_type: string, base_price: number, price_per_km: number, roundtrip_discount?: number, fahrrad_price?: number, fahrrad_enabled?: boolean, max_passengers?: number, max_luggage?: number, min_price?: number, min_price_km?: number) => {
    const response = await api.put(`/prices/${vehicle_type}`, { base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, max_passengers, max_luggage, min_price, min_price_km });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/admin/change-password', { currentPassword, newPassword });
    return response.data;
  },

  updateSettings: async (settings: Record<string, string>) => {
    const response = await api.put('/settings', settings);
    return response.data;
  },

  getCalendarStats: async (): Promise<CalendarStats> => {
    const response = await api.get('/admin/dashboard/calendar-stats');
    return response.data;
  },

  syncCalendarRides: async (): Promise<{ success: boolean; events: number; rides: number }> => {
    const response = await api.post('/admin/dashboard/calendar-sync', {}, { timeout: 120000 });
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/admin/dashboard');
    return response.data;
  },

  getTodayBookings: async (): Promise<Booking[]> => {
    const response = await api.get('/admin/bookings/today');
    return response.data;
  },

  getTomorrowCards: async (): Promise<Booking[]> => {
    const response = await api.get('/admin/bookings/tomorrow-cards');
    return response.data;
  },

  chargeSavedCard: async (bookingId: number): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post(`/admin/bookings/${bookingId}/charge-card`);
    return response.data;
  },

  updateSteuersatz: async (id: number, steuersatz: number | null) => {
    const response = await api.patch(`/admin/bookings/${id}/steuersatz`, { steuersatz });
    return response.data;
  },

  setStripeDate: async (id: number, stripe_payment_date: string | null) => {
    const response = await api.patch(`/admin/bookings/${id}/stripe-date`, { stripe_payment_date });
    return response.data;
  },

  syncStripeCharges: async (month: number, year: number, charges: Array<{id: string, amount: number, created: number}>) => {
    const response = await api.post('/admin/stripe/sync', { month, year, charges });
    return response.data;
  },

  getUnmatchedBookings: async (): Promise<Booking[]> => {
    const response = await api.get('/admin/stripe/unmatched');
    return response.data;
  },

  autoSyncStripe: async (month: number, year: number) => {
    const response = await api.post('/admin/stripe/auto-sync', { month, year }, { timeout: 120000 });
    return response.data;
  },

  getFinanzamtReport: (month: number, year: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return `${API_BASE_URL}/admin/report/finanzamt?month=${month}&year=${year}&token=${token}`;
  },

  getBankSettings: async (): Promise<Record<string, string>> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.get('/admin/bank-settings', { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  updateBankSettings: async (data: Record<string, string>): Promise<Record<string, string>> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.put('/admin/bank-settings', data, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  sendRechnung: async (bookingId: number, rechnungsnummer: string, mwst_satz: 0 | 7 | 19, sprache: 'de' | 'en', empfaenger_adresse?: string, zahlungsart?: string, force?: boolean): Promise<{ success: boolean }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post(`/admin/bookings/${bookingId}/rechnung`, { rechnungsnummer, mwst_satz, sprache, empfaenger_adresse, zahlungsart, force }, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getNextRechnungsnummer: async (): Promise<{ rechnungsnummer: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.get('/admin/rechnung/next-number', { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  // Arm the automatic invoice for a booking whose customer never ticked the box: the
  // address is stored now, the cron mails the invoice once the ride is over. Pass
  // enabled: false to switch the automation off again.
  setRechnungVormerken: async (bookingId: number, enabled: boolean, empfaenger_adresse?: string): Promise<{ success: boolean; booking: Booking }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post(`/admin/bookings/${bookingId}/rechnung-vormerken`, { enabled, empfaenger_adresse }, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  // ─── Proforma (bank transfer, sent before the ride) ───
  sendProforma: async (bookingId: number, proformanummer: string, mwst_satz: 0 | 7 | 19, sprache: 'de' | 'en', empfaenger_adresse?: string, force?: boolean): Promise<{ success: boolean; proformanummer: string; due_date: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post(`/admin/bookings/${bookingId}/proforma`, { proformanummer, mwst_satz, sprache, empfaenger_adresse, force }, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getNextProformaNummer: async (): Promise<{ proformanummer: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.get('/admin/proforma/next-number', { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  setUeberweisungPaid: async (bookingId: number, paid: boolean): Promise<{ success: boolean; ueberweisung_paid_at: string | null }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post(`/admin/bookings/${bookingId}/ueberweisung-paid`, { paid }, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  // ─── Marketing ───
  getMarketingCustomers: async (): Promise<Array<{ email: string; name: string; lastBooking: string; bookingCount: number }>> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.get('/admin/marketing/customers', { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  parseIcsFile: async (icsContent: string): Promise<Array<{ email: string; name?: string }>> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post('/admin/marketing/parse-ics', { icsContent }, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  previewMarketingEmail: async (data: { subject: string; content: string; buttonText?: string; buttonUrl?: string; isHtml?: boolean }): Promise<{ html: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post('/admin/marketing/preview', data, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  sendMarketingEmail: async (data: {
    recipients: Array<{ email: string; name?: string }>;
    subject: string;
    content: string;
    buttonText?: string;
    buttonUrl?: string;
    isHtml?: boolean;
  }): Promise<{ sent: number; failed: number; errors: Array<{ email: string; error: string }> }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post('/admin/marketing/send', data, { headers: { Authorization: `Bearer ${token}` }, timeout: 600000 });
    return response.data;
  },

  getReminderSettings: async (): Promise<{ enabled: boolean; time: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.get('/admin/settings/reminder', { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  saveReminderSettings: async (data: { enabled?: boolean; time?: string }): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    await api.post('/admin/settings/reminder', data, { headers: { Authorization: `Bearer ${token}` } });
  },
};

export default api;
