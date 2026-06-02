import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

interface PlzSurchargeRow {
  id: number;
  plz: string;
  stadt: string;
  surcharge: number;
  updated_at: string;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<PlzSurchargeRow>('SELECT * FROM plz_surcharges ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('PLZ surcharges fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch PLZ surcharges' });
  }
});

router.post('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plz, stadt, surcharge } = req.body;
    if (!plz || surcharge === undefined) {
      res.status(400).json({ error: 'plz and surcharge required' });
      return;
    }
    const num = parseFloat(surcharge);
    if (isNaN(num) || num < 0) {
      res.status(400).json({ error: 'surcharge must be a positive number' });
      return;
    }
    await run(
      'INSERT INTO plz_surcharges (plz, stadt, surcharge) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE stadt = VALUES(stadt), surcharge = VALUES(surcharge)',
      [String(plz).trim(), String(stadt || '').trim(), num]
    );
    const rows = await query<PlzSurchargeRow>('SELECT * FROM plz_surcharges ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('PLZ surcharge create error:', error);
    res.status(500).json({ error: 'Failed to create PLZ surcharge' });
  }
});

router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { surcharge, stadt } = req.body;
    const num = parseFloat(surcharge);
    if (isNaN(num) || num < 0) {
      res.status(400).json({ error: 'surcharge must be a positive number' });
      return;
    }
    await run(
      'UPDATE plz_surcharges SET surcharge = ?, stadt = ? WHERE id = ?',
      [num, String(stadt || '').trim(), req.params.id]
    );
    const rows = await query<PlzSurchargeRow>('SELECT * FROM plz_surcharges ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('PLZ surcharge update error:', error);
    res.status(500).json({ error: 'Failed to update PLZ surcharge' });
  }
});

router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM plz_surcharges WHERE id = ?', [req.params.id]);
    const rows = await query<PlzSurchargeRow>('SELECT * FROM plz_surcharges ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('PLZ surcharge delete error:', error);
    res.status(500).json({ error: 'Failed to delete PLZ surcharge' });
  }
});

export default router;
