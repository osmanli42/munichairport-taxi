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
    if (token && (config.url?.startsWith('/admin') || config.url?.startsWith('/plz-surcharges') || config.url?.startsWith('/pflichtgebiet/exclusions') || config.url?.startsWith('/fixed-routes') || config.method === 'put' || config.method === 'delete')) {
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

export interface TrackingData {
  booking_number: string;
  driver_status: 'assigned' | 'enroute' | 'arrived' | 'completed' | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  pickup: { lat: number; lng: number } | null;
  driver: { name: string; phone: string; vehicle_plate: string; vehicle_model: string } | null;
  driver_location: { lat: number; lng: number; updated_at: string } | null;
  customer_location: { lat: number; lng: number; updated_at: string } | null;
  eta_minutes: number | null;
}

export const trackingApi = {
  get: async (booking_number: string, token: string): Promise<TrackingData> => {
    const response = await api.get(`/tracking/${booking_number}`, { params: { t: token } });
    return response.data;
  },
  postLocation: async (booking_number: string, lat: number, lng: number, token: string) => {
    const response = await api.post(`/tracking/${booking_number}/location`, { lat, lng, t: token });
    return response.data as { ok: boolean; driver_status: string; pickup: { lat: number; lng: number } | null; pickup_address: string | null; dropoff_address: string | null; customer_name: string | null; customer_location: { lat: number; lng: number } | null };
  },
  postCustomerLocation: async (booking_number: string, lat: number, lng: number, token: string) => {
    const response = await api.post(`/tracking/${booking_number}/customer-location`, { lat, lng, t: token });
    return response.data as { ok: boolean };
  },
};

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
  discount_percent: number;
  zone_scope: 'inside' | 'outside' | 'any';
  min_km: number | null;
  max_km: number | null;
  hour_from: number | null;
  hour_to: number | null;
  weekday_mask: string | null;
  booking_index_max: number | null;
  max_uses: number | null;
  used_count: number;
  max_discount_amount: number | null;
  vehicle_types: string | null;
  trip_types: string | null;
  start_date: string | null;
  end_date: string | null;
  active: number;
  priority: number;
  stackable_with_promo: number;
}
export const autoDiscountsApi = {
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

// Admin API
export const adminApi = {
  login: async (username: string, password: string) => {
    const response = await api.post('/admin/login', { username, password });
    return response.data;
  },

  getBookings: async (params?: {
    status?: string;
    vehicle_type?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/admin/bookings', { params });
    return response.data;
  },

  getBooking: async (id: number) => {
    const response = await api.get(`/admin/bookings/${id}`);
    return response.data;
  },

  updateStatus: async (id: number, status: string) => {
    const response = await api.patch(`/admin/bookings/${id}/status`, { status });
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

  sendRechnung: async (bookingId: number, rechnungsnummer: string, mwst_satz: 0 | 7 | 19, sprache: 'de' | 'en', empfaenger_adresse?: string, zahlungsart?: string): Promise<{ success: boolean }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.post(`/admin/bookings/${bookingId}/rechnung`, { rechnungsnummer, mwst_satz, sprache, empfaenger_adresse, zahlungsart }, { headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  },

  getNextRechnungsnummer: async (): Promise<{ rechnungsnummer: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
    const response = await api.get('/admin/rechnung/next-number', { headers: { Authorization: `Bearer ${token}` } });
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

  getDrivers: async () => {
    const response = await api.get('/admin/drivers');
    return response.data;
  },

  createDriver: async (data: { name: string; phone?: string; vehicle_plate?: string; vehicle_model?: string }) => {
    const response = await api.post('/admin/drivers', data);
    return response.data;
  },

  assignDriver: async (bookingId: number, driver_id: number | null) => {
    const response = await api.post(`/admin/bookings/${bookingId}/assign-driver`, { driver_id });
    return response.data as { ok: boolean; assigned: boolean; customer_link?: string; driver_link?: string };
  },

  getTrackingLinks: async (bookingId: number) => {
    const response = await api.get(`/admin/bookings/${bookingId}/tracking-links`);
    return response.data as { customer_link: string; driver_link: string };
  },
};

export default api;
