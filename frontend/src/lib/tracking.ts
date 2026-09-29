// Live tracking: API client + shared types/helpers for the customer page (/track), the
// driver app (/fahrer), the single-ride driver page (/fahrer/:bn) and the admin panel.

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

export type Lang = 'de' | 'en' | 'tr';
export type L3 = { de: string; en: string; tr: string };
export type RideStatus = 'scheduled' | 'assigned' | 'enroute' | 'arrived' | 'onboard' | 'completed';
export type Phase = 'disabled' | 'cancelled' | 'too_early' | 'active' | 'expired';
export type LatLng = { lat: number; lng: number };

export interface DriverLocation extends LatLng {
  heading: number | null;
  accuracy: number | null;
  speed?: number | null;
  age_s: number;
  source?: string | null;
}

export interface FlightLive {
  flight: string;
  status: string | null;
  scheduled: string | null;
  expected: string | null;
  actual: string | null;
  terminal: string | null;
  origin: string | null;
  delay_minutes: number | null;
}

export interface MeetingPointInfo { key: string; label: L3; text: L3; sign_name?: string | null }
export interface Timeline { enroute: number | null; arrived: number | null; onboard: number | null; completed: number | null }

export interface CustomerView {
  phase: Phase;
  booking_number: string;
  language: 'de' | 'en';
  pickup_datetime: string;
  pickup_address: string;
  dropoff_address: string;
  passengers: number;
  company: { phone: string; whatsapp: string };
  status?: RideStatus;
  timeline?: Timeline;
  driver?: { name: string; phone: string | null; vehicle_model: string | null; vehicle_plate: string | null } | null;
  driver_location?: DriverLocation | null;
  stale?: boolean;
  eta_minutes?: number | null;
  eta_target?: 'pickup' | 'dropoff' | null;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  meeting_point?: MeetingPointInfo | null;
  flight?: { number: string; info: string | null; live: FlightLive | null } | null;
  customer_location?: (LatLng & { age_s: number }) | null;
  share_location_enabled?: boolean;
}

export type PaymentKind = 'collect_cash' | 'collect_card' | 'paid_card' | 'paid_transfer' | 'transfer_open' | 'invoice';

export interface DriverRide {
  id: number;
  booking_number: string;
  status: Exclude<RideStatus, 'scheduled'>;
  booking_status: string;
  phase?: Phase;
  pickup_datetime: string;
  pickup_address: string;
  dropoff_address: string;
  zwischenstopp_address: string | null;
  customer_name: string;
  customer_phone: string | null;
  pickup_sign: string | null;
  passengers: number;
  luggage_count: number;
  child_seat: boolean;
  child_seat_details: string | null;
  fahrrad_count: number;
  notes: string | null;
  vehicle_type: string;
  flight_number: string | null;
  flight_info: string | null;
  language: string;
  payment: { kind: PaymentKind; amount: number };
  airport_pickup: boolean;
  timeline: Timeline;
  pickup?: (LatLng & { radius_m: number }) | null;
  dropoff?: LatLng | null;
  meeting_point?: MeetingPointInfo | null;
  flight_live?: FlightLive | null;
  driver_location?: DriverLocation | null;
  eta_minutes?: number | null;
  eta_target?: 'pickup' | 'dropoff' | null;
  customer_location?: (LatLng & { age_s: number }) | null;
}

export interface DriverProfile {
  id: number;
  name: string;
  phone: string | null;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  language: string;
  traccar: { device_id: string; server_url: string; last_fix_age_s: number | null } | null;
}

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

class ApiError extends Error {
  status: number;
  code: string | null;
  data: any;
  constructor(status: number, data: any) {
    super(data?.error || `HTTP ${status}`);
    this.status = status;
    this.code = typeof data?.error === 'string' ? data.error : null;
    this.data = data;
  }
}
export { ApiError };

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

const q = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;

// ─── customer ───
export const customerTracking = {
  get: (bn: string, t: string) => request<CustomerView>('GET', `/tracking/${encodeURIComponent(bn)}${q({ t })}`),
  shareLocation: (bn: string, t: string, fix: GeoFix) =>
    request<{ ok: boolean }>('POST', `/tracking/${encodeURIComponent(bn)}/customer-location`, { t, ...fix }),
  stopSharing: (bn: string, t: string) =>
    request<{ ok: boolean }>('DELETE', `/tracking/${encodeURIComponent(bn)}/customer-location${q({ t })}`),
};

