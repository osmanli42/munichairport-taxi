// AeroDataBox (RapidAPI) monthly quota, shared by the booking page check (routes/flights.ts)
// and the live status of the dashboard / driver tracking (services/flightStatus.ts).
// Every response carries the real quota in its headers; we keep the last values, so admin
// sees what is left and live lookups stop early enough to leave units for customers.

import { query } from '../db';

export type FlightApiUser = 'customer' | 'live';

const STATE_KEY = 'flight_quota_state';
export const FLIGHT_QUOTA_CUSTOMER_RESERVE = 150; // units only the booking page may use
export const FLIGHT_QUOTA_ALERT_BELOW = 100;      // Handlungsbedarf below this
const EXHAUSTED_PROBE_MS = 3600_000;              // retry hourly, so a plan upgrade takes effect by itself

export interface FlightQuotaState {
  limit: number;
  remaining: number;
  resetAt: string;  // ISO
  at: string;       // ISO, last response
  calls: Record<FlightApiUser, number>; // since the last reset
}

let state: FlightQuotaState | null = null;
let loaded = false;

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const [row] = await query<{ setting_value: string }>('SELECT setting_value FROM settings WHERE setting_key = ?', [STATE_KEY]);
    if (row?.setting_value) state = JSON.parse(row.setting_value);
  } catch { /* first use or table not ready: start without a known state */ }
}

/** Current quota; null until the first API response. Past the reset date the old numbers no longer apply. */
export async function flightQuota(): Promise<FlightQuotaState | null> {
  await load();
  if (state && Date.parse(state.resetAt) <= Date.now()) state = null;
  return state;
}

export async function flightApiAllowed(user: FlightApiUser): Promise<boolean> {
  const q = await flightQuota();
  if (!q) return true;
  if (q.remaining <= 0) return Date.now() - Date.parse(q.at) > EXHAUSTED_PROBE_MS;
  return user === 'customer' || q.remaining > FLIGHT_QUOTA_CUSTOMER_RESERVE;
}

export async function recordFlightApiResponse(res: Response, user: FlightApiUser): Promise<void> {
  const num = (h: string) => {
    const v = res.headers.get(h);
    return v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v);
  };
  const limit = num('x-ratelimit-api-units-limit');
  const remaining = num('x-ratelimit-api-units-remaining');
  const resetIn = num('x-ratelimit-api-units-reset');
  if (limit == null || remaining == null || resetIn == null) return;
  const prev = await flightQuota();
  const resetAt = new Date(Date.now() + resetIn * 1000).toISOString();
  const calls = { customer: prev?.calls?.customer || 0, live: prev?.calls?.live || 0 };
  calls[user]++;
  state = { limit, remaining, resetAt, at: new Date().toISOString(), calls };
  query(
    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [STATE_KEY, JSON.stringify(state)],
  ).catch(() => {});
}

/** Dashboard „Handlungsbedarf“: quota nearly used up. */
export async function flightQuotaReminder(): Promise<(FlightQuotaState & { dismiss_key: string }) | null> {
  const [s] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = 'flight_quota_alert_enabled'`);
  if (s?.setting_value === '0') return null;
  const q = await flightQuota();
  if (!q || q.remaining >= FLIGHT_QUOTA_ALERT_BELOW) return null;
  return { ...q, dismiss_key: `flightQuota:${q.resetAt.slice(0, 10)}` };
}
