// Automatische Rabatte (Rabatte-Tab): kural bazlı, kod gerektirmeyen indirim motoru.
// Hem POST /api/bookings (kesin fiyat) hem POST /calculate-price (önizleme) kullanır.
import { query } from '../db';

export interface AutoDiscountRule {
  id: number;
  name: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  zone_scope: 'inside' | 'outside' | 'any';
  min_km: number | null;
  max_km: number | null;
  trip_time_from: number | null; // Fahrtzeit, Minute des Tages 0–1439
  trip_time_to: number | null;
  booking_time_from: number | null; // Buchungszeit (deutsche Zeit), Minute des Tages 0–1439
  booking_time_to: number | null;
  label_de: string | null;
  label_en: string | null;
  label_tr: string | null;
  show_in_banner: number;
  show_countdown: number;
  weekday_mask: string | null; // '1,2,3' — 1=Montag … 7=Sonntag (ISO)
  booking_index_max: number | null;
  daily_max_uses: number | null;
  max_uses: number | null;
  used_count: number;
  max_discount_amount: number | null;
  vehicle_types: string | null; // '1,2,3'
  trip_types: string | null; // 'oneway,roundtrip'
  start_date: string | null; // Fahrtdatum von
  end_date: string | null; // Fahrtdatum bis
  booking_start_date: string | null; // Buchungsdatum von
  booking_end_date: string | null; // Buchungsdatum bis
  active: number;
  priority: number;
  stackable_with_promo: number;
}

export interface AutoDiscountInput {
  km: number;
  zone: 'inside' | 'outside';
  vehicleType: string | null;
  isRoundtrip: boolean;
  pickupRaw: string | null; // transfer zamanı "YYYY-MM-DDTHH:MM" (Berlin, rezervasyon anı değil)
  customerBookingCount: number | null; // null = bilinmiyor (önizleme) → booking_index koşulu geçer sayılır
  baseTotal: number;
}

export interface AutoDiscountResult {
  rule: AutoDiscountRule;
  amount: number;
  endsAt: string | null; // UTC ISO — echtes Ende des Buchungsfensters, sonst null
}

let cache: { rules: AutoDiscountRule[]; enabled: boolean; loadedAt: number } | null = null;
const CACHE_MS = 30_000;

async function loadRules(): Promise<{ rules: AutoDiscountRule[]; enabled: boolean }> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) return cache;
  const settingRows = await query<{ setting_value: string }>(
    `SELECT setting_value FROM settings WHERE setting_key = 'auto_discounts_enabled'`
  );
  const enabled = (settingRows[0]?.setting_value ?? '1') === '1';
  const rules = enabled
    ? await query<AutoDiscountRule>(`SELECT * FROM auto_discounts WHERE active = 1`)
    : [];
  cache = { rules, enabled, loadedAt: Date.now() };
  return cache;
}

export function invalidateAutoDiscountCache(): void {
  cache = null;
}

const TZ = 'Europe/Berlin';

interface LocalParts {
  dateStr: string; // YYYY-MM-DD
  minutes: number; // 0–1439
  isoWeekday: number; // 1=Mo … 7=So
}

// Server läuft in UTC — alle Kalender-/Uhrzeitvergleiche müssen in deutscher Zeit passieren.
function berlinParts(d: Date): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map(p => [p.type, p.value])
  );
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    dateStr,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    isoWeekday: isoWeekdayOf(dateStr),
  };
}

function isoWeekdayOf(dateStr: string): number {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

// Fahrtzeit kommt als naive deutsche Zeit "YYYY-MM-DDTHH:MM" — direkt aus dem String lesen,
// nicht über new Date() (auf dem UTC-Server wäre das nur zufällig richtig). Mit Zeitzone
// (Z/±hh:mm) wird sie nach Berlin umgerechnet.
export function pickupParts(raw: string | null | undefined): LocalParts | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const naive = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (naive) {
    return { dateStr: naive[1], minutes: Number(naive[2]) * 60 + Number(naive[3]), isoWeekday: isoWeekdayOf(naive[1]) };
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : berlinParts(d);
}

// Minutenfenster [from, to): from === to → ganzer Tag; from > to → über Mitternacht (22:00–06:00).
function windowMatches(from: number | null, to: number | null, minutes: number | null): boolean {
  if (from == null || to == null) return true;
  if (minutes == null) return false;
  const f = Number(from);
  const t = Number(to);
  if (f === t) return true;
  if (f < t) return minutes >= f && minutes < t;
  return minutes >= f || minutes < t;
}

function weekdayMatches(rule: AutoDiscountRule, trip: LocalParts | null): boolean {
  if (!rule.weekday_mask) return true;
  if (!trip) return false;
  return rule.weekday_mask.split(',').map(s => parseInt(s.trim(), 10)).includes(trip.isoWeekday);
}

// UTC-Zeitpunkt für eine deutsche Wandzeit (dateStr + Minute). Offset wird zweimal
// bestimmt, damit Tage der Sommer-/Winterzeitumstellung korrekt bleiben.
function berlinWallToUtc(dateStr: string, minutes: number): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const offsetAt = (ms: number) => {
    const p = berlinParts(new Date(ms));
    const [py, pm, pd] = p.dateStr.split('-').map(Number);
    return Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60) - ms;
  };
  let ms = guess - offsetAt(guess);
  ms = guess - offsetAt(ms);
  return new Date(ms);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Countdown nur für echte Buchungs-Deadlines: Ende des Buchungsdatums bzw. Ende des
