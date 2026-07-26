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
  hour_from: number | null;
  hour_to: number | null;
  weekday_mask: string | null; // '1,2,3' — 1=Montag … 7=Sonntag (ISO)
  booking_index_max: number | null;
  max_uses: number | null;
  used_count: number;
  max_discount_amount: number | null;
  vehicle_types: string | null; // '1,2,3'
  trip_types: string | null; // 'oneway,roundtrip'
  start_date: string | null;
  end_date: string | null;
  active: number;
  priority: number;
  stackable_with_promo: number;
}

export interface AutoDiscountInput {
  km: number;
  zone: 'inside' | 'outside';
  vehicleType: string | null;
  isRoundtrip: boolean;
  pickupDateTime: Date | null; // transfer zamanı (rezervasyon anı değil)
  customerBookingCount: number | null; // null = bilinmiyor (önizleme) → booking_index koşulu geçer sayılır
  baseTotal: number;
}

export interface AutoDiscountResult {
  rule: AutoDiscountRule;
  amount: number;
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

function hourMatches(rule: AutoDiscountRule, dt: Date | null): boolean {
  if (rule.hour_from == null || rule.hour_to == null) return true;
  if (!dt) return false;
  const h = dt.getHours();
  const from = Number(rule.hour_from);
  const to = Number(rule.hour_to);
  if (from === to) return true; // 24 saat
  if (from < to) return h >= from && h < to;
  return h >= from || h < to; // gece aşan aralık, örn. 22→06
}

function weekdayMatches(rule: AutoDiscountRule, dt: Date | null): boolean {
  if (!rule.weekday_mask) return true;
  if (!dt) return false;
  const iso = dt.getDay() === 0 ? 7 : dt.getDay(); // 1=Mo … 7=So
  return rule.weekday_mask.split(',').map(s => parseInt(s.trim(), 10)).includes(iso);
}

function listMatches(list: string | null, value: number | string | null): boolean {
  if (!list) return true;
  if (value == null) return true;
  return list.split(',').map(s => s.trim()).includes(String(value));
}

export async function resolveAutoDiscount(input: AutoDiscountInput): Promise<AutoDiscountResult | null> {
  const { rules, enabled } = await loadRules();
  if (!enabled || rules.length === 0 || input.baseTotal <= 0) return null;

  // Tarih aralığı, rezervasyonun YAPILDIĞI güne değil, YOLCULUĞUN gerçekleşeceği güne
  // (pickupDateTime) göre kontrol edilir — "30.07'de az sipariş var, o güne indirim"
  // gibi kurallar ancak böyle çalışır. pickupDateTime yoksa (olmamalı, zorunlu alan)
  // tarihli bir kural güvenli tarafta kalıp eşleşmez.
  // Lokale Datumsteile (nicht toISOString/UTC) — konsistent mit hourMatches/weekdayMatches,
  // die ebenfalls getHours()/getDay() (lokale Serverzeit) verwenden.
  const tripDateStr = input.pickupDateTime
    ? `${input.pickupDateTime.getFullYear()}-${String(input.pickupDateTime.getMonth() + 1).padStart(2, '0')}-${String(input.pickupDateTime.getDate()).padStart(2, '0')}`
    : null;

  const matching = rules.filter(r => {
    if (r.zone_scope !== 'any' && r.zone_scope !== input.zone) return false;
    if (r.min_km != null && input.km < Number(r.min_km)) return false;
    if (r.max_km != null && input.km > Number(r.max_km)) return false;
    if (!hourMatches(r, input.pickupDateTime)) return false;
    if (!weekdayMatches(r, input.pickupDateTime)) return false;
    if (r.booking_index_max != null && input.customerBookingCount != null
        && input.customerBookingCount >= Number(r.booking_index_max)) return false;
    if (r.max_uses != null && r.used_count >= Number(r.max_uses)) return false;
    if (!listMatches(r.vehicle_types, input.vehicleType)) return false;
    if (r.trip_types && !r.trip_types.split(',').map(s => s.trim())
        .includes(input.isRoundtrip ? 'roundtrip' : 'oneway')) return false;
    if (r.start_date || r.end_date) {
      if (!tripDateStr) return false;
      if (r.start_date && String(r.start_date).slice(0, 10) > tripDateStr) return false;
      if (r.end_date && String(r.end_date).slice(0, 10) < tripDateStr) return false;
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

  return { rule, amount };
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
