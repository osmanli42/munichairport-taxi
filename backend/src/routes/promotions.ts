import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

const ERROR_MESSAGES: Record<string, Record<string, string>> = {
  invalid:  { de: 'Dieser Code ist nicht gültig.',               en: 'This code is not valid.',              tr: 'Bu kod geçerli değil.' },
  expired:  { de: 'Dieser Aktionscode ist abgelaufen.',          en: 'This promo code has expired.',         tr: 'Bu promosyon kodunun süresi dolmuş.' },
  maxUsed:  { de: 'Dieser Code ist bereits vollständig eingelöst.', en: 'This code has been fully redeemed.', tr: 'Bu kod tamamen kullanıldı.' },
  inactive: { de: 'Dieser Code ist derzeit nicht aktiv.',        en: 'This code is currently inactive.',     tr: 'Bu kod şu anda aktif değil.' },
};

function msg(key: string, lang: string): string {
  return ERROR_MESSAGES[key]?.[lang] ?? ERROR_MESSAGES[key]?.['de'] ?? key;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// GET /api/promotions/active — public (used by homepage banner + booking page)
router.get('/active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = todayStr();
    const [promo] = await query<any>(
      `SELECT code, type, value, end_date FROM promotions
       WHERE active = 1 AND show_banner = 1 AND start_date <= ? AND end_date >= ?
         AND (max_uses IS NULL OR used_count < max_uses)
       ORDER BY end_date ASC LIMIT 1`,
      [today, today]
    );
    res.json(promo || null);
  } catch {
    res.json(null);
  }
});

// POST /api/promotions/validate — public
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  const { code, base_price, lang = 'de' } = req.body;
  if (!code || base_price === undefined || base_price === null) {
    res.status(400).json({ valid: false, message: msg('invalid', lang) });
    return;
  }

  try {
    const [promo] = await query<any>(
      'SELECT * FROM promotions WHERE UPPER(code) = ?',
      [String(code).toUpperCase()]
    );

    if (!promo) { res.json({ valid: false, message: msg('invalid', lang) }); return; }
    if (!promo.active) { res.json({ valid: false, message: msg('inactive', lang) }); return; }

    const today = todayStr();
    if (promo.start_date > today || promo.end_date < today) {
      res.json({ valid: false, message: msg('expired', lang) }); return;
    }
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      res.json({ valid: false, message: msg('maxUsed', lang) }); return;
    }

    const bp = parseFloat(base_price);
    let discount_amount: number;
    if (promo.type === 'fixed') {
      discount_amount = Math.min(parseFloat(promo.value), bp);
    } else {
      discount_amount = bp * (parseFloat(promo.value) / 100);
    }
    discount_amount = Math.round(discount_amount * 100) / 100;
    const final_price = Math.max(0, Math.round((bp - discount_amount) * 100) / 100);

    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      value: parseFloat(promo.value),
      kombinierbar: !!promo.kombinierbar,
      discount_amount,
      final_price,
    });
  } catch {
    res.json({ valid: false, message: msg('invalid', lang) });
  }
});

// GET /api/promotions/admin/list — admin only
router.get('/admin/list', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const promos = await query<any>('SELECT * FROM promotions ORDER BY created_at DESC');
    res.json(promos);
  } catch {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// POST /api/promotions/admin — create promotion
router.post('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const { code, type, value, start_date, end_date, max_uses, description, kombinierbar } = req.body;
  if (!code || !type || value === undefined || !start_date || !end_date) {
    res.status(400).json({ error: 'code, type, value, start_date, end_date erforderlich' });
    return;
  }
  if (!['fixed', 'percent'].includes(type)) {
    res.status(400).json({ error: 'type muss "fixed" oder "percent" sein' });
    return;
  }
  try {
    await run(
      `INSERT INTO promotions (code, type, value, start_date, end_date, max_uses, description, kombinierbar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(code).toUpperCase().trim(),
        type,
        parseFloat(value),
        start_date,
        end_date,
        max_uses ? parseInt(max_uses) : null,
        description || null,
        kombinierbar ? 1 : 0,
      ]
    );
    res.json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('Duplicate')) {
      res.status(400).json({ error: 'Dieser Code existiert bereits.' });
    } else {
      res.status(500).json({ error: 'Failed to create promotion' });
    }
  }
});

// PUT /api/promotions/admin/:id — update promotion
router.put('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const { code, type, value, start_date, end_date, max_uses, description, active, kombinierbar } = req.body;
  const dateOnly = (d: string) => (d ? String(d).split('T')[0] : d);
  try {
    await run(
      `UPDATE promotions SET code=?, type=?, value=?, start_date=?, end_date=?, max_uses=?, description=?, active=?, kombinierbar=?
       WHERE id=?`,
      [
        String(code).toUpperCase().trim(),
        type,
        parseFloat(value),
        dateOnly(start_date),
        dateOnly(end_date),
        max_uses ? parseInt(max_uses) : null,
        description || null,
        active ? 1 : 0,
        kombinierbar ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// DELETE /api/promotions/admin/:id — delete promotion
router.delete('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM promotions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

export default router;
