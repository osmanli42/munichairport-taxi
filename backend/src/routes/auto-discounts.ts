import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin } from '../middleware/auth';
import { invalidateAutoDiscountCache } from '../services/autoDiscount';

const router = Router();

function parseRuleBody(body: any): { error?: string; values?: any[] } {
  const {
    name, discount_type, discount_value, zone_scope, min_km, max_km, hour_from, hour_to,
    weekday_mask, booking_index_max, daily_max_uses, max_uses, max_discount_amount,
    vehicle_types, trip_types, start_date, end_date, booking_start_date, booking_end_date,
    priority, stackable_with_promo,
  } = body;

  if (!name || String(name).trim().length === 0) return { error: 'name erforderlich' };
  if (!['percent', 'fixed'].includes(discount_type)) return { error: 'discount_type muss "percent" oder "fixed" sein' };
  const val = parseFloat(discount_value);
  if (isNaN(val) || val <= 0) return { error: 'discount_value muss größer als 0 sein' };
  if (discount_type === 'percent' && val > 100) return { error: 'discount_value (percent) darf maximal 100 sein' };
  if (!['inside', 'outside', 'any'].includes(zone_scope)) return { error: 'zone_scope ungültig' };
  const hourOk = (h: any) => h === null || h === undefined || h === '' ||
    (Number.isInteger(parseInt(h)) && parseInt(h) >= 0 && parseInt(h) <= 23);
  if (!hourOk(hour_from) || !hourOk(hour_to)) return { error: 'hour_from/hour_to müssen 0-23 sein' };

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
      intOrNull(hour_from),
      intOrNull(hour_to),
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
    ],
  };
}

const RULE_COLS = `name, discount_type, discount_value, zone_scope, min_km, max_km, hour_from, hour_to,
  weekday_mask, booking_index_max, max_uses, max_discount_amount,
  vehicle_types, trip_types, start_date, end_date, booking_start_date, booking_end_date,
  priority, stackable_with_promo`;

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
        name=?, discount_type=?, discount_value=?, zone_scope=?, min_km=?, max_km=?, hour_from=?, hour_to=?,
        weekday_mask=?, booking_index_max=?, max_uses=?, max_discount_amount=?,
        vehicle_types=?, trip_types=?, start_date=?, end_date=?, booking_start_date=?, booking_end_date=?,
        priority=?, stackable_with_promo=?,
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
