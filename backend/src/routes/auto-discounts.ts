import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin } from '../middleware/auth';
import { invalidateAutoDiscountCache, resolveBannerDiscount, ruleLabels } from '../services/autoDiscount';
import { visitorDistanceToBase } from '../services/visitorDistance';

const router = Router();

function parseRuleBody(body: any): { error?: string; values?: any[] } {
  const {
    name, discount_type, discount_value, zone_scope, min_km, max_km,
    trip_time_from, trip_time_to, booking_time_from, booking_time_to,
    weekday_mask, booking_index_max, daily_max_uses, max_uses, max_discount_amount,
    vehicle_types, trip_types, start_date, end_date, booking_start_date, booking_end_date,
    priority, stackable_with_promo, label_de, label_en, label_tr, show_in_banner, show_countdown, show_remaining,
    price_basis, visitor_min_km, visitor_max_km, visitor_unknown_ok,
  } = body;

  if (!name || String(name).trim().length === 0) return { error: 'name erforderlich' };
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
    ],
  };
}

const RULE_COLS = `name, discount_type, discount_value, zone_scope, min_km, max_km,
  trip_time_from, trip_time_to, booking_time_from, booking_time_to,
  weekday_mask, booking_index_max, daily_max_uses, max_uses, max_discount_amount,
  vehicle_types, trip_types, start_date, end_date, booking_start_date, booking_end_date,
  priority, stackable_with_promo, label_de, label_en, label_tr, show_in_banner, show_countdown, show_remaining,
  price_basis, visitor_min_km, visitor_max_km, visitor_unknown_ok`;

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

// POST /api/auto-discounts/admin — create rule
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
    await run(
      `UPDATE auto_discounts SET
        name=?, discount_type=?, discount_value=?, zone_scope=?, min_km=?, max_km=?,
        trip_time_from=?, trip_time_to=?, booking_time_from=?, booking_time_to=?,
        weekday_mask=?, booking_index_max=?, daily_max_uses=?, max_uses=?, max_discount_amount=?,
        vehicle_types=?, trip_types=?, start_date=?, end_date=?, booking_start_date=?, booking_end_date=?,
        priority=?, stackable_with_promo=?, label_de=?, label_en=?, label_tr=?, show_in_banner=?, show_countdown=?, show_remaining=?,
        price_basis=?, visitor_min_km=?, visitor_max_km=?, visitor_unknown_ok=?,
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
