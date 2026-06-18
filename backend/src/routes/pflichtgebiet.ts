import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { getVisitorCoords } from '../utils/ipGeo';
import { haversineKm } from '../utils/geo';

const router = Router();

const VEHICLE_TYPES = ['kombi', 'van', 'grossraumtaxi'];

interface ConfigRow {
  id: number;
  enabled: number;
  mode: string;
  radius_km: number;
  roundtrip_discount_enabled: number;
  airport_enabled: number;
  airport_lat: number;
  airport_lng: number;
  betriebssitz_enabled: number;
  betriebssitz_lat: number;
  betriebssitz_lng: number;
  updated_at: string;
}

interface TarifRow {
  vehicle_type: string;
  grundgebuehr: number;
  min_per_km: number;
}

// GET /api/pflichtgebiet - config + per-vehicle tariffs (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [config] = await query<ConfigRow>('SELECT * FROM pflichtgebiet_config WHERE id = 1');
    const tarife = await query<TarifRow>('SELECT vehicle_type, grundgebuehr, min_per_km FROM pflichtgebiet_tarife ORDER BY vehicle_type');
    res.json({ config: config || null, tarife });
  } catch (error) {
    console.error('Pflichtgebiet fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pflichtgebiet config' });
  }
});

// PUT /api/pflichtgebiet - update global config (admin only)
router.put('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const b = req.body || {};

    if (b.mode !== undefined && !['floor', 'replace'].includes(String(b.mode))) {
      res.status(400).json({ error: "mode must be 'floor' or 'replace'" });
      return;
    }

    const toggles = ['enabled', 'roundtrip_discount_enabled', 'airport_enabled', 'betriebssitz_enabled'];
    for (const t of toggles) {
      if (b[t] !== undefined && !['0', '1', 0, 1, true, false].includes(b[t])) {
        res.status(400).json({ error: `${t} must be 0 or 1` });
        return;
      }
    }

    const numeric = ['radius_km', 'airport_lat', 'airport_lng', 'betriebssitz_lat', 'betriebssitz_lng'];
    for (const n of numeric) {
      if (b[n] !== undefined && isNaN(parseFloat(String(b[n])))) {
        res.status(400).json({ error: `${n} must be a number` });
        return;
      }
    }
    if (b.radius_km !== undefined && parseFloat(String(b.radius_km)) <= 0) {
      res.status(400).json({ error: 'radius_km must be greater than 0' });
      return;
    }

    const tn = (v: any): number | null => (v === undefined ? null : (v ? 1 : 0));
    const fn = (v: any): number | null => (v === undefined ? null : parseFloat(String(v)));

    await run(
      `UPDATE pflichtgebiet_config SET
        enabled = COALESCE(?, enabled),
        mode = COALESCE(?, mode),
        radius_km = COALESCE(?, radius_km),
        roundtrip_discount_enabled = COALESCE(?, roundtrip_discount_enabled),
        airport_enabled = COALESCE(?, airport_enabled),
        airport_lat = COALESCE(?, airport_lat),
        airport_lng = COALESCE(?, airport_lng),
        betriebssitz_enabled = COALESCE(?, betriebssitz_enabled),
        betriebssitz_lat = COALESCE(?, betriebssitz_lat),
        betriebssitz_lng = COALESCE(?, betriebssitz_lng),
        updated_at = NOW()
      WHERE id = 1`,
      [
        tn(b.enabled),
        b.mode !== undefined ? String(b.mode) : null,
        fn(b.radius_km),
        tn(b.roundtrip_discount_enabled),
        tn(b.airport_enabled),
        fn(b.airport_lat),
        fn(b.airport_lng),
        tn(b.betriebssitz_enabled),
        fn(b.betriebssitz_lat),
        fn(b.betriebssitz_lng),
      ]
    );

    const [config] = await query<ConfigRow>('SELECT * FROM pflichtgebiet_config WHERE id = 1');
    res.json(config);
  } catch (error) {
    console.error('Pflichtgebiet config update error:', error);
    res.status(500).json({ error: 'Failed to update pflichtgebiet config' });
  }
});

// PUT /api/pflichtgebiet/tarife/:vehicle_type - update per-vehicle tariff (admin only)
router.put('/tarife/:vehicle_type', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vehicle_type } = req.params;
    const { grundgebuehr, min_per_km } = req.body || {};

    if (!VEHICLE_TYPES.includes(vehicle_type)) {
      res.status(400).json({ error: 'Invalid vehicle type' });
      return;
    }
    if (grundgebuehr === undefined || min_per_km === undefined) {
      res.status(400).json({ error: 'grundgebuehr and min_per_km required' });
      return;
    }
    const g = parseFloat(String(grundgebuehr));
    const k = parseFloat(String(min_per_km));
    if (isNaN(g) || isNaN(k) || g < 0 || k < 0) {
      res.status(400).json({ error: 'grundgebuehr and min_per_km must be positive numbers' });
      return;
    }

    await run(
      `INSERT INTO pflichtgebiet_tarife (vehicle_type, grundgebuehr, min_per_km)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE grundgebuehr = ?, min_per_km = ?, updated_at = NOW()`,
      [vehicle_type, g, k, g, k]
    );

    const [updated] = await query<TarifRow>('SELECT vehicle_type, grundgebuehr, min_per_km FROM pflichtgebiet_tarife WHERE vehicle_type = ?', [vehicle_type]);
    res.json(updated);
  } catch (error) {
    console.error('Pflichtgebiet tarif update error:', error);
    res.status(500).json({ error: 'Failed to update tariff' });
  }
});

// ─── PLZ Exclusions (places within radius but legally outside the zone) ───

interface ExclusionRow {
  id: number;
  plz: string;
  ort: string;
  enabled: number;
}

router.get('/exclusions', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<ExclusionRow>('SELECT id, plz, ort, enabled FROM pflichtgebiet_exclusions WHERE enabled = 1 ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('Pflichtgebiet exclusions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch exclusions' });
  }
});

router.post('/exclusions', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { plz, ort } = req.body || {};
    if (!plz || !/^\d{5}$/.test(String(plz).trim())) {
      res.status(400).json({ error: 'PLZ muss 5-stellig sein' });
      return;
    }
    await run(
      `INSERT INTO pflichtgebiet_exclusions (plz, ort) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ort = VALUES(ort), enabled = 1, updated_at = NOW()`,
      [String(plz).trim(), String(ort || '').trim()]
    );
    const rows = await query<ExclusionRow>('SELECT id, plz, ort, enabled FROM pflichtgebiet_exclusions WHERE enabled = 1 ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('Pflichtgebiet exclusion add error:', error);
    res.status(500).json({ error: 'Failed to add exclusion' });
  }
});

router.delete('/exclusions/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM pflichtgebiet_exclusions WHERE id = ?', [req.params.id]);
    const rows = await query<ExclusionRow>('SELECT id, plz, ort, enabled FROM pflichtgebiet_exclusions WHERE enabled = 1 ORDER BY plz');
    res.json(rows);
  } catch (error) {
    console.error('Pflichtgebiet exclusion delete error:', error);
    res.status(500).json({ error: 'Failed to delete exclusion' });
  }
});

export default router;