// aktuellen Buchungszeit-Fensters. Fahrtdatum/-zeit sind keine Deadline zum Buchen.
export function computeEndsAt(rule: AutoDiscountRule, now: Date = new Date()): string | null {
  const nowP = berlinParts(now);
  const candidates: number[] = [];
  const be = toDateOnlyStr(rule.booking_end_date);
  if (be) candidates.push(berlinWallToUtc(addDays(be, 1), 0).getTime());
  const f = rule.booking_time_from;
  const t = rule.booking_time_to;
  if (f != null && t != null && Number(f) !== Number(t)) {
    const to = Number(t);
    // Über Mitternacht und aktuell im Abendteil → Ende ist morgen früh.
    const endDate = Number(f) > to && nowP.minutes >= Number(f) ? addDays(nowP.dateStr, 1) : nowP.dateStr;
    candidates.push(berlinWallToUtc(endDate, to).getTime());
  }
  const future = candidates.filter(ms => ms > now.getTime());
  return future.length ? new Date(Math.min(...future)).toISOString() : null;
}

function listMatches(list: string | null, value: number | string | null): boolean {
  if (!list) return true;
  if (value == null) return true;
  return list.split(',').map(s => s.trim()).includes(String(value));
}

// DB'den gelen DATE kolonları mysql2 tarafından JS Date nesnesi olarak dönebilir —
// Date.toString() ISO değildir ("Fri Jul 31 2026 …"), String(v).slice(0,10) o zaman
// çöp üretip karşılaştırmayı hep yanlış sonuçlandırır. Hem Date hem string/ISO girdiyi
// güvenle "YYYY-MM-DD"ye çevirir.
function toDateOnlyStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

// Tägliches Kontingent — läuft immer gegen den heutigen Kalendertag, braucht also
// keinen manuellen Reset-Knopf: um 00:00 zählt "heute" automatisch neu ab null.
async function getDailyUsageCounts(ruleIds: number[]): Promise<Record<number, number>> {
  if (ruleIds.length === 0) return {};
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const rows = await query<{ auto_discount_id: number; cnt: number }>(
    `SELECT auto_discount_id, COUNT(*) as cnt FROM bookings
     WHERE auto_discount_id IN (${ruleIds.map(() => '?').join(',')})
       AND status != 'cancelled'
       AND created_at >= ? AND created_at < ?
     GROUP BY auto_discount_id`,
    [...ruleIds, startOfDay, startOfTomorrow]
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[Number(r.auto_discount_id)] = Number(r.cnt);
  return map;
}

export async function resolveAutoDiscount(input: AutoDiscountInput): Promise<AutoDiscountResult | null> {
  const { rules, enabled } = await loadRules();
  if (!enabled || rules.length === 0 || input.baseTotal <= 0) return null;

  const dailyCapRuleIds = rules.filter(r => r.daily_max_uses != null).map(r => r.id);
  const dailyUsage = await getDailyUsageCounts(dailyCapRuleIds);

  // Tarih aralığı, rezervasyonun YAPILDIĞI güne değil, YOLCULUĞUN gerçekleşeceği güne
  // (pickupDateTime) göre kontrol edilir — "30.07'de az sipariş var, o güne indirim"
  // gibi kurallar ancak böyle çalışır. pickupDateTime yoksa (olmamalı, zorunlu alan)
  // tarihli bir kural güvenli tarafta kalıp eşleşmez.
  // Lokale Datumsteile (nicht toISOString/UTC) — konsistent mit hourMatches/weekdayMatches,
  // die ebenfalls getHours()/getDay() (lokale Serverzeit) verwenden.
  // Fahrt- und Buchungszeit immer in deutscher Zeit (Server = UTC).
  const trip = pickupParts(input.pickupRaw);
  const tripDateStr = trip?.dateStr ?? null;
  // Buchungsdatum/-zeit — der Moment, in dem JETZT gebucht wird (unabhängig von der Fahrt).
  // Beide Bereiche sind unabhängig voneinander nutzbar (auch gleichzeitig).
  const now = new Date();
  const booking = berlinParts(now);

  const matching = rules.filter(r => {
    if (r.zone_scope !== 'any' && r.zone_scope !== input.zone) return false;
    if (r.min_km != null && input.km < Number(r.min_km)) return false;
    if (r.max_km != null && input.km > Number(r.max_km)) return false;
    if (!windowMatches(r.trip_time_from, r.trip_time_to, trip?.minutes ?? null)) return false;
    if (!weekdayMatches(r, trip)) return false;
    if (r.booking_index_max != null && input.customerBookingCount != null
        && input.customerBookingCount >= Number(r.booking_index_max)) return false;
    if (!vehicleIndependentMatches(r, booking, dailyUsage)) return false;
    if (!listMatches(r.vehicle_types, input.vehicleType)) return false;
    if (r.trip_types && !r.trip_types.split(',').map(s => s.trim())
        .includes(input.isRoundtrip ? 'roundtrip' : 'oneway')) return false;
    if (r.start_date || r.end_date) {
      if (!tripDateStr) return false;
      const s = toDateOnlyStr(r.start_date);
      const e = toDateOnlyStr(r.end_date);
      if (s && s > tripDateStr) return false;
      if (e && e < tripDateStr) return false;
    }
    return true;
  });

  if (matching.length === 0) return null;

  // Tek kural uygulanır: en yüksek priority, eşitse en yüksek indirim tutarı (€ karşılığı).
  const amountFor = (r: AutoDiscountRule) =>
    r.discount_type === 'fixed' ? Number(r.discount_value) : input.baseTotal * (Number(r.discount_value) / 100);
  matching.sort((a, b) =>
    (Number(b.priority) - Number(a.priority)) || (amountFor(b) - amountFor(a))
  );
  const rule = matching[0];

  let amount = amountFor(rule);
  amount = Math.min(amount, input.baseTotal); // Rabatt kann den Fahrpreis nicht überschreiten
  if (rule.max_discount_amount != null) {
    amount = Math.min(amount, Number(rule.max_discount_amount));
  }
  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) return null;

  return { rule, amount, endsAt: computeEndsAt(rule, now) };
}

