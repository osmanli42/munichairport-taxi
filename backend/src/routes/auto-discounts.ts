import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin } from '../middleware/auth';
import { invalidateAutoDiscountCache, resolveBannerDiscount, ruleLabels, windowMatches } from '../services/autoDiscount';
import { visitorDistanceToBase } from '../services/visitorDistance';
import { demandSettings, getDayPace, invalidateDemandCache, rideMinutesOn, ridesNear } from '../services/demandPace';
import { loadCostSettings } from '../services/netEarnings';
import { vacanciesAround, DEFAULT_LEER_END_KM, parsePlzList } from '../services/leerfahrt';
import { searchStats } from '../services/searchDemand';
import { invalidateAutopilotSettings } from '../services/rabattAutopilot';
import { berlinDateSql, berlinNowSql } from '../utils/berlinTime';

const router = Router();

function parseRuleBody(body: any): { error?: string; values?: any[] } {
  const {
    name, discount_type, discount_value, zone_scope, min_km, max_km,
    trip_time_from, trip_time_to, booking_time_from, booking_time_to,
    weekday_mask, booking_index_max, daily_max_uses, max_uses, max_discount_amount,
    vehicle_types, trip_types, start_date, end_date, booking_start_date, booking_end_date,
    priority, stackable_with_promo, label_de, label_en, label_tr, show_in_banner, show_countdown, show_remaining,
    price_basis, visitor_min_km, visitor_max_km, visitor_unknown_ok, visit_min, allow_fixed_routes,
    demand_pace_max, trip_date_max_uses, ip_bypass_mode, roundtrip_value, exclude_business, max_days_ahead,
    gap_window_minutes, gap_max_rides, leer_radius_km, leer_after_min, leer_before_min, leer_area, leer_end_km, leer_exclude_plz,
  } = body;

  if (!name || String(name).trim().length === 0) return { error: 'name erforderlich' };
  if (visit_min !== undefined && visit_min !== null && visit_min !== '') {
    const v = Number(visit_min);
    if (!Number.isFinite(v) || v < 2 || v > 20) {
      return { error: 'Besuch-Nr. muss zwischen 2 und 20 liegen (1 wäre jeder Erstbesucher)' };
    }
  }
  if (!['percent', 'fixed'].includes(discount_type)) return { error: 'discount_type muss "percent" oder "fixed" sein' };
  const val = parseFloat(discount_value);
  if (isNaN(val) || val <= 0) return { error: 'discount_value muss größer als 0 sein' };
  if (discount_type === 'percent' && val > 100) return { error: 'discount_value (percent) darf maximal 100 sein' };
  if (!['inside', 'outside', 'any'].includes(zone_scope)) return { error: 'zone_scope ungültig' };
  const isEmpty = (v: any) => v === null || v === undefined || v === '';
  const minuteOk = (m: any) => isEmpty(m) || (Number.isInteger(Number(m)) && Number(m) >= 0 && Number(m) <= 1439);
  if (![trip_time_from, trip_time_to, booking_time_from, booking_time_to].every(minuteOk)) {
    return { error: 'Uhrzeiten müssen zwischen 00:00 und 23:59 liegen' };
  }
  if (isEmpty(trip_time_from) !== isEmpty(trip_time_to)) return { error: 'Fahrtzeit: bitte "von" und "bis" setzen' };
  if (isEmpty(booking_time_from) !== isEmpty(booking_time_to)) return { error: 'Buchungszeit: bitte "von" und "bis" setzen' };
  if (!isEmpty(price_basis) && !['any', 'pflichttarif', 'normal'].includes(String(price_basis))) {
    return { error: 'price_basis ungültig' };
  }
  const kmOk = (v: any) => isEmpty(v) || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0);
  if (!kmOk(visitor_min_km) || !kmOk(visitor_max_km)) return { error: 'Besucher-Entfernung muss eine positive Zahl sein' };
  if (!isEmpty(demand_pace_max)) {
    const p = Number(demand_pace_max);
    if (!Number.isFinite(p) || p <= 0 || p > 1.5) return { error: 'Ruhiger Tag: Schwelle muss zwischen 1 und 150 % liegen' };
  }
  if (!isEmpty(max_days_ahead) && (!Number.isInteger(Number(max_days_ahead)) || Number(max_days_ahead) < 0 || Number(max_days_ahead) > 365)) {
    return { error: 'En fazla kaç gün sonrası: 0–365 arası tam sayı olmalı' };
  }
  if (!isEmpty(gap_window_minutes)) {
    const w = Number(gap_window_minutes);
    if (!Number.isInteger(w) || w < 15 || w > 360) return { error: 'Boş saat: pencere 15–360 dakika olmalı' };
    const m = isEmpty(gap_max_rides) ? 0 : Number(gap_max_rides);
    if (!Number.isInteger(m) || m < 0 || m > 10) return { error: 'Boş saat: penceredeki en fazla fahrt 0–10 olmalı' };
  }
  if (!isEmpty(leer_radius_km)) {
    const r = Number(leer_radius_km);
    const a = isEmpty(leer_after_min) ? 45 : Number(leer_after_min);
    const b = isEmpty(leer_before_min) ? 120 : Number(leer_before_min);
    if (!Number.isFinite(r) || r < 1 || r > 100) return { error: 'Leerfahrt: mesafe 1–100 km olmalı' };
    if (!isEmpty(leer_end_km) && (!Number.isFinite(Number(leer_end_km)) || Number(leer_end_km) < 0 || Number(leer_end_km) > 60)) {
      return { error: 'Leerfahrt: varış bölgesi Marienplatz\'a 0–60 km olmalı' };
    }
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > 600 || a >= b) {
      return { error: 'Leerfahrt: zaman penceresi 0–600 dk, „en erken“ „en geç“ten küçük olmalı' };
    }
  }
  if (!isEmpty(ip_bypass_mode) && !['fern', 'nah', 'alle'].includes(String(ip_bypass_mode))) {
    return { error: 'Besucherkreis ungültig' };
  }
  if (!isEmpty(roundtrip_value)) {
    const r = Number(roundtrip_value);
    if (!Number.isFinite(r) || r < 0 || (discount_type === 'percent' && r > 100)) return { error: 'Hin & Rück-Wert ungültig' };
  }
  const labelOk = (l: any) => isEmpty(l) || String(l).trim().length <= 80;
  if (![label_de, label_en, label_tr].every(labelOk)) return { error: 'Kundentext darf maximal 80 Zeichen lang sein' };

  const numOrNull = (v: any) => (v === null || v === undefined || v === '' ? null : parseFloat(v));
  const intOrNull = (v: any) => (v === null || v === undefined || v === '' ? null : parseInt(v));
  const strOrNull = (v: any) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
  const dateOnly = (d: any) => (d ? String(d).split('T')[0] : null);

  return {
    values: [
      String(name).trim(),
      discount_type,
      val,
      zone_scope,
      numOrNull(min_km),
      numOrNull(max_km),
      intOrNull(trip_time_from),
      intOrNull(trip_time_to),
      intOrNull(booking_time_from),
      intOrNull(booking_time_to),
      strOrNull(weekday_mask),
      intOrNull(booking_index_max),
      intOrNull(daily_max_uses),
      intOrNull(max_uses),
      numOrNull(max_discount_amount),
      strOrNull(vehicle_types),
      strOrNull(trip_types),
      dateOnly(start_date),
      dateOnly(end_date),
      dateOnly(booking_start_date),
      dateOnly(booking_end_date),
      intOrNull(priority) ?? 0,
      stackable_with_promo ? 1 : 0,
      strOrNull(label_de),
      strOrNull(label_en),
      strOrNull(label_tr),
      show_in_banner ? 1 : 0,
      show_countdown === undefined ? 1 : (show_countdown ? 1 : 0),
      show_remaining === undefined ? 1 : (show_remaining ? 1 : 0),
      isEmpty(price_basis) ? 'any' : String(price_basis),
      numOrNull(visitor_min_km),
      numOrNull(visitor_max_km),
      visitor_unknown_ok === undefined ? 1 : (visitor_unknown_ok ? 1 : 0),
      intOrNull(visit_min),
      allow_fixed_routes ? 1 : 0,
      numOrNull(demand_pace_max),
      intOrNull(trip_date_max_uses),
      isEmpty(ip_bypass_mode) ? null : String(ip_bypass_mode),
      numOrNull(roundtrip_value),
      exclude_business ? 1 : 0,
      intOrNull(max_days_ahead),
      intOrNull(gap_window_minutes),
      isEmpty(gap_window_minutes) ? null : (intOrNull(gap_max_rides) ?? 0),
      numOrNull(leer_radius_km),
      isEmpty(leer_radius_km) ? null : (intOrNull(leer_after_min) ?? 45),
      isEmpty(leer_radius_km) ? null : (intOrNull(leer_before_min) ?? 120),
      isEmpty(leer_radius_km) || leer_area !== 'muenchen' ? null : 'muenchen',
      isEmpty(leer_radius_km) || leer_area !== 'muenchen' ? null : numOrNull(leer_end_km),
      // '' bewusst erlaubt (= keine Ausschlüsse); null = Standardliste
      isEmpty(leer_radius_km) || leer_area !== 'muenchen' || leer_exclude_plz == null
        ? null : String(leer_exclude_plz).split(/[\s,;]+/).filter(p => /^\d{2,5}$/.test(p)).join(',').slice(0, 500),
    ],
  };
}

