// Live tracking core: one place that decides what a GPS fix means.
//
// Positions arrive from three sources — the per-booking driver link, the personal driver
// app, and the Traccar Client app (background GPS) — and all go through ingestFix(). It
// filters bad fixes, moves the ride through its lifecycle
//   assigned → enroute → arrived → onboard → completed
// with dwell/hit counts instead of a single lucky fix, and triggers the side effects
// (customer e-mails, admin alerts). Views for the customer page, the driver app and the
// admin panel are built here too, so all three always agree on status, ETA and pickup
// point.
//
// Times: pickup_datetime is Berlin wall-clock VARCHAR; every DATETIME column below is
// written with NOW() and only ever read back through TIMESTAMPDIFF/UNIX_TIMESTAMP in SQL,
// so the result is correct whatever time zone the Node process or MySQL session uses.

import cron from 'node-cron';
import { query, run } from '../db';
import { berlinNowSql } from '../utils/berlinTime';
import { signToken, signDriverAppToken } from '../utils/trackingToken';
import { getFlightStatus, FlightStatus, normalizeFlightNumber } from './flightStatus';
import { sendTrackingCustomerEmail, sendTrackingAdminEmail } from './trackingEmails';

export type DriverStatus = 'assigned' | 'enroute' | 'arrived' | 'onboard' | 'completed';
export const LIFECYCLE: DriverStatus[] = ['assigned', 'enroute', 'arrived', 'onboard', 'completed'];
export const LIVE_STATUSES: DriverStatus[] = ['enroute', 'arrived', 'onboard'];
export const ALERT_KINDS = ['enroute', 'arrived', 'onboard', 'completed', 'gps_lost'] as const;
export type AlertKind = typeof ALERT_KINDS[number];
export type MeetingPointKey = 't1' | 't2' | 'mac';
export const MEETING_POINT_KEYS: MeetingPointKey[] = ['t1', 't2', 'mac'];

export type L3 = { de: string; en: string; tr: string };
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

export const COMPANY_CONTACT = { phone: '+4915141620000', whatsapp: '4915141620000' };
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://flughafen-muenchen.taxi').replace(/\/$/, '');

// Terminal points from Google geocoding (Sep 2026); T1 is shifted west to the middle of
// its long module row (A–E) and gets a wider radius. The office can drag each pin on the
// map in admin (Fahrer tab) to where drivers actually wait.
//
// Airport pickups never use address geocoding: a bare "Flughafen München" geocodes to
// Munich city centre (48.135, 11.582), 30 km away from the terminals.
export const DEFAULT_SETTINGS: TrackingSettings = {
  enabled: true,
  share_customer_location: true,
  mail_enroute: true,
  mail_arrived: true,
  auto_onboard: true,
  auto_finish: true,
  complete_booking_on_finish: true,
  arrival_radius_m: 120,
  good_accuracy_m: 60,
  max_accuracy_m: 400,
  gps_lost_minutes: 4,
  retention_hours: 24,
  link_open_hours_before: 24,
  link_close_hours_after: 2,
  admin_email_to: '',
  admin: {
    enroute: { sound: false, email: false },
    arrived: { sound: true, email: false },
    onboard: { sound: false, email: false },
    completed: { sound: false, email: false },
    gps_lost: { sound: true, email: true },
  },
  meeting_points: {
    t1: {
      lat: 48.35370, lng: 11.78000, radius_m: 450,
      label: { de: 'Terminal 1 – Ankunft', en: 'Terminal 1 – Arrivals', tr: 'Terminal 1 – Geliş' },
      text: {
        de: 'Ihr Fahrer wartet im Ankunftsbereich von Terminal 1 mit einem Namensschild.',
        en: 'Your driver is waiting in the Terminal 1 arrivals area with a name sign.',
        tr: 'Şoförünüz Terminal 1 geliş alanında isim tabelasıyla bekliyor.',
      },
    },
    t2: {
      lat: 48.35537, lng: 11.79001, radius_m: 300,
      label: { de: 'Terminal 2 – Ankunft', en: 'Terminal 2 – Arrivals', tr: 'Terminal 2 – Geliş' },
      text: {
        de: 'Ihr Fahrer wartet am Ausgang der Ankunftshalle von Terminal 2 mit einem Namensschild.',
        en: 'Your driver is waiting at the Terminal 2 arrivals hall exit with a name sign.',
        tr: 'Şoförünüz Terminal 2 geliş salonu çıkışında isim tabelasıyla bekliyor.',
      },
    },
    mac: {
      lat: 48.35335, lng: 11.78643, radius_m: 200,
      label: { de: 'München Airport Center (MAC)', en: 'Munich Airport Center (MAC)', tr: 'Münih Havalimanı Merkezi (MAC)' },
      text: {
        de: 'Treffpunkt im München Airport Center zwischen Terminal 1 und 2.',
        en: 'Meeting point at the Munich Airport Center between Terminal 1 and 2.',
        tr: 'Buluşma noktası Terminal 1 ile 2 arasındaki Münih Havalimanı Merkezi.',
      },
    },
  },
  airport_generic_text: {
    de: 'Ihr Fahrer erwartet Sie im Ankunftsbereich mit einem Namensschild. Bei Fragen rufen Sie ihn einfach an.',
    en: 'Your driver will meet you in the arrivals area with a name sign. Just call if you need help.',
    tr: 'Şoförünüz geliş alanında isim tabelasıyla sizi bekliyor. Sorunuz olursa arayabilirsiniz.',
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const wallMs = (s: string) => Date.parse(String(s || '').slice(0, 19).replace(' ', 'T') + 'Z');
const nowWallMs = () => wallMs(berlinNowSql());
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

const AIRPORT_RE = /flughafen\s*m(ü|ue|u)nchen|munich\s*airport|airport\s*munich|m(ü|ue|u)nchen[\s-]*flughafen|\bMUC\b|franz[\s-]*josef[\s-]*strau/i;
export const isAirportAddress = (a: string | null | undefined) => AIRPORT_RE.test(String(a || ''));

// ─── settings ───────────────────────────────────────────────────────────────

let settingsCache: { s: TrackingSettings; at: number } | null = null;

function mergeSettings(raw: any): TrackingSettings {
  const d = DEFAULT_SETTINGS;
  const out: TrackingSettings = JSON.parse(JSON.stringify(d));
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(d) as (keyof TrackingSettings)[]) {
    if (k === 'admin' || k === 'meeting_points' || k === 'airport_generic_text') continue;
    if (raw[k] !== undefined && typeof raw[k] === typeof d[k]) (out as any)[k] = raw[k];
  }
  for (const kind of ALERT_KINDS) {
    const a = raw.admin?.[kind];
    if (a) out.admin[kind] = { sound: !!a.sound, email: !!a.email };
  }
  for (const key of MEETING_POINT_KEYS) {
    const m = raw.meeting_points?.[key];
    if (!m) continue;
    const base = out.meeting_points[key];
    out.meeting_points[key] = {
      lat: num(m.lat) ?? base.lat,
      lng: num(m.lng) ?? base.lng,
      radius_m: num(m.radius_m) ?? base.radius_m,
      label: { ...base.label, ...(m.label || {}) },
      text: { ...base.text, ...(m.text || {}) },
    };
  }
  if (raw.airport_generic_text) out.airport_generic_text = { ...out.airport_generic_text, ...raw.airport_generic_text };
  return out;
}

export async function getTrackingSettings(): Promise<TrackingSettings> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.s;
  let raw: any = null;
  try {
    const [row] = await query<{ config_json: string }>('SELECT config_json FROM tracking_config WHERE id = 1');
    raw = row ? JSON.parse(row.config_json) : null;
  } catch { raw = null; }
  const s = mergeSettings(raw);
  settingsCache = { s, at: Date.now() };
  return s;
}