// Bedingungen, die nur vom Buchungsmoment abhängen (nicht von Route/Fahrzeug/Kunde) —
// gemeinsam genutzt von der Preisberechnung und dem Startseiten-Banner.
function vehicleIndependentMatches(r: AutoDiscountRule, booking: LocalParts, dailyUsage: Record<number, number>): boolean {
  if (r.max_uses != null && r.used_count >= Number(r.max_uses)) return false;
  if (r.daily_max_uses != null && (dailyUsage[r.id] || 0) >= Number(r.daily_max_uses)) return false;
  if (!windowMatches(r.booking_time_from, r.booking_time_to, booking.minutes)) return false;
  const bs = toDateOnlyStr(r.booking_start_date);
  const be = toDateOnlyStr(r.booking_end_date);
  if (bs && bs > booking.dateStr) return false;
  if (be && be < booking.dateStr) return false;
  return true;
}

export function ruleLabels(r: AutoDiscountRule): { de: string; en: string; tr: string } {
  const pick = (v: string | null) => (v && v.trim() ? v.trim() : r.name);
  return { de: pick(r.label_de), en: pick(r.label_en), tr: pick(r.label_tr) };
}

// Startseiten-Banner: aktive Regel mit show_in_banner, die JETZT buchbar ist. Route-abhängige
// Bedingungen (km, Zone, Fahrzeug, Fahrtdatum) prüft erst die Preisberechnung.
export async function resolveBannerDiscount(): Promise<AutoDiscountResult | null> {
  const { rules, enabled } = await loadRules();
  if (!enabled) return null;
  const candidates = rules.filter(r => Number(r.show_in_banner) === 1);
  if (candidates.length === 0) return null;
  const now = new Date();
  const booking = berlinParts(now);
  const dailyUsage = await getDailyUsageCounts(candidates.filter(r => r.daily_max_uses != null).map(r => r.id));
  const matching = candidates.filter(r => {
    if (!vehicleIndependentMatches(r, booking, dailyUsage)) return false;
    // Fahrtdatum komplett in der Vergangenheit → Aktion ist vorbei.
    const e = toDateOnlyStr(r.end_date);
    if (e && e < booking.dateStr) return false;
    return true;
  });
  if (matching.length === 0) return null;
  matching.sort((a, b) =>
    (Number(b.priority) - Number(a.priority)) || (Number(b.discount_value) - Number(a.discount_value))
  );
  const rule = matching[0];
  return { rule, amount: 0, endsAt: computeEndsAt(rule, now) };
}

// Müşterinin (iptal hariç) önceki rezervasyon sayısı — "ilk N rezervasyon" koşulu için.
export async function countCustomerBookings(params: {
  visitorId?: string | null;
  phoneE164?: string | null;
  email?: string | null;
}): Promise<number> {
  const conds: string[] = [];
  const args: any[] = [];
  if (params.visitorId) { conds.push('visitor_id = ?'); args.push(params.visitorId); }
  if (params.phoneE164) { conds.push('phone_e164 = ?'); args.push(params.phoneE164); }
  if (params.email) { conds.push('email = ?'); args.push(params.email); }
  if (conds.length === 0) return 0;
  const rows = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM bookings WHERE (${conds.join(' OR ')}) AND status != 'cancelled'`,
    args
  );
  return Number(rows[0]?.cnt || 0);
}