const RULE_COLS = `name, discount_type, discount_value, zone_scope, min_km, max_km,
  trip_time_from, trip_time_to, booking_time_from, booking_time_to,
  weekday_mask, booking_index_max, daily_max_uses, max_uses, max_discount_amount,
  vehicle_types, trip_types, start_date, end_date, booking_start_date, booking_end_date,
  priority, stackable_with_promo, label_de, label_en, label_tr, show_in_banner, show_countdown, show_remaining,
  price_basis, visitor_min_km, visitor_max_km, visitor_unknown_ok, visit_min, allow_fixed_routes,
  demand_pace_max, trip_date_max_uses, ip_bypass_mode, roundtrip_value, exclude_business, max_days_ahead,
  gap_window_minutes, gap_max_rides, leer_radius_km, leer_after_min, leer_before_min, leer_area, leer_end_km, leer_exclude_plz`;

// GET /api/auto-discounts/public/banner?locale=de — Startseiten-Banner (öffentlich)
router.get('/public/banner', async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('auto_discount_banner_enabled', 'auto_discount_countdown_enabled', 'auto_discount_remaining_enabled')`
    );
    const s = Object.fromEntries(settings.map(r => [r.setting_key, r.setting_value]));
    if ((s.auto_discount_banner_enabled ?? '0') !== '1') { res.json(null); return; }
    const visitor = await visitorDistanceToBase(req);
    const result = await resolveBannerDiscount(visitor.distanceKm, visitor.bypassDistanceKm, visitor.rawDistanceKm);
    if (!result) { res.json(null); return; }
    const { rule } = result;
    const locale = ['de', 'en', 'tr'].includes(String(req.query.locale)) ? String(req.query.locale) as 'de' | 'en' | 'tr' : 'de';
    const countdownOn = (s.auto_discount_countdown_enabled ?? '1') === '1' && Number(rule.show_countdown) === 1;
    res.json({
      label: ruleLabels(rule)[locale],
      type: rule.discount_type,
      value: Number(rule.discount_value),
      ends_at: countdownOn ? result.endsAt : null,
      remaining: (s.auto_discount_remaining_enabled ?? '1') === '1' && Number(rule.show_remaining) === 1 ? result.remaining : null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch banner discount' });
  }
});

// GET /api/auto-discounts/admin/list
router.get('/admin/list', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rules = await query<any>('SELECT * FROM auto_discounts ORDER BY priority DESC, created_at DESC');
    res.json(rules);
  } catch {
    res.status(500).json({ error: 'Failed to fetch auto discounts' });
  }
});

// GET /api/auto-discounts/admin/demand — Auslastung der nächsten Tage (Ruhiger-Tag-Rabatte)
// plus Bilanz der letzten 30 Tage für die Ruhiger-Tag-Regeln.
router.get('/admin/demand', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await demandSettings();
    const rules = await query<{ id: number; name: string; demand_pace_max: number; discount_type: string;
      discount_value: number; active: number; priority: number; max_days_ahead: number | null }>(
      `SELECT id, name, demand_pace_max, discount_type, discount_value, active, priority, max_days_ahead
         FROM auto_discounts WHERE demand_pace_max IS NOT NULL ORDER BY priority DESC`
    );
    const days = [];
    for (let i = 0; i <= settings.horizonDays; i++) {
      const p = await getDayPace(berlinDateSql(i));
      // Welche aktive Regel würde (nur nach Auslastung) greifen — höchste Priorität zuerst
      const tier = settings.enabled && p.pace != null
        ? rules.find(r => Number(r.active) === 1 && p.pace! < Number(r.demand_pace_max)
            && (r.max_days_ahead == null || i <= Number(r.max_days_ahead))) ?? null
        : null;
      days.push({ ...p, rule: tier ? { id: tier.id, name: tier.name, type: tier.discount_type, value: Number(tier.discount_value) } : null });
    }
    let stats = { bookings: 0, discount: 0, revenue: 0 };
    if (rules.length) {
      const [row] = await query<{ n: number; disc: number; rev: number }>(
        `SELECT COUNT(*) AS n, COALESCE(SUM(auto_discount_amount), 0) AS disc, COALESCE(SUM(price), 0) AS rev
           FROM bookings
          WHERE auto_discount_id IN (${rules.map(() => '?').join(',')})
            AND status != 'cancelled' AND created_at >= NOW() - INTERVAL 30 DAY`,
        rules.map(r => r.id)
      );
      stats = { bookings: Number(row?.n) || 0, discount: Number(row?.disc) || 0, revenue: Number(row?.rev) || 0 };
    }
    res.json({ settings, days, stats });
  } catch (e: any) {
    console.error('demand overview failed:', e?.message);
    res.status(500).json({ error: 'Failed to load demand overview' });
  }
});

// GET /api/auto-discounts/admin/gaps — Tagesplan der nächsten Tage stundenweise und wo eine
// Boş-saat-Regel greifen würde (nur Zeit-/Planbedingungen, keine kundenbezogenen).
router.get('/admin/gaps', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await demandSettings();
    const rules = await query<{ id: number; name: string; discount_type: string; discount_value: number; active: number;
      priority: number; max_days_ahead: number | null; gap_window_minutes: number; gap_max_rides: number | null;
      trip_time_from: number | null; trip_time_to: number | null }>(
      `SELECT id, name, discount_type, discount_value, active, priority, max_days_ahead, gap_window_minutes, gap_max_rides,
              trip_time_from, trip_time_to
         FROM auto_discounts WHERE gap_window_minutes IS NOT NULL ORDER BY priority DESC`
    );
    const active = rules.filter(r => Number(r.active) === 1);
    // So weit voraus, wie die aktiven Regeln reichen (mind. 3, höchstens 7 Tage)
    const span = Math.min(7, Math.max(3, ...active.map(r => (r.max_days_ahead == null ? 3 : Number(r.max_days_ahead)))));
    const days = [];
    for (let i = 0; i <= span; i++) {
      const date = berlinDateSql(i);
      const minutes = await rideMinutesOn(date);
      const hours = Array.from({ length: 24 }, (_, h) => minutes.filter(m => Math.floor(m / 60) === h).length);
      // Je halbe Stunde: welche Regel würde für eine Abholung genau dann greifen?
      const slots: ({ id: number; name: string; type: string; value: number } | null)[] = [];
      for (let s = 0; s < 48; s++) {
        const minute = s * 30;
        let hit: typeof active[number] | null = null;
        if (settings.gapEnabled) {
          for (const r of active) {
            if (r.max_days_ahead != null && i > Number(r.max_days_ahead)) continue;
            if (!windowMatches(r.trip_time_from, r.trip_time_to, minute)) continue;
            if (await ridesNear(date, minute, Number(r.gap_window_minutes)) > Number(r.gap_max_rides ?? 0)) continue;
            hit = r;
            break;
          }
        }
        slots.push(hit ? { id: hit.id, name: hit.name, type: hit.discount_type, value: Number(hit.discount_value) } : null);
      }
      days.push({ date, rides: minutes.length, hours, slots });
    }
    let stats = { bookings: 0, discount: 0, revenue: 0 };
    if (rules.length) {
      const [row] = await query<{ n: number; disc: number; rev: number }>(
        `SELECT COUNT(*) AS n, COALESCE(SUM(auto_discount_amount), 0) AS disc, COALESCE(SUM(price), 0) AS rev
           FROM bookings
          WHERE auto_discount_id IN (${rules.map(() => '?').join(',')})
            AND status != 'cancelled' AND created_at >= NOW() - INTERVAL 30 DAY`,
        rules.map(r => r.id)
      );
      stats = { bookings: Number(row?.n) || 0, discount: Number(row?.disc) || 0, revenue: Number(row?.rev) || 0 };
    }
    res.json({ enabled: settings.gapEnabled, days, stats });
  } catch (e: any) {
    console.error('gap overview failed:', e?.message);
    res.status(500).json({ error: 'Failed to load gap overview' });
  }
});

// GET /api/auto-discounts/admin/leer — freie Autos der nächsten Tage (Ziel einer geplanten
// Fahrt) und das Zeitfenster, in dem eine Leerfahrt-Regel dort Rabatt geben würde.
router.get('/admin/leer', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await demandSettings();
    const rules = await query<{ id: number; name: string; discount_type: string; discount_value: number; active: number;
      leer_radius_km: number; leer_after_min: number | null; leer_before_min: number | null; max_days_ahead: number | null;
      leer_area: string | null; leer_end_km: number | null; leer_exclude_plz: string | null }>(
      `SELECT id, name, discount_type, discount_value, active, leer_radius_km, leer_after_min, leer_before_min, max_days_ahead, leer_area, leer_end_km, leer_exclude_plz
         FROM auto_discounts WHERE leer_radius_km IS NOT NULL ORDER BY priority DESC`
    );
    // Maßgeblich für die Anzeige: die aktive Regel mit höchster Priorität (sonst Vorlagenwerte)
    const lead = rules.find(r => Number(r.active) === 1) ?? null;
    const radiusKm = lead ? Number(lead.leer_radius_km) : 25;
    const afterMin = lead?.leer_after_min != null ? Number(lead.leer_after_min) : 45;
    const beforeMin = lead?.leer_before_min != null ? Number(lead.leer_before_min) : 120;
    const area = (lead ? lead.leer_area : 'muenchen') === 'muenchen' ? 'muenchen' as const : null;
    const endKm = lead?.leer_end_km != null ? Number(lead.leer_end_km) : DEFAULT_LEER_END_KM;
    const excludePlz = parsePlzList(lead ? lead.leer_exclude_plz : null);
    const nowWall = berlinNowSql().replace(' ', 'T').slice(0, 16);
    const addMin = (w: string, m: number) => new Date(Date.parse(`${w}:00Z`) + m * 60_000).toISOString().slice(0, 16);
    const items = [];
    for (let i = 0; i <= 2; i++) {
      const date = berlinDateSql(i);
      for (const v of await vacanciesAround(date, radiusKm, beforeMin, area, endKm, excludePlz)) {
        if (v.freeAt.slice(0, 10) !== date) continue; // Vortag nur als Quelle, angezeigt am Tag des Freiwerdens
        const windowFrom = addMin(v.freeAt, afterMin);
        const windowTo = addMin(v.freeAt, beforeMin);
        if (windowTo < nowWall) continue; // Fenster schon vorbei
        items.push({
          start: v.leg.start, from: v.leg.from, to: v.leg.to, label: v.leg.label,
          freeAt: v.freeAt, windowFrom, windowTo,
          usedBy: v.usedBy ? { start: v.usedBy.start, from: v.usedBy.from, label: v.usedBy.label } : null,
        });
      }
    }
    let stats = { bookings: 0, discount: 0, revenue: 0 };
    if (rules.length) {
      const [row] = await query<{ n: number; disc: number; rev: number }>(
        `SELECT COUNT(*) AS n, COALESCE(SUM(auto_discount_amount), 0) AS disc, COALESCE(SUM(price), 0) AS rev
           FROM bookings
          WHERE auto_discount_id IN (${rules.map(() => '?').join(',')})
            AND status != 'cancelled' AND created_at >= NOW() - INTERVAL 30 DAY`,
        rules.map(r => r.id)
      );
      stats = { bookings: Number(row?.n) || 0, discount: Number(row?.disc) || 0, revenue: Number(row?.rev) || 0 };
    }
    res.json({
      enabled: settings.leerEnabled,
      rule: lead ? { id: lead.id, name: lead.name, type: lead.discount_type, value: Number(lead.discount_value) } : null,
      radiusKm, afterMin, beforeMin, area, endKm, excludePlz, items, stats,
    });
  } catch (e: any) {
    console.error('leer overview failed:', e?.message);
    res.status(500).json({ error: 'Failed to load Leerfahrt overview' });
  }
});

// GET /api/auto-discounts/admin/search-stats?from=YYYY-MM-DD&to=YYYY-MM-DD — Arama talebi:
// wofür gesucht wurde (Fahrtag/-stunde) und wie viel davon gebucht wurde (Replay-Daten).
router.get('/admin/search-stats', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const to = re.test(String(req.query.to)) ? String(req.query.to) : berlinDateSql(0);
  const from = re.test(String(req.query.from)) ? String(req.query.from) : berlinDateSql(-6);
  if (from > to || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 92) {
    res.status(400).json({ error: 'Zeitraum ungültig (höchstens 92 Tage)' });
    return;
  }
  try {
    res.json(await searchStats(from, to));
  } catch (e: any) {
    console.error('search stats failed:', e?.message);
    res.status(500).json({ error: 'Failed to load search stats' });
  }
});

// POST /api/auto-discounts/admin — create rule
// ---- Rabatt-Autopilot (services/rabattAutopilot.ts) ------------------------------------------
// Regelzeile (dynamic_mode = 'autopilot') trägt die Grenzen: aktiv, Höchst-%, Mindest-km,
// Stammkunde (booking_index_max), Firma (exclude_business), Pflichttarif (ip_bypass_mode 'alle' = darf
// darunter). Kontrollgruppe, Wochenbudget, Mindest-Bedarf stehen in settings.

async function autopilotRule(): Promise<any | null> {
  const [r] = await query<any>(`SELECT * FROM auto_discounts WHERE dynamic_mode = 'autopilot' ORDER BY id LIMIT 1`);
  return r || null;
}
async function apSetting(key: string, def: string): Promise<string> {
  const [r] = await query<{ setting_value: string }>('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
  return r ? r.setting_value : def;
}

router.get('/admin/autopilot', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await autopilotRule();
    if (!rule) { res.status(404).json({ error: 'Autopilot-Regel fehlt (Server neu starten)' }); return; }
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const minScore = Number(await apSetting('autopilot_min_score', '0.45')) || 0.45;
    const startedAt = await apSetting('smart_rabatt_started_at', '');
    // Nur Zeilen der neuen Bewertung: die alten Autopilot-Punkte sind nicht vergleichbar
    const offers = await query<any>(
      `SELECT o.percent, o.holdout, o.score, o.signals, o.blocked, o.booking_id IS NOT NULL AS booked,
              b.auto_discount_amount AS discount, b.auto_discount_id AS discount_rule, b.price, b.distance_km
         FROM autopilot_offers o LEFT JOIN bookings b ON b.id = o.booking_id AND b.status <> 'cancelled'
        WHERE o.engine = 2 AND o.created_at > NOW() - INTERVAL ? DAY`, [days]);
    const decided = offers.filter(o => !o.blocked);
    const grp = (f: (o: any) => boolean) => { const xs = decided.filter(f); return { n: xs.length, booked: xs.filter(o => Number(o.booked) === 1).length }; };
    const offered = grp(o => Number(o.holdout) === 0 && Number(o.percent) > 0);
    const holdout = grp(o => Number(o.holdout) === 1 && Number(o.score) >= minScore);
    const noOffer = grp(o => Number(o.holdout) === 0 && Number(o.percent) === 0);

    // Schieberegler: Verteilung der Werte (0,05-Schritte) → „wie viele sähen bei dieser Schwelle Rabatt“
    const scoreHist = Array.from({ length: 21 }, () => 0);
    for (const o of decided) if (o.score != null) scoreHist[Math.min(20, Math.floor(Number(o.score) * 20 + 1e-9))]++;

    // Signal-Tabelle
    const sig: Record<string, { n: number; booked: number; discount: number }> = {};
    for (const o of decided) {
      for (const k of String(o.signals || '').split(',').filter(Boolean)) {
        const e = sig[k] || (sig[k] = { n: 0, booked: 0, discount: 0 });
        e.n++;
        if (Number(o.booked) === 1) e.booked++;
        if (Number(o.discount_rule) === rule.id) e.discount += Number(o.discount) || 0;
      }
    }

    // Netto-Gewinn: Mehrbuchungen gegenüber der Kontrollgruppe × Netto je Fahrt − gegebener Rabatt
    const discounted = decided.filter(o => Number(o.booked) === 1 && Number(o.discount_rule) === rule.id);
    const discountGiven = discounted.reduce((a, o) => a + (Number(o.discount) || 0), 0);
    const cost = await loadCostSettings();
    const netOf = (o: any) => {
      const gross = (Number(o.price) || 0) + (Number(o.discount) || 0);
      return gross * (1 - cost.driverPct / 100) - (Number(o.distance_km) || 0) * 2 * (cost.lPer100 / 100) * cost.eurPerL;
    };
    const avgNet = discounted.length ? discounted.reduce((a, o) => a + netOf(o), 0) / discounted.length : null;
    const rateO = offered.n ? offered.booked / offered.n : 0;
    const rateH = holdout.n ? holdout.booked / holdout.n : 0;
    const enough = offered.n >= 20 && holdout.n >= 20;
    const se = enough ? Math.sqrt((rateO * (1 - rateO)) / offered.n + (rateH * (1 - rateH)) / holdout.n) : 0;
    const confidence: 'low' | 'uncertain' | 'reliable' = !enough ? 'low' : Math.abs(rateO - rateH) > 1.96 * se ? 'reliable' : 'uncertain';
    const extraBookings = enough ? (rateO - rateH) * offered.n : null;
    const netGain = extraBookings != null && avgNet != null ? Math.round((extraBookings * avgNet - discountGiven) * 100) / 100 : null;

    const since = startedAt || '1970-01-01 00:00:00';
    const [money] = await query<any>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(auto_discount_amount), 0) AS discount, COALESCE(SUM(price), 0) AS revenue FROM bookings
        WHERE auto_discount_id = ? AND status <> 'cancelled' AND created_at > NOW() - INTERVAL ? DAY AND created_at >= ?`, [rule.id, days, since]);
    const today = berlinDateSql(0);
    const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = new Date(Date.parse(`${today}T12:00:00Z`) - wd * 86_400_000).toISOString().slice(0, 10);
    const [week] = await query<any>(
      `SELECT COALESCE(SUM(auto_discount_amount), 0) AS s FROM bookings WHERE auto_discount_id = ? AND status <> 'cancelled' AND created_at >= ?`,
      [rule.id, `${monday} 00:00:00`]);
    const dem = await demandSettings();
    res.json({
      settings: {
        enabled: Number(rule.active) === 1,
        maxPercent: Number(rule.discount_value),
        minKm: rule.min_km != null ? Number(rule.min_km) : 0,
        excludeStamm: rule.booking_index_max != null,
        excludeBusiness: Number(rule.exclude_business) === 1,
        // 'fern' sagt nichts über den Schalter aus — sonst ginge er beim Zurückstellen auf „Herkes“ verloren
        ignorePgFloor: rule.ip_bypass_mode === 'fern' ? (await apSetting('smart_ignore_pg_floor', '1')) !== '0' : rule.ip_bypass_mode === 'alle' || rule.ip_bypass_mode === 'nah',
        roundtripPercent: rule.roundtrip_value != null ? Number(rule.roundtrip_value) : 0,
        holdoutPct: Number(await apSetting('autopilot_holdout_pct', '15')),
        weeklyBudget: Number(await apSetting('autopilot_weekly_budget', '150')),
        minScore,
        signalQuietDay: (await apSetting('smart_signal_quiet_day', '1')) !== '0',
        signalGap: (await apSetting('smart_signal_gap', '1')) !== '0',
        signalBehavior: (await apSetting('smart_signal_behavior', '1')) !== '0',
        leerEnabled: dem.leerEnabled,
        capacityEnabled: dem.capacityEnabled,
        capacityVehicles: dem.capacityVehicles,
        capacityWindow: dem.capacityWindow,
        priceNotice: (await apSetting('smart_price_notice_enabled', '1')) !== '0',
        // Kimler görsün
        zoneInside: rule.zone_scope !== 'outside',
        zoneOutside: rule.zone_scope !== 'inside',
        stammFrom: rule.booking_index_max != null ? Number(rule.booking_index_max) : 2,
        visitorScope: rule.ip_bypass_mode === 'fern' || rule.ip_bypass_mode === 'nah' ? rule.ip_bypass_mode : 'alle',
        // Ohne Einschränkung: alle (leer hieße „keine“ und wird beim Speichern abgelehnt)
        vehicles: rule.vehicle_types ? String(rule.vehicle_types).split(',').map((x: string) => x.trim()).filter(Boolean) : ['kombi', 'van', 'grossraumtaxi'],
        weekdays: rule.weekday_mask ? String(rule.weekday_mask).split(',').map(Number).filter(Boolean) : [1, 2, 3, 4, 5, 6, 7],
        tripFrom: rule.trip_time_from != null ? Number(rule.trip_time_from) : null,
        tripTo: rule.trip_time_to != null ? Number(rule.trip_time_to) : null,
        maxKm: rule.max_km != null ? Number(rule.max_km) : null,
        maxDaysAhead: rule.max_days_ahead != null ? Number(rule.max_days_ahead) : null,
        maxPerTripDate: rule.trip_date_max_uses != null ? Number(rule.trip_date_max_uses) : null,
        allowFixedRoutes: Number(rule.allow_fixed_routes) === 1,
        source: await apSetting('smart_source', 'all'),
        direction: await apSetting('smart_direction', 'all'),
      },
      report: {
        days, startedAt: startedAt || null,
        offers: decided.length,
        capacityBlocked: offers.length - decided.length,
        holdout, offered, noOffer,
        levels: [3, 5, 7].map(l => ({ percent: l, ...grp(o => Number(o.holdout) === 0 && Number(o.percent) === l) })),
        bookings: Number(money?.n) || 0, discount: Number(money?.discount) || 0, revenue: Number(money?.revenue) || 0,
        weekSpent: Number(week?.s) || 0,
        scoreHist,
        signals: Object.entries(sig).sort((a, b) => b[1].n - a[1].n).map(([key, v]) => ({ key, n: v.n, booked: v.booked, discount: Math.round(v.discount * 100) / 100 })),
        net: { gain: netGain, avgNet: avgNet != null ? Math.round(avgNet * 100) / 100 : null, extraBookings: extraBookings != null ? Math.round(extraBookings * 10) / 10 : null, discount: Math.round(discountGiven * 100) / 100, confidence },
        // Rabatte-Einstellung „Pflichttarif-Boden ignorieren" gilt für alle Regeln — dann ist der Autopilot-Schalter wirkungslos
        globalIgnorePgFloor: (await apSetting('auto_discount_ignore_pg_floor', '0')) === '1',
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Autopilot konnte nicht geladen werden' });
  }
});