export async function saveTrackingSettings(next: TrackingSettings): Promise<TrackingSettings> {
  const merged = mergeSettings(next);
  const json = JSON.stringify(merged);
  await run(
    `INSERT INTO tracking_config (id, config_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE config_json = ?`,
    [json, json]
  );
  settingsCache = { s: merged, at: Date.now() };
  return merged;
}

// ─── links ──────────────────────────────────────────────────────────────────

function localePrefix(lang: string | null | undefined): string {
  return lang === 'en' ? '/en' : lang === 'tr' ? '/tr' : '';
}

export function customerTrackingUrl(bookingNumber: string, lang?: string | null): string {
  return `${PUBLIC_SITE_URL}${localePrefix(lang)}/track/${bookingNumber}?t=${signToken(bookingNumber, 'cust')}`;
}

export function singleRideDriverUrl(bookingNumber: string, lang?: string | null): string {
  return `${PUBLIC_SITE_URL}${localePrefix(lang)}/fahrer/${bookingNumber}?t=${signToken(bookingNumber, 'drv')}`;
}

export function driverAppUrl(driver: { id: number; app_token_version: number; language?: string | null }): string {
  return `${PUBLIC_SITE_URL}${localePrefix(driver.language)}/fahrer?d=${signDriverAppToken(driver.id, Number(driver.app_token_version) || 1)}`;
}

export function traccarServerUrl(): string {
  return `${PUBLIC_SITE_URL}/api/traccar`;
}

// ─── booking loader ─────────────────────────────────────────────────────────

const BOOKING_SELECT = `
  SELECT b.*,
    TIMESTAMPDIFF(SECOND, b.driver_location_updated_at, NOW()) AS driver_loc_age_s,
    TIMESTAMPDIFF(SECOND, b.customer_location_updated_at, NOW()) AS customer_loc_age_s,
    TIMESTAMPDIFF(SECOND, b.driver_arrived_at, NOW()) AS arrived_age_s,
    TIMESTAMPDIFF(MINUTE, b.driver_completed_at, NOW()) AS completed_age_min,
    UNIX_TIMESTAMP(b.driver_fix_at) AS driver_fix_ts,
    UNIX_TIMESTAMP(b.driver_enroute_at) AS enroute_ts,
    UNIX_TIMESTAMP(b.driver_arrived_at) AS arrived_ts,
    UNIX_TIMESTAMP(b.driver_onboard_at) AS onboard_ts,
    UNIX_TIMESTAMP(b.driver_completed_at) AS completed_ts,
    d.name AS driver_name, d.phone AS driver_phone, d.vehicle_plate AS driver_plate,
    d.vehicle_model AS driver_model, d.language AS driver_language
  FROM bookings b
  LEFT JOIN drivers d ON d.id = b.assigned_driver_id`;

export async function loadBookingById(id: number): Promise<any | null> {
  const [b] = await query<any>(`${BOOKING_SELECT} WHERE b.id = ?`, [id]);
  return b || null;
}

export async function loadBookingByNumber(bn: string): Promise<any | null> {
  const [b] = await query<any>(`${BOOKING_SELECT} WHERE b.booking_number = ?`, [bn]);
  return b || null;
}