// ─── driver: single ride (per-booking link) ───
export const singleRideApi = (bn: string, t: string) => ({
  get: () => request<{ phase: Phase; ride: DriverRide | null }>('GET', `/tracking/${encodeURIComponent(bn)}/driver${q({ t })}`),
  setStatus: (status: string) =>
    request<{ ok: boolean; ride: DriverRide }>('POST', `/tracking/${encodeURIComponent(bn)}/driver/status`, { t, status }),
  postFix: (fix: GeoFix) =>
    request<{ ok: boolean; stored: boolean; reason: string | null; status: string }>('POST', `/tracking/${encodeURIComponent(bn)}/location`, { t, ...fix }),
});

// ─── driver: personal app ───
export const driverAppApi = (d: string) => ({
  me: () => request<{ driver: DriverProfile; tracking_enabled: boolean; rides: DriverRide[] }>('GET', `/driver-app/me${q({ d })}`),
  ride: (bn: string) => request<{ ride: DriverRide }>('GET', `/driver-app/rides/${encodeURIComponent(bn)}${q({ d })}`),
  setStatus: (bn: string, status: string) =>
    request<{ ok: boolean; ride: DriverRide }>('POST', `/driver-app/rides/${encodeURIComponent(bn)}/status`, { d, status }),
  postFix: (fix: GeoFix) =>
    request<{ ok: boolean; stored: boolean; reason: string | null; active_booking_number: string | null; status: string | null }>(
      'POST', '/driver-app/location', { d, ...fix }),
});

// ─── admin ───
function adminHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AdminDriver {
  id: number;
  name: string;
  phone: string;
  vehicle_plate: string;
  vehicle_model: string;
  language: string;
  active: boolean;
  app_link: string;
  traccar_device_id: string | null;
  last_seen_age_s: number | null;
  last_source: string | null;
  last_fix_age_s: number | null;
  last_location: (LatLng & { heading: number | null; accuracy: number | null }) | null;
  active_booking: string | null;
  open_rides: number;
}

export type AlertKind = 'enroute' | 'arrived' | 'onboard' | 'completed' | 'gps_lost';
export const ALERT_KINDS: AlertKind[] = ['enroute', 'arrived', 'onboard', 'completed', 'gps_lost'];
export type MeetingPointKey = 't1' | 't2' | 'mac';
export interface MeetingPoint { lat: number; lng: number; radius_m: number; label: L3; text: L3 }

export interface TrackingSettings {
  enabled: boolean;
  share_customer_location: boolean;
  mail_enroute: boolean;
  mail_arrived: boolean;
  auto_onboard: boolean;
  auto_finish: boolean;
  complete_booking_on_finish: boolean;
  arrival_radius_m: number;
  good_accuracy_m: number;
  max_accuracy_m: number;
  gps_lost_minutes: number;
  retention_hours: number;
  link_open_hours_before: number;
  link_close_hours_after: number;
  admin_email_to: string;
  admin: Record<AlertKind, { sound: boolean; email: boolean }>;
  meeting_points: Record<MeetingPointKey, MeetingPoint>;
  airport_generic_text: L3;
}

export interface AdminLiveRide {
  id: number;
  booking_number: string;
  pickup_datetime: string;
  pickup_address: string;
  dropoff_address: string;
  customer_name: string;
  status: Exclude<RideStatus, 'scheduled'>;
  driver: { id: number; name: string; plate: string | null };
  driver_location: DriverLocation | null;
  gps_lost: boolean;
  eta_minutes: number | null;
  eta_target: 'pickup' | 'dropoff' | null;
  pickup: LatLng | null;
  timeline: Timeline;
}

export interface BookingTrackingPanelData {
  booking_id: number;
  booking_number: string;
  phase: Phase;
  status: Exclude<RideStatus, 'scheduled'> | null;
  driver: { id: number; name: string; phone: string; vehicle_plate: string; app_link: string } | null;
  timeline: Timeline;
  driver_loc_age_s: number | null;
  driver_accuracy: number | null;
  driver_source: string | null;
  gps_lost: boolean;
  customer_sharing: boolean;
  meeting_point: string | null;
  resolved_pickup: { label: string | null; radius_m: number } | null;
  airport: boolean;
  mails: { link: boolean; enroute: boolean; arrived: boolean };
  links: { customer: string; single_ride_driver: string };
  customer: { name: string; phone: string; email: string; language: string };
}

