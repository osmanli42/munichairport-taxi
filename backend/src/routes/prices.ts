import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

interface PriceRow {
  id: number;
  vehicle_type: string;
  base_price: number;
  price_per_km: number;
  roundtrip_discount: number;
  fahrrad_price: number;
  fahrrad_enabled: number;
  max_passengers: number;
  max_luggage: number;
  min_price: number;
  min_price_km: number;
  updated_at: string;
}

// GET /api/prices - Get all prices (public)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const prices = await query('SELECT * FROM prices ORDER BY id');
  res.json(prices);
});

// GET /api/prices/:vehicle_type - Get price for specific vehicle (public)
router.get('/:vehicle_type', async (req: Request, res: Response): Promise<void> => {
  const [price] = await query<PriceRow>('SELECT * FROM prices WHERE vehicle_type = ?', [req.params.vehicle_type]);
  if (!price) {
    res.status(404).json({ error: 'Price not found' });
    return;
  }
  res.json(price);
});

// PUT /api/prices/:vehicle_type - Update price (admin only)
router.put('/:vehicle_type', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, max_passengers, max_luggage, min_price, min_price_km } = req.body;
  const { vehicle_type } = req.params;

  if (!['kombi', 'van', 'grossraumtaxi'].includes(vehicle_type)) {
    res.status(400).json({ error: 'Invalid vehicle type' });
    return;
  }

  if (base_price === undefined || price_per_km === undefined) {
    res.status(400).json({ error: 'base_price and price_per_km required' });
    return;
  }

  if (parseFloat(base_price) < 0 || parseFloat(price_per_km) < 0) {
    res.status(400).json({ error: 'Prices must be positive' });
    return;
  }

  const discount = roundtrip_discount !== undefined ? parseFloat(roundtrip_discount) : undefined;
  if (discount !== undefined && (discount < 0 || discount > 50)) {
    res.status(400).json({ error: 'Discount must be between 0 and 50' });
    return;
  }

  const fahrrad = fahrrad_price !== undefined ? parseFloat(fahrrad_price) : undefined;
  const fahrradEnabled = fahrrad_enabled !== undefined ? (fahrrad_enabled ? 1 : 0) : undefined;
  const maxPassengers = max_passengers !== undefined ? parseInt(max_passengers) : undefined;
  const maxLuggage = max_luggage !== undefined ? parseInt(max_luggage) : undefined;
  const minPrice = min_price !== undefined ? parseFloat(min_price) : undefined;
  const minPriceKm = min_price_km !== undefined ? parseFloat(min_price_km) : undefined;

  await run(`
    UPDATE prices SET
      base_price = ?,
      price_per_km = ?,
      roundtrip_discount = COALESCE(?, roundtrip_discount),
      fahrrad_price = COALESCE(?, fahrrad_price),
      fahrrad_enabled = COALESCE(?, fahrrad_enabled),
      max_passengers = COALESCE(?, max_passengers),
      max_luggage = COALESCE(?, max_luggage),
      min_price = COALESCE(?, min_price),
      min_price_km = COALESCE(?, min_price_km),
      updated_at = NOW()
    WHERE vehicle_type = ?
  `, [parseFloat(base_price), parseFloat(price_per_km), discount ?? null, fahrrad ?? null, fahrradEnabled ?? null, maxPassengers ?? null, maxLuggage ?? null, minPrice ?? null, minPriceKm ?? null, vehicle_type]);

  const [updated] = await query('SELECT * FROM prices WHERE vehicle_type = ?', [vehicle_type]);
  res.json(updated);
});

export default router;