export async function loadActiveRideForDriver(driverId: number): Promise<any | null> {
  const [b] = await query<any>(
    `${BOOKING_SELECT}
      WHERE b.assigned_driver_id = ? AND b.driver_status IN ('enroute','arrived','onboard') AND b.status <> 'cancelled'
      ORDER BY b.driver_enroute_at DESC LIMIT 1`,
    [driverId]
  );
  return b || null;
}

export async function loadRidesForDriver(driverId: number): Promise<any[]> {
  const from = berlinNowSql(new Date(Date.now() - 12 * 3600_000));
  const to = berlinNowSql(new Date(Date.now() + 8 * 24 * 3600_000));
  const rows = await query<any>(
    `${BOOKING_SELECT}
      WHERE b.assigned_driver_id = ? AND b.status <> 'cancelled'
        AND (b.driver_status IN ('enroute','arrived','onboard')
             OR (STR_TO_DATE(b.pickup_datetime, '%Y-%m-%dT%H:%i:%s') BETWEEN ? AND ?
                 AND (b.driver_status IS NULL OR b.driver_status <> 'completed' OR b.driver_completed_at > NOW() - INTERVAL 12 HOUR)))
      ORDER BY b.pickup_datetime ASC LIMIT 60`,
    [driverId, from, to]
  );
  return rows;
}

// ─── window ─────────────────────────────────────────────────────────────────

export type Phase = 'disabled' | 'cancelled' | 'too_early' | 'active' | 'expired';

export function trackingPhase(b: any, s: TrackingSettings): Phase {
  if (!s.enabled) return 'disabled';
  if (b.status === 'cancelled') return 'cancelled';
  if (b.driver_status === 'completed') {
    const ago = num(b.completed_age_min);
    return ago != null && ago > s.link_close_hours_after * 60 ? 'expired' : 'active';
  }
  const pickup = wallMs(b.pickup_datetime);
  if (Number.isNaN(pickup)) return 'active';
  const now = nowWallMs();
  const live = LIVE_STATUSES.includes(b.driver_status);
  if (!live && now > pickup + ((num(b.duration_minutes) || 0) + 12 * 60) * 60_000) return 'expired';
  if (!live && now < pickup - s.link_open_hours_before * 3600_000) return 'too_early';
  return 'active';
}

// ─── geocoding, pickup point, ETA ───────────────────────────────────────────

// Env only — no literal fallback (public repo). Without a key, geocoding and traffic ETA
// are skipped and the straight-line estimate is used.
const GOOGLE_API_KEY = (() => {
  const k1 = process.env.GOOGLE_MAPS_API_KEY || '';
  const k2 = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  return k1.length > 35 ? k1 : k2.length > 35 ? k2 : '';
})();
if (!GOOGLE_API_KEY) console.warn('[driverTracking] GOOGLE_MAPS_API_KEY not set — geocoding/traffic ETA skipped');

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_API_KEY || !address) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('region', 'de');
    url.searchParams.set('key', GOOGLE_API_KEY);
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    const data = await r.json() as any;
    const loc = data?.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch { return null; }
}

export async function ensureCoords(b: any, which: 'pickup' | 'dropoff'): Promise<{ lat: number; lng: number } | null> {
  const lat = num(b[`${which}_lat`]);
  const lng = num(b[`${which}_lng`]);
  if (lat != null && lng != null) return { lat, lng };
  const coords = await geocode(b[`${which}_address`]);
  if (coords) {
    await run(`UPDATE bookings SET ${which}_lat = ?, ${which}_lng = ? WHERE id = ?`, [coords.lat, coords.lng, b.id]);
    b[`${which}_lat`] = coords.lat;
    b[`${which}_lng`] = coords.lng;
  }
  return coords;
}

export interface ResolvedPickup {
  lat: number;
  lng: number;
  radius_m: number;
  meeting_point: { key: MeetingPointKey | 'airport'; label: L3; text: L3 } | null;
}

export function autoMeetingPointKey(b: any, flightTerminal?: string | null): MeetingPointKey | null {
  const a = String(b.pickup_address || '');
  if (!isAirportAddress(a)) return null;
  if (/terminal\s*1\b|\bT\s?1\b|modul\s*[A-F]\b/i.test(a)) return 't1';
  if (/terminal\s*2\b|\bT\s?2\b/i.test(a)) return 't2';
  if (/airport\s*center|\bMAC\b/i.test(a)) return 'mac';
  if (flightTerminal === '1') return 't1';
  if (flightTerminal === '2') return 't2';
  return null;
}

export async function resolvePickup(b: any, s: TrackingSettings, flight?: FlightStatus | null): Promise<ResolvedPickup | null> {
  const override = MEETING_POINT_KEYS.includes(b.meeting_point) ? (b.meeting_point as MeetingPointKey) : null;
  const key = override ?? (b.meeting_point === 'address' ? null : autoMeetingPointKey(b, flight?.terminal));
  if (key) {
    const mp = s.meeting_points[key];
    return { lat: mp.lat, lng: mp.lng, radius_m: mp.radius_m, meeting_point: { key, label: mp.label, text: mp.text } };
  }
  if (b.meeting_point !== 'address' && isAirportAddress(b.pickup_address)) {
    // Airport, terminal unknown: centre on MAC with a radius spanning both terminal curbs.
    const mac = s.meeting_points.mac;
    return {
      lat: mac.lat, lng: mac.lng, radius_m: Math.max(mac.radius_m, 800),
      meeting_point: {
        key: 'airport',
        label: { de: 'Flughafen München', en: 'Munich Airport', tr: 'Münih Havalimanı' },
        text: s.airport_generic_text,
      },
    };
  }
  const c = await ensureCoords(b, 'pickup');
  return c ? { ...c, radius_m: s.arrival_radius_m, meeting_point: null } : null;
}