export interface TrackingEvent {
  id: number;
  booking_id: number;
  booking_number: string;
  kind: AlertKind;
  detail: string | null;
  created_at: string;
  driver_name: string | null;
}

const A = '/admin/tracking';
export const adminTracking = {
  settings: () => request<{ settings: TrackingSettings; defaults: TrackingSettings; traccar_server_url: string; admin_email_default: string; email_configured: boolean }>(
    'GET', `${A}/settings`, undefined, adminHeaders()),
  saveSettings: (s: TrackingSettings) => request<{ settings: TrackingSettings }>('PUT', `${A}/settings`, s, adminHeaders()),
  drivers: () => request<{ drivers: AdminDriver[]; traccar_server_url: string }>('GET', `${A}/drivers`, undefined, adminHeaders()),
  createDriver: (d: Partial<AdminDriver>) => request<{ driver: AdminDriver }>('POST', `${A}/drivers`, d, adminHeaders()),
  updateDriver: (id: number, d: Partial<AdminDriver>) => request<{ driver: AdminDriver }>('PUT', `${A}/drivers/${id}`, d, adminHeaders()),
  deleteDriver: (id: number) => request<{ ok: boolean }>('DELETE', `${A}/drivers/${id}`, undefined, adminHeaders()),
  rotateLink: (id: number) => request<{ driver: AdminDriver }>('POST', `${A}/drivers/${id}/rotate-link`, {}, adminHeaders()),
  enableTraccar: (id: number) => request<{ driver: AdminDriver }>('POST', `${A}/drivers/${id}/traccar`, {}, adminHeaders()),
  disableTraccar: (id: number) => request<{ driver: AdminDriver }>('DELETE', `${A}/drivers/${id}/traccar`, undefined, adminHeaders()),
  live: () => request<{ rides: AdminLiveRide[]; drivers: AdminDriver[] }>('GET', `${A}/live`, undefined, adminHeaders()),
  events: (since: number | null) =>
    request<{ events: TrackingEvent[]; last_id: number; sound: Record<AlertKind, boolean> }>(
      'GET', `${A}/events${since != null ? q({ since: String(since) }) : ''}`, undefined, adminHeaders()),
  testAlert: (kind: AlertKind) => request<{ ok: boolean }>('POST', `${A}/test-alert`, { kind }, adminHeaders()),
  booking: (id: number) => request<BookingTrackingPanelData>('GET', `${A}/bookings/${id}`, undefined, adminHeaders()),
  assign: (id: number, driver_id: number | null) => request<BookingTrackingPanelData>('POST', `${A}/bookings/${id}/assign`, { driver_id }, adminHeaders()),
  setStatus: (id: number, status: string) => request<BookingTrackingPanelData>('POST', `${A}/bookings/${id}/status`, { status }, adminHeaders()),
  setMeetingPoint: (id: number, meeting_point: string | null) =>
    request<BookingTrackingPanelData>('POST', `${A}/bookings/${id}/meeting-point`, { meeting_point }, adminHeaders()),
  sendLink: (id: number) => request<BookingTrackingPanelData>('POST', `${A}/bookings/${id}/send-link`, {}, adminHeaders()),
};

// ─── helpers ───

export function berlinClock(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return '';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(epochSeconds * 1000));
}

// pickup_datetime is Berlin wall clock ("YYYY-MM-DDTHH:mm:ss").
export function pickupParts(dt: string): { date: string; time: string; ymd: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(dt || '');
  if (!m) return { date: dt, time: '', ymd: '' };
  return { date: `${m[3]}.${m[2]}.${m[1]}`, time: `${m[4]}:${m[5]}`, ymd: `${m[1]}-${m[2]}-${m[3]}` };
}

export function berlinTodayYmd(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d);
}

export function arrivalClock(etaMinutes: number): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })
    .format(new Date(Date.now() + etaMinutes * 60_000));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`;
}

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

export function waLink(phone: string | null | undefined, text?: string): string {
  const digits = String(phone || '').replace(/[^\d]/g, '').replace(/^00/, '');
  const normalized = digits.startsWith('0') ? `49${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telLink(phone: string | null | undefined): string {
  return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
}

export function initials(name: string | null | undefined): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
