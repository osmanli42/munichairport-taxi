// Shared switchboard for the server's own alert e-mails (health monitor, system/PM2,
// conversion alerts, ads alerts, daily summary).
//
// Before this, every cooldown and "already sent today" flag lived in process memory, so
// each deploy/restart (several a day) reset them and the same alerts went out again —
// ~130 noise mails a week. Config and state are now in MySQL:
//   alert_config  one row, JSON — what the admin switched on/off in the System tab
//   alert_state   key → timestamp/value — cooldowns, the daily-summary day, open incidents

import { query, run } from '../db';

export type AlertCategory = 'site_down' | 'site_recovered' | 'server' | 'pm2' | 'business' | 'ads' | 'daily_summary' | 'card_charge';
export const ALERT_CATEGORIES: AlertCategory[] = ['site_down', 'site_recovered', 'server', 'pm2', 'business', 'ads', 'daily_summary', 'card_charge'];

export interface AlertConfig {
  enabled: boolean;
  categories: Record<AlertCategory, boolean>;
  down_after_minutes: number;       // a site/API check must fail this long before a mail
  reminder_hours: number;           // "still down" reminder for an open incident
  server_cooldown_hours: number;    // RAM / swap / disk / CPU
  business_cooldown_hours: number;  // error spike, no bookings, slow page, PM2
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  categories: {
    site_down: true,
    site_recovered: true,
    server: true,
    pm2: true,
    business: true,
    ads: true,
    daily_summary: true,
    card_charge: true,
  },
  down_after_minutes: 6,
  reminder_hours: 12,
  server_cooldown_hours: 24,
  business_cooldown_hours: 6,
};

let cache: { cfg: AlertConfig; at: number } | null = null;

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function merge(raw: any): AlertConfig {
  const d = DEFAULT_ALERT_CONFIG;
  const categories = { ...d.categories };
  for (const c of ALERT_CATEGORIES) {
    if (typeof raw?.categories?.[c] === 'boolean') categories[c] = raw.categories[c];
  }
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : d.enabled,
    categories,
    down_after_minutes: clamp(raw?.down_after_minutes, 2, 60, d.down_after_minutes),
    reminder_hours: clamp(raw?.reminder_hours, 1, 168, d.reminder_hours),
    server_cooldown_hours: clamp(raw?.server_cooldown_hours, 1, 168, d.server_cooldown_hours),
    business_cooldown_hours: clamp(raw?.business_cooldown_hours, 1, 168, d.business_cooldown_hours),
  };
}

export async function getAlertConfig(): Promise<AlertConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.cfg;
  let raw: any = null;
  try {
    const [row] = await query<{ config_json: string }>('SELECT config_json FROM alert_config WHERE id = 1');
    raw = row ? JSON.parse(row.config_json) : null;
  } catch { raw = null; }
  const cfg = merge(raw);
  cache = { cfg, at: Date.now() };
  return cfg;
}

export async function saveAlertConfig(patch: any): Promise<AlertConfig> {
  const cur = await getAlertConfig();
  const next = merge({ ...cur, ...patch, categories: { ...cur.categories, ...(patch?.categories || {}) } });
  const json = JSON.stringify(next);
  await run('INSERT INTO alert_config (id, config_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE config_json = ?', [json, json]);
  cache = { cfg: next, at: Date.now() };
  return next;
}

export async function categoryEnabled(c: AlertCategory): Promise<boolean> {
  const cfg = await getAlertConfig();
  return cfg.enabled && cfg.categories[c];
}

// Atomically claim the right to send `key` now: true at most once per cooldown window,
// across restarts and across concurrent callers. Two steps on purpose: mysql2 connects
// with FOUND_ROWS, which makes an ON DUPLICATE KEY UPDATE report 1 both for "inserted"
// and "left unchanged". A conditional UPDATE's matched-row count is unambiguous.
export async function claimCooldown(key: string, cooldownSeconds: number): Promise<boolean> {
  await run(
    `INSERT IGNORE INTO alert_state (state_key, state_value, updated_at) VALUES (?, '', '2000-01-01 00:00:00')`,
    [key]
  );
  const r = await run(
    `UPDATE alert_state SET updated_at = NOW()
      WHERE state_key = ? AND updated_at <= NOW() - INTERVAL ? SECOND`,
    [key, Math.max(0, Math.round(cooldownSeconds))]
  );
  return r.affectedRows === 1;
}

export async function resetCooldown(key: string): Promise<void> {
  await run('DELETE FROM alert_state WHERE state_key = ?', [key]);
}

// Category switch + persisted cooldown in one call — what every alert site uses.
export async function shouldSendAlert(category: AlertCategory, key: string, cooldownHours?: number): Promise<boolean> {
  const cfg = await getAlertConfig();
  if (!cfg.enabled || !cfg.categories[category]) return false;
  const hours = cooldownHours
    ?? (category === 'server' ? cfg.server_cooldown_hours : cfg.business_cooldown_hours);
  return claimCooldown(`cooldown:${key}`, hours * 3600);
}

export async function getStateValue(key: string): Promise<string | null> {
  const [row] = await query<{ state_value: string }>('SELECT state_value FROM alert_state WHERE state_key = ?', [key]);
  return row ? row.state_value : null;
}

export async function setStateValue(key: string, value: string): Promise<void> {
  await run(
    `INSERT INTO alert_state (state_key, state_value, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE state_value = ?, updated_at = NOW()`,
    [key, value, value]
  );
}

// Seconds until each cooldown expires — shown in the System tab.
export async function listCooldowns(): Promise<Record<string, number>> {
  const cfg = await getAlertConfig();
  const rows = await query<{ state_key: string; age: number }>(
    `SELECT state_key, TIMESTAMPDIFF(SECOND, updated_at, NOW()) AS age FROM alert_state WHERE state_key LIKE 'cooldown:%'`
  );
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.state_key.slice('cooldown:'.length);
    const hours = /^(ram|swap|disk|cpu)$/.test(key) ? cfg.server_cooldown_hours : cfg.business_cooldown_hours;
    const left = hours * 3600 - Number(r.age);
    if (left > 0) out[key] = left;
  }
  return out;
}