// Destination point for "onboard" ETA and auto-finish. Same airport rule as pickup: never
// trust address geocoding for "Flughafen München".
export async function resolveDropoff(b: any, s: TrackingSettings): Promise<{ lat: number; lng: number; radius_m: number } | null> {
  const a = String(b.dropoff_address || '');
  if (isAirportAddress(a)) {
    const key: MeetingPointKey | null = /terminal\s*1\b|\bT\s?1\b/i.test(a) ? 't1' : /terminal\s*2\b|\bT\s?2\b/i.test(a) ? 't2' : null;
    if (key) {
      const mp = s.meeting_points[key];
      return { lat: mp.lat, lng: mp.lng, radius_m: Math.max(mp.radius_m, 450) };
    }
    const mac = s.meeting_points.mac;
    return { lat: mac.lat, lng: mac.lng, radius_m: 900 };
  }
  const c = await ensureCoords(b, 'dropoff');
  return c ? { ...c, radius_m: 150 } : null;
}

const etaCache = new Map<number, { target: string; minutes: number; at: number; from: { lat: number; lng: number } }>();

async function googleEtaMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<number | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${from.lat},${from.lng}`);
    url.searchParams.set('destinations', `${to.lat},${to.lng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('key', GOOGLE_API_KEY);
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    const data = await r.json() as any;
    const el = data?.rows?.[0]?.elements?.[0];
    if (el?.status !== 'OK') return null;
    const secs = el.duration_in_traffic?.value ?? el.duration?.value;
    return Number.isFinite(secs) ? secs / 60 : null;
  } catch { return null; }
}

// Traffic-aware ETA, cached per ride: a customer page polling every 5 s must not turn into
// 720 paid API calls an hour. Recomputed after 60 s if the car moved, and at most every 3 min.
export async function etaMinutes(bookingId: number, from: { lat: number; lng: number }, to: { lat: number; lng: number }, target: string): Promise<number> {
  const straight = haversineMeters(from, to);
  if (straight < 150) return 1;
  const c = etaCache.get(bookingId);
  const now = Date.now();
  if (c && c.target === target) {
    const age = now - c.at;
    const moved = haversineMeters(from, c.from);
    if (age < 180_000 && (age < 60_000 || moved < 150)) {
      return Math.max(1, Math.round(c.minutes - age / 60_000));
    }
  }
  const api = await googleEtaMinutes(from, to);
  // Fallback: road factor 1.35 at 40 km/h average.
  const minutes = api ?? (straight * 1.35) / (40_000 / 60);
  etaCache.set(bookingId, { target, minutes, at: now, from });
  return Math.max(1, Math.round(minutes));
}

// Flight status only for airport pickups near pickup time — the API is billed per call.
export async function flightFor(b: any): Promise<FlightStatus | null> {
  if (!normalizeFlightNumber(b.flight_number) || !isAirportAddress(b.pickup_address)) return null;
  const pickup = wallMs(b.pickup_datetime);
  if (Number.isNaN(pickup)) return null;
  const now = nowWallMs();
  if (now < pickup - 5 * 3600_000 || now > pickup + 3 * 3600_000) return null;
  if (b.driver_status === 'onboard' || b.driver_status === 'completed') return null;
  return getFlightStatus(b.flight_number, String(b.pickup_datetime).slice(0, 10));
}

// ─── fixes ──────────────────────────────────────────────────────────────────

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;       // m/s
  timestamp: number | null;   // epoch ms (device time)
  source: 'web' | 'traccar';
}

export function parseFix(input: any, source: Fix['source']): Fix | null {
  const lat = num(input?.lat ?? input?.latitude);
  const lng = num(input?.lng ?? input?.lon ?? input?.longitude);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const accuracy = num(input?.accuracy);
  const heading = num(input?.heading ?? input?.bearing);
  const speed = num(input?.speed);
  let ts = num(input?.timestamp);
  if (ts != null && ts < 1e11) ts *= 1000; // seconds → ms
  return {
    lat, lng,
    accuracy: accuracy != null && accuracy >= 0 ? accuracy : null,
    heading: heading != null && heading >= 0 && heading <= 360 ? heading : null,
    speed: speed != null && speed >= 0 && speed < 100 ? speed : null,
    timestamp: ts,
    source,
  };
}

type Motion = { arriveHits: number; arriveFirst: number; leaveHits: number; finishHits: number; finishFirst: number };
const motion = new Map<number, Motion>();
const lastStoredAt = new Map<number, number>();

function motionFor(id: number): Motion {
  let m = motion.get(id);
  if (!m) { m = { arriveHits: 0, arriveFirst: 0, leaveHits: 0, finishHits: 0, finishFirst: 0 }; motion.set(id, m); }
  return m;
}

export interface IngestResult { stored: boolean; reason?: string; booking?: any }