router.put('/admin/autopilot', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await autopilotRule();
    if (!rule) { res.status(404).json({ error: 'Autopilot-Regel fehlt' }); return; }
    const b = req.body || {};
    const num = (v: any, min: number, max: number, def: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : def; };
    const maxPercent = num(b.maxPercent, 1, 15, Number(rule.discount_value));
    const minKm = num(b.minKm, 0, 500, rule.min_km != null ? Number(rule.min_km) : 25);
    const rtPercent = num(b.roundtripPercent, 0, maxPercent, rule.roundtrip_value != null ? Number(rule.roundtrip_value) : 0);
    if (b.zoneInside === false && b.zoneOutside === false) { res.status(400).json({ error: 'En az bir bölge seçili olmalı: Pflichtgebiet içi veya dışı' }); return; }
    const VEHICLE_TYPES = ['kombi', 'van', 'grossraumtaxi'];
    const vehicles = Array.isArray(b.vehicles) ? b.vehicles.filter((v: string) => VEHICLE_TYPES.includes(v)) : [];
    if (Array.isArray(b.vehicles) && b.vehicles.length === 0) { res.status(400).json({ error: 'En az bir araç tipi seçili olmalı' }); return; }
    const weekdays = Array.isArray(b.weekdays) ? [...new Set(b.weekdays.map(Number).filter((d: number) => d >= 1 && d <= 7))].sort() as number[] : [];
    if (Array.isArray(b.weekdays) && weekdays.length === 0) { res.status(400).json({ error: 'En az bir gün seçili olmalı' }); return; }
    const minute = (v: any) => (v == null || v === '' ? null : num(v, 0, 1439, -1));
    const tripFrom = minute(b.tripFrom), tripTo = minute(b.tripTo);
    if (tripFrom === -1 || tripTo === -1 || (tripFrom == null) !== (tripTo == null)) { res.status(400).json({ error: 'Alış saati: başlangıç ve bitişi birlikte girin' }); return; }
    const optInt = (v: any, min: number, max: number) => { if (v == null || v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
    const maxKm = optInt(b.maxKm, 1, 1000);
    if (maxKm != null && minKm > maxKm) { res.status(400).json({ error: 'En fazla km, en az km değerinden küçük olamaz' }); return; }
    const scope = b.visitorScope === 'fern' || b.visitorScope === 'nah' ? b.visitorScope : 'alle';
    // 'nah' und 'alle' halten den Pflichttarif-Boden nicht ein, 'fern' und NULL schon (siehe ruleIgnoresPgFloor)
    const bypass = scope !== 'alle' ? scope : b.ignorePgFloor === false ? null : 'alle';
    const stammFrom = Math.round(num(b.stammFrom, 1, 50, 2));
    await run(
      `UPDATE auto_discounts SET active = ?, discount_value = ?, min_km = ?, max_km = ?, booking_index_max = ?, exclude_business = ?, ip_bypass_mode = ?, roundtrip_value = ?,
              zone_scope = ?, vehicle_types = ?, weekday_mask = ?, trip_time_from = ?, trip_time_to = ?, max_days_ahead = ?, trip_date_max_uses = ?, allow_fixed_routes = ? WHERE id = ?`,
      [b.enabled ? 1 : 0, maxPercent, minKm > 0 ? minKm : null, maxKm, b.excludeStamm === false ? null : stammFrom,
        b.excludeBusiness === false ? 0 : 1, bypass, rtPercent > 0 ? rtPercent : null,
        b.zoneInside === false ? 'outside' : b.zoneOutside === false ? 'inside' : 'any',
        vehicles.length === 0 || vehicles.length === VEHICLE_TYPES.length ? null : vehicles.join(','),
        weekdays.length === 0 || weekdays.length === 7 ? null : weekdays.join(','),
        tripFrom, tripTo, optInt(b.maxDaysAhead, 0, 365), optInt(b.maxPerTripDate, 1, 100), b.allowFixedRoutes ? 1 : 0, rule.id]);
    const upsert = (k: string, v: string) => run(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [k, v, v]);
    const flag = async (k: string, v: unknown) => { if (typeof v === 'boolean') await upsert(k, v ? '1' : '0'); };
    if (b.holdoutPct != null) await upsert('autopilot_holdout_pct', String(num(b.holdoutPct, 0, 50, 15)));
    if (b.weeklyBudget != null) await upsert('autopilot_weekly_budget', String(num(b.weeklyBudget, 0, 5000, 150)));
    if (b.minScore != null) await upsert('autopilot_min_score', String(num(b.minScore, 0.2, 0.8, 0.45)));
    await flag('smart_signal_quiet_day', b.signalQuietDay);
    await flag('smart_signal_gap', b.signalGap);
    await flag('smart_signal_behavior', b.signalBehavior);
    await flag('leer_discount_enabled', b.leerEnabled);
    await flag('auto_discount_capacity_enabled', b.capacityEnabled);
    await flag('smart_price_notice_enabled', b.priceNotice);
    await flag('smart_ignore_pg_floor', b.ignorePgFloor);
    if (['all', 'ads', 'other'].includes(b.source)) await upsert('smart_source', b.source);
    if (['all', 'from_airport', 'to_airport'].includes(b.direction)) await upsert('smart_direction', b.direction);
    if (b.capacityVehicles != null) await upsert('auto_discount_capacity_vehicles', String(Math.round(num(b.capacityVehicles, 1, 50, 3))));
    if (b.capacityWindow != null) await upsert('auto_discount_capacity_window', String(Math.round(num(b.capacityWindow, 5, 240, 45))));
    invalidateAutoDiscountCache();
    invalidateAutopilotSettings();
    invalidateDemandCache();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Speichern fehlgeschlagen' });
  }
});

