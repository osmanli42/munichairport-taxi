import { Router, Request, Response } from 'express';
import { query } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

interface FixedRoute {
  id: number;
  name: string;
  pickup_keywords: string;
  dropoff_keywords: string;
  price_kombi: number;
  price_van: number;
  price_grossraumtaxi: number;
  bidirectional: number;
  enabled: number;
}

function matchesKeywords(address: string, keywords: string): boolean {
  if (!address || !keywords) return false;
  const lower = address.toLowerCase();
  return keywords.split(',').some(kw => lower.includes(kw.trim().toLowerCase()));
}

export function findFixedRoute(
  pickup: string,
  dropoff: string,
  routes: FixedRoute[]
): FixedRoute | null {
  for (const r of routes) {
    if (!r.enabled) continue;
    const pMatch = matchesKeywords(pickup, r.pickup_keywords);
    const dMatch = matchesKeywords(dropoff, r.dropoff_keywords);
    if (pMatch && dMatch) return r;
    if (r.bidirectional) {
      const pRev = matchesKeywords(pickup, r.dropoff_keywords);
      const dRev = matchesKeywords(dropoff, r.pickup_keywords);
      if (pRev && dRev) return r;
    }
  }
  return null;
}

export function getFixedPrice(route: FixedRoute, vehicleType: string): number {
  switch (vehicleType) {
    case 'kombi': return route.price_kombi;
    case 'van': return route.price_van;
    case 'grossraumtaxi': return route.price_grossraumtaxi;
    default: return 0;
  }
}

// GET /api/fixed-routes (public — frontend needs this for price matching)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<FixedRoute>('SELECT * FROM fixed_routes WHERE enabled = 1');
    res.json(rows);
  } catch (e) {
    console.error('fixed-routes GET:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/fixed-routes (admin)
router.post('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, pickup_keywords, dropoff_keywords, price_kombi, price_van, price_grossraumtaxi, bidirectional } = req.body;
    if (!name || !pickup_keywords || !dropoff_keywords) {
      res.status(400).json({ error: 'name, pickup_keywords, dropoff_keywords required' });
      return;
    }
    const [result] = await query<any>(
      `INSERT INTO fixed_routes (name, pickup_keywords, dropoff_keywords, price_kombi, price_van, price_grossraumtaxi, bidirectional)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, pickup_keywords, dropoff_keywords, price_kombi || 0, price_van || 0, price_grossraumtaxi || 0, bidirectional ?? 1]
    );
    res.json({ id: result.insertId });
  } catch (e) {
    console.error('fixed-routes POST:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/fixed-routes/:id (admin)
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, pickup_keywords, dropoff_keywords, price_kombi, price_van, price_grossraumtaxi, bidirectional, enabled } = req.body;
    await query(
      `UPDATE fixed_routes SET name=?, pickup_keywords=?, dropoff_keywords=?, price_kombi=?, price_van=?, price_grossraumtaxi=?, bidirectional=?, enabled=? WHERE id=?`,
      [name, pickup_keywords, dropoff_keywords, price_kombi, price_van, price_grossraumtaxi, bidirectional ?? 1, enabled ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('fixed-routes PUT:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/fixed-routes/:id (admin)
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM fixed_routes WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('fixed-routes DELETE:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