// Store a fix on a ride and let it advance the lifecycle. `b` must be loaded with
// BOOKING_SELECT. Fixes are only kept while the ride is live — outside of that nothing
// about the driver's whereabouts is written (privacy; see retention purge below).
export async function ingestFix(b: any, fix: Fix, driverId: number | null): Promise<IngestResult> {
  const s = await getTrackingSettings();
  if (driverId) {
    await run('UPDATE drivers SET last_seen_app_at = NOW(), last_source = ? WHERE id = ?', [fix.source, driverId]).catch(() => {});
  }
  if (!s.enabled) return { stored: false, reason: 'disabled' };
  if (!b || !LIVE_STATUSES.includes(b.driver_status) || b.status === 'cancelled') return { stored: false, reason: 'no_active_ride' };
  if (fix.accuracy != null && fix.accuracy > s.max_accuracy_m) return { stored: false, reason: 'inaccurate', booking: b };

  const nowMs = Date.now();
  const fixMs = fix.timestamp != null ? Math.min(fix.timestamp, nowMs) : nowMs;
  if (nowMs - fixMs > 10 * 60_000) return { stored: false, reason: 'stale', booking: b };
  const storedTs = num(b.driver_fix_ts);
  if (storedTs != null && fixMs / 1000 < storedTs - 1) return { stored: false, reason: 'out_of_order', booking: b };
  const last = lastStoredAt.get(b.id) || 0;
  if (nowMs - last < 1500) return { stored: false, reason: 'throttled', booking: b };
  lastStoredAt.set(b.id, nowMs);

  await run(
    `UPDATE bookings SET driver_lat = ?, driver_lng = ?, driver_accuracy = ?, driver_heading = ?, driver_speed = ?,
       driver_fix_at = FROM_UNIXTIME(?), driver_source = ?, driver_location_updated_at = NOW(), tracking_gps_lost_at = NULL
     WHERE id = ?`,
    [fix.lat, fix.lng, fix.accuracy, fix.heading, fix.speed, Math.floor(fixMs / 1000), fix.source, b.id]
  );
  const ownerId = driverId ?? num(b.assigned_driver_id);
  if (ownerId) {
    await run(
      `UPDATE drivers SET last_lat = ?, last_lng = ?, last_accuracy = ?, last_heading = ?, last_fix_at = NOW(), last_source = ? WHERE id = ?`,
      [fix.lat, fix.lng, fix.accuracy, fix.heading, fix.source, ownerId]
    ).catch(() => {});
  }
  Object.assign(b, {
    driver_lat: fix.lat, driver_lng: fix.lng, driver_accuracy: fix.accuracy, driver_heading: fix.heading,
    driver_speed: fix.speed, driver_loc_age_s: 0, driver_fix_ts: Math.floor(fixMs / 1000),
  });

  await evaluateMotion(b, fix, s);
  return { stored: true, booking: b };
}

async function evaluateMotion(b: any, fix: Fix, s: TrackingSettings): Promise<void> {
  // Unknown accuracy: Traccar sometimes omits it but is GPS-only; browsers always send it.
  const good = fix.accuracy == null ? fix.source === 'traccar' : fix.accuracy <= s.good_accuracy_m;
  if (!good) return;
  const m = motionFor(b.id);
  const now = Date.now();

  if (b.driver_status === 'enroute') {
    const p = await resolvePickup(b, s);
    if (!p) return;
    const d = haversineMeters(fix, p);
    if (d <= p.radius_m) {
      if (!m.arriveHits) m.arriveFirst = now;
      m.arriveHits++;
      const precise = fix.accuracy != null && fix.accuracy <= 25 && d <= p.radius_m * 0.5;
      if (precise || (m.arriveHits >= 2 && now - m.arriveFirst >= 8000)) {
        await setDriverStatus(b, 'arrived', 'auto');
      }
    } else {
      m.arriveHits = 0;
    }
    return;
  }

  if (b.driver_status === 'arrived' && s.auto_onboard) {
    // A real pickup takes minutes; a false "arrived" from driving past must not turn into
    // "passenger on board".
    if ((num(b.arrived_age_s) ?? 0) < 90) return;
    const p = await resolvePickup(b, s);
    if (!p) return;
    const d = haversineMeters(fix, p);
    if (d > Math.max(400, p.radius_m * 2)) {
      m.leaveHits++;
      if (m.leaveHits >= 2) await setDriverStatus(b, 'onboard', 'auto');
    } else {
      m.leaveHits = 0;
    }
    return;
  }

  if (b.driver_status === 'onboard' && s.auto_finish) {
    const drop = await resolveDropoff(b, s);
    if (!drop) return;
    const d = haversineMeters(fix, drop);
    const slow = fix.speed == null || fix.speed < 3;
    if (d <= drop.radius_m && slow) {
      if (!m.finishHits) m.finishFirst = now;
      m.finishHits++;
      if (m.finishHits >= 2 && now - m.finishFirst >= 20_000) await setDriverStatus(b, 'completed', 'auto');
    } else {
      m.finishHits = 0;
    }
  }
}

// ─── lifecycle ──────────────────────────────────────────────────────────────

const STAGE_COL: Record<Exclude<DriverStatus, 'assigned'>, string> = {
  enroute: 'driver_enroute_at',
  arrived: 'driver_arrived_at',
  onboard: 'driver_onboard_at',
  completed: 'driver_completed_at',
};