router.post('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = parseRuleBody(req.body);
  if (parsed.error) { res.status(400).json({ error: parsed.error }); return; }
  try {
    await run(
      `INSERT INTO auto_discounts (${RULE_COLS}) VALUES (${parsed.values!.map(() => '?').join(', ')})`,
      parsed.values!
    );
    invalidateAutoDiscountCache();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to create auto discount' });
  }
});

// PUT /api/auto-discounts/admin/:id — update rule (active dahil)
router.put('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  // Sadece toggle: body'de yalnız active varsa hızlı yol
  if (Object.keys(req.body).length === 1 && 'active' in req.body) {
    try {
      await run('UPDATE auto_discounts SET active = ? WHERE id = ?', [req.body.active ? 1 : 0, req.params.id]);
      invalidateAutoDiscountCache();
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Failed to toggle auto discount' });
    }
    return;
  }
  const parsed = parseRuleBody(req.body);
  if (parsed.error) { res.status(400).json({ error: parsed.error }); return; }
  try {
    // SET-Liste aus RULE_COLS ableiten, nicht doppelt pflegen: eine handgeschriebene
    // Liste lief beim Hinzufügen von visit_min/allow_fixed_routes aus dem Takt, die
    // Platzhalter passten nicht mehr zu parsed.values und jedes Speichern schlug fehl.
    const setClause = RULE_COLS.split(',').map(c => `${c.trim()}=?`).join(', ');
    await run(
      `UPDATE auto_discounts SET ${setClause},
        hour_from=NULL, hour_to=NULL,
        active=?
       WHERE id=?`,
      [...parsed.values!, req.body.active === false ? 0 : 1, req.params.id]
    );
    invalidateAutoDiscountCache();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update auto discount' });
  }
});

// DELETE /api/auto-discounts/admin/:id
router.delete('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM auto_discounts WHERE id = ?', [req.params.id]);
    invalidateAutoDiscountCache();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete auto discount' });
  }
});

export default router;