export async function setDriverStatus(
  b: any,
  to: DriverStatus,
  actor: 'driver' | 'admin' | 'auto'
): Promise<{ ok: boolean; status?: DriverStatus; error?: string }> {
  if (b.status === 'cancelled') return { ok: false, error: 'Buchung ist storniert' };
  if (!LIFECYCLE.includes(to)) return { ok: false, error: 'Ungültiger Status' };
  const from: DriverStatus = LIFECYCLE.includes(b.driver_status) ? b.driver_status : 'assigned';
  const fi = LIFECYCLE.indexOf(from);
  const ti = LIFECYCLE.indexOf(to);
  if (fi === ti) return { ok: true, status: to };
  if (actor === 'driver' && ti < fi - 1) return { ok: false, error: 'Nur ein Schritt zurück möglich' };

  const sets: string[] = ['driver_status = ?'];
  const params: any[] = [to];
  for (const stage of LIFECYCLE.slice(1) as Exclude<DriverStatus, 'assigned'>[]) {
    const idx = LIFECYCLE.indexOf(stage);
    if (idx === ti && ti > fi) sets.push(`${STAGE_COL[stage]} = NOW()`);
    if (idx > ti) sets.push(`${STAGE_COL[stage]} = NULL`);
  }
  if (to === 'enroute') sets.push('tracking_gps_lost_at = NULL');
  const s = await getTrackingSettings();
  const completesBooking = to === 'completed' && s.complete_booking_on_finish && !b.company_id
    && (b.status === 'new' || b.status === 'confirmed');
  if (completesBooking) sets.push(`status = 'completed'`);
  if (to === 'completed') sets.push('customer_lat = NULL', 'customer_lng = NULL', 'customer_accuracy = NULL');

  params.push(b.id);
  await run(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`, params);
  motion.delete(b.id);
  etaCache.delete(b.id);
  const prevStatus = b.driver_status;
  b.driver_status = to;
  if (completesBooking) b.status = 'completed';

  if (ti > fi && to !== 'assigned') {
    const fresh = await loadBookingById(b.id);
    if (fresh) {
      void onStageReached(fresh, to as AlertKind, actor, prevStatus);
    }
  }
  return { ok: true, status: to };
}

async function onStageReached(b: any, stage: AlertKind, actor: string, prev: string | null): Promise<void> {
  try {
    const s = await getTrackingSettings();
    const detail = actor === 'auto' ? 'automatisch' : actor === 'admin' ? 'durch Admin' : 'durch Fahrer';
    await recordEvent(b, stage, detail);

    if ((stage === 'enroute' || stage === 'arrived') && b.email) {
      const flag = stage === 'enroute' ? 'tracking_mail_enroute_at' : 'tracking_mail_arrived_at';
      const enabled = stage === 'enroute' ? s.mail_enroute : s.mail_arrived;
      // Skipping straight past "enroute" (e.g. the driver taps "arrived" first) sends only
      // the later mail — two mails a second apart would look broken.
      if (enabled && process.env.RESEND_API_KEY && !b[flag] && !(stage === 'enroute' && prev && prev !== 'assigned')) {
        const flight = await flightFor(b);
        const pickup = await resolvePickup(b, s, flight);
        let eta: number | null = null;
        if (stage === 'enroute' && pickup && num(b.driver_lat) != null) {
          eta = await etaMinutes(b.id, { lat: Number(b.driver_lat), lng: Number(b.driver_lng) }, pickup, 'pickup');
        }
        // Claim first (two fixes can reach this concurrently), release if the send fails so
        // the admin panel never shows "customer informed" for a mail that didn't go out.
        const res = await run(`UPDATE bookings SET ${flag} = NOW() WHERE id = ? AND ${flag} IS NULL`, [b.id]);
        if (res.affectedRows === 1) {
          try {
            await sendTrackingCustomerEmail(stage, {
              booking: b,
              trackUrl: customerTrackingUrl(b.booking_number, b.language),
              etaMinutes: eta,
              meetingPoint: pickup?.meeting_point || null,
            });
          } catch (err) {
            await run(`UPDATE bookings SET ${flag} = NULL WHERE id = ?`, [b.id]).catch(() => {});
            throw err;
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[tracking] stage side effects failed:', err?.message);
  }
}

// ─── admin alerts ───────────────────────────────────────────────────────────

let adminMailsThisHour: { hour: number; count: number } = { hour: -1, count: 0 };

export async function recordEvent(b: any, kind: AlertKind, detail?: string): Promise<void> {
  await run(
    `INSERT INTO tracking_events (booking_id, booking_number, driver_id, kind, detail) VALUES (?, ?, ?, ?, ?)`,
    [b.id, b.booking_number, b.assigned_driver_id || null, kind, detail ? String(detail).slice(0, 250) : null]
  );
  const s = await getTrackingSettings();
  if (!s.admin[kind]?.email) return;
  const hour = Math.floor(Date.now() / 3600_000);
  if (adminMailsThisHour.hour !== hour) adminMailsThisHour = { hour, count: 0 };
  if (adminMailsThisHour.count >= 30) return;
  adminMailsThisHour.count++;
  sendTrackingAdminEmail(kind, b, detail || '', s.admin_email_to).catch((e) =>
    console.error('[tracking] admin mail failed:', e?.message));
}

// ─── views ──────────────────────────────────────────────────────────────────

function driverLocation(b: any) {
  const age = num(b.driver_loc_age_s);
  if (!LIVE_STATUSES.includes(b.driver_status) || num(b.driver_lat) == null || age == null || age > 1800) return null;
  return {
    lat: Number(b.driver_lat), lng: Number(b.driver_lng),
    heading: num(b.driver_heading), accuracy: num(b.driver_accuracy), speed: num(b.driver_speed),
    age_s: age, source: b.driver_source || null,
  };
}

function timeline(b: any) {
  return {
    enroute: num(b.enroute_ts), arrived: num(b.arrived_ts), onboard: num(b.onboard_ts), completed: num(b.completed_ts),
  };
}

async function liveEta(b: any, s: TrackingSettings, pickup: ResolvedPickup | null) {
  const loc = driverLocation(b);
  if (!loc) return { eta: null as number | null, target: null as string | null };
  if (b.driver_status === 'enroute' && pickup) {
    return { eta: await etaMinutes(b.id, loc, pickup, 'pickup'), target: 'pickup' };
  }
  if (b.driver_status === 'onboard') {
    const drop = await resolveDropoff(b, s);
    if (drop) return { eta: await etaMinutes(b.id, loc, drop, 'dropoff'), target: 'dropoff' };
  }
  return { eta: null, target: null };
}

function customerLocation(b: any) {
  const age = num(b.customer_loc_age_s);
  if (num(b.customer_lat) == null || age == null || age > 1800) return null;
  return { lat: Number(b.customer_lat), lng: Number(b.customer_lng), accuracy: num(b.customer_accuracy), age_s: age };
}

export async function buildCustomerView(b: any): Promise<any> {
  const s = await getTrackingSettings();
  const phase = trackingPhase(b, s);
  const base: any = {
    phase,
    booking_number: b.booking_number,
    language: b.language === 'en' ? 'en' : 'de',
    pickup_datetime: b.pickup_datetime,
    pickup_address: b.pickup_address,
    dropoff_address: b.dropoff_address,
    passengers: b.passengers,
    company: COMPANY_CONTACT,
  };
  if (phase !== 'active') return base;

  const status = LIFECYCLE.includes(b.driver_status) ? b.driver_status : (b.assigned_driver_id ? 'assigned' : 'scheduled');
  const flight = await flightFor(b);
  const pickup = await resolvePickup(b, s, flight);
  const drop = await resolveDropoff(b, s);
  const dropoff = drop ? { lat: drop.lat, lng: drop.lng } : null;
  const { eta, target } = await liveEta(b, s, pickup);
  const loc = driverLocation(b);
  const showCustomer = status !== 'onboard' && status !== 'completed';

  return {
    ...base,
    status,
    timeline: timeline(b),
    driver: b.assigned_driver_id
      ? { name: b.driver_name, phone: b.driver_phone || null, vehicle_model: b.driver_model || null, vehicle_plate: b.driver_plate || null }
      : null,
    driver_location: loc,
    stale: !!loc && loc.age_s > 90,
    eta_minutes: eta,
    eta_target: target,
    pickup: pickup ? { lat: pickup.lat, lng: pickup.lng } : null,
    dropoff,
    meeting_point: pickup?.meeting_point
      ? { ...pickup.meeting_point, sign_name: b.pickup_sign || b.name || null }
      : null,
    flight: b.flight_number ? { number: b.flight_number, info: b.flight_info || null, live: flight } : null,
    customer_location: showCustomer ? customerLocation(b) : null,
    share_location_enabled: s.share_customer_location && showCustomer,
  };
}

function paymentForDriver(b: any): { kind: string; amount: number } {
  const amount = Number(b.price) || 0;
  if (b.company_id || b.payment_method === 'rechnung' || b.payment_method === 'invoice') return { kind: 'invoice', amount };
  if (b.payment_method === 'card') {
    return { kind: b.charge_status === 'succeeded' || b.stripe_charge_id ? 'paid_card' : 'collect_card', amount };
  }
  if (b.payment_method === 'ueberweisung' || b.payment_method === 'transfer') {
    return { kind: b.ueberweisung_paid_at ? 'paid_transfer' : 'transfer_open', amount };
  }
  return { kind: 'collect_cash', amount };
}

export async function buildDriverRideView(b: any, opts: { live: boolean }): Promise<any> {
  const s = await getTrackingSettings();
  const status = LIFECYCLE.includes(b.driver_status) ? b.driver_status : 'assigned';
  const base: any = {
    id: b.id,
    booking_number: b.booking_number,
    status,
    booking_status: b.status,
    pickup_datetime: b.pickup_datetime,
    pickup_address: b.pickup_address,
    dropoff_address: b.dropoff_address,
    zwischenstopp_address: b.zwischenstopp_address || null,
    customer_name: b.name,
    customer_phone: b.phone || null,
    pickup_sign: b.pickup_sign || null,
    passengers: b.passengers,
    luggage_count: b.luggage_count,
    child_seat: !!Number(b.child_seat),
    child_seat_details: b.child_seat_details || null,
    fahrrad_count: Number(b.fahrrad_count) || 0,
    notes: b.notes || null,
    vehicle_type: b.vehicle_type,
    flight_number: b.flight_number || null,
    flight_info: b.flight_info || null,
    language: b.language || 'de',
    payment: paymentForDriver(b),
    airport_pickup: isAirportAddress(b.pickup_address),
    timeline: timeline(b),
  };
  if (!opts.live) return base;

  const flight = await flightFor(b);
  const pickup = await resolvePickup(b, s, flight);
  const drop = await resolveDropoff(b, s);
  const dropoff = drop ? { lat: drop.lat, lng: drop.lng } : null;
  const { eta, target } = await liveEta(b, s, pickup);
  return {
    ...base,
    pickup: pickup ? { lat: pickup.lat, lng: pickup.lng, radius_m: pickup.radius_m } : null,
    dropoff,
    meeting_point: pickup?.meeting_point || null,
    flight_live: flight,
    driver_location: driverLocation(b),
    eta_minutes: eta,
    eta_target: target,
    customer_location: status === 'onboard' || status === 'completed' ? null : customerLocation(b),
  };
}

export async function buildAdminLive(): Promise<any> {
  const from = berlinNowSql(new Date(Date.now() - 8 * 3600_000));
  const to = berlinNowSql(new Date(Date.now() + 24 * 3600_000));
  const rows = await query<any>(
    `${BOOKING_SELECT}
      WHERE b.assigned_driver_id IS NOT NULL AND b.status <> 'cancelled'
        AND (b.driver_status IN ('enroute','arrived','onboard')
             OR STR_TO_DATE(b.pickup_datetime, '%Y-%m-%dT%H:%i:%s') BETWEEN ? AND ?)
      ORDER BY b.pickup_datetime ASC LIMIT 100`,
    [from, to]
  );
  const s = await getTrackingSettings();
  const rides = [];
  for (const b of rows) {
    const live = LIVE_STATUSES.includes(b.driver_status);
    const pickup = live ? await resolvePickup(b, s) : null;
    const { eta, target } = live ? await liveEta(b, s, pickup) : { eta: null, target: null };
    rides.push({
      id: b.id,
      booking_number: b.booking_number,
      pickup_datetime: b.pickup_datetime,
      pickup_address: b.pickup_address,
      dropoff_address: b.dropoff_address,
      customer_name: b.name,
      status: LIFECYCLE.includes(b.driver_status) ? b.driver_status : 'assigned',
      driver: { id: b.assigned_driver_id, name: b.driver_name, plate: b.driver_plate },
      driver_location: driverLocation(b),
      gps_lost: !!b.tracking_gps_lost_at,
      eta_minutes: eta,
      eta_target: target,
      pickup: pickup ? { lat: pickup.lat, lng: pickup.lng } : (num(b.pickup_lat) != null ? { lat: Number(b.pickup_lat), lng: Number(b.pickup_lng) } : null),
      timeline: timeline(b),
    });
  }
  return { rides };
}

// ─── jobs ───────────────────────────────────────────────────────────────────

async function gpsWatch(): Promise<void> {
  const s = await getTrackingSettings();
  if (!s.enabled) return;
  const lost = await query<any>(
    `${BOOKING_SELECT}
      WHERE b.driver_status IN ('enroute','onboard') AND b.status <> 'cancelled' AND b.tracking_gps_lost_at IS NULL
        AND COALESCE(b.driver_location_updated_at, b.driver_onboard_at, b.driver_enroute_at) < NOW() - INTERVAL ${Math.max(1, Math.round(s.gps_lost_minutes))} MINUTE
      LIMIT 20`
  );
  for (const b of lost) {
    const res = await run('UPDATE bookings SET tracking_gps_lost_at = NOW() WHERE id = ? AND tracking_gps_lost_at IS NULL', [b.id]);
    if (res.affectedRows !== 1) continue;
    const age = num(b.driver_loc_age_s);
    await recordEvent(b, 'gps_lost', age != null ? `Letztes Signal vor ${Math.round(age / 60)} Min.` : 'Noch kein GPS-Signal');
  }

  // Rides a driver forgot to finish: close them 12 h after pickup so the customer link
  // and the driver's "active ride" don't stay open forever. No mails for this.
  const cutoff = berlinNowSql(new Date(Date.now() - 12 * 3600_000));
  await run(
    `UPDATE bookings SET driver_status = 'completed', driver_completed_at = NOW()
      WHERE driver_status IN ('enroute','arrived','onboard')
        AND STR_TO_DATE(pickup_datetime, '%Y-%m-%dT%H:%i:%s') < ?`,
    [cutoff]
  );
}

// Positions are personal data (driver and customer): drop them once the ride is done.
async function purge(): Promise<void> {
  const s = await getTrackingSettings();
  const hours = Math.max(1, Math.round(s.retention_hours));
  const pickupCutoff = berlinNowSql(new Date(Date.now() - (hours + 24) * 3600_000));
  await run(
    `UPDATE bookings SET driver_lat = NULL, driver_lng = NULL, driver_accuracy = NULL, driver_heading = NULL,
        driver_speed = NULL, customer_lat = NULL, customer_lng = NULL, customer_accuracy = NULL,
        customer_location_updated_at = NULL
      WHERE (driver_lat IS NOT NULL OR customer_lat IS NOT NULL)
        AND ((driver_status = 'completed' AND driver_completed_at < NOW() - INTERVAL ${hours} HOUR)
             OR STR_TO_DATE(pickup_datetime, '%Y-%m-%dT%H:%i:%s') < ?)`,
    [pickupCutoff]
  );
  await run(
    `UPDATE drivers SET last_lat = NULL, last_lng = NULL, last_accuracy = NULL, last_heading = NULL
      WHERE last_lat IS NOT NULL AND last_fix_at < NOW() - INTERVAL 12 HOUR`
  );
  await run(`DELETE FROM tracking_events WHERE created_at < NOW() - INTERVAL 30 DAY`);
}

let started = false;
export function startDriverTrackingJobs(): void {
  if (started) return;
  started = true;
  let busy = false;
  cron.schedule('* * * * *', async () => {
    if (busy) return;
    busy = true;
    try { await gpsWatch(); } catch (e: any) { console.error('[tracking] gps watch:', e?.message); }
    finally { busy = false; }
  });
  cron.schedule('17 * * * *', async () => {
    try { await purge(); } catch (e: any) { console.error('[tracking] purge:', e?.message); }
  });
  console.log('[tracking] jobs started (GPS watch every minute, retention purge hourly)');
}
