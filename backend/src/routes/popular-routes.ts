import { Router, Request, Response } from 'express';
import { computeRoutePrice } from './bookings';

const router = Router();

// Curated set of popular routes shown as a homepage price teaser. Slugs match
// the existing /blog/[citySlug] SEO landing pages (frontend/src/lib/citiesData.ts)
// — this endpoint does NOT create separate landing pages, it only computes a
// live "ab X €" price for cities that already have a blog page, since that page's
// price is static/hardcoded and can drift from the real tariff engine.
// Prices are computed live via computeRoutePrice (prices table + Pflichtfahrgebiet
// mandatory zone + fixed-route overrides) — never hardcoded.
export interface PopularRoute {
  slug: string;
  city: string;
  distance_km: number;
  duration_min: number;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
}

const DROPOFF_ADDRESS = 'Flughafen München, 85356 München-Flughafen';
const DROPOFF_LAT = 48.3538;
const DROPOFF_LNG = 11.7861;

export const POPULAR_ROUTES: PopularRoute[] = [
  {
    slug: 'taxi-muenchen-flughafen-muenchen',
    city: 'München',
    distance_km: 38,
    duration_min: 40,
    pickup_address: 'Marienplatz, 80331 München',
    pickup_lat: 48.1374,
    pickup_lng: 11.5755,
  },
  {
    slug: 'taxi-freising-flughafen',
    city: 'Freising',
    distance_km: 7,
    duration_min: 10,
    pickup_address: 'Freising, 85354 Freising',
    pickup_lat: 48.4030,
    pickup_lng: 11.7477,
  },
  {
    slug: 'taxi-erding-flughafen',
    city: 'Erding',
    distance_km: 18,
    duration_min: 18,
    pickup_address: 'Erding, 85435 Erding',
    pickup_lat: 48.3068,
    pickup_lng: 11.9078,
  },
  {
    slug: 'taxi-augsburg-flughafen',
    city: 'Augsburg',
    distance_km: 82,
    duration_min: 60,
    pickup_address: 'Augsburg, 86150 Augsburg',
    pickup_lat: 48.3705,
    pickup_lng: 10.8978,
  },
];

const VEHICLE_TYPES = ['kombi', 'van', 'grossraumtaxi'] as const;

async function buildRouteDetail(req: Request, route: PopularRoute) {
  const prices: Record<string, number | null> = {};
  let pflichtgebiet = false;
  for (const vt of VEHICLE_TYPES) {
    const estimate = await computeRoutePrice(
      req,
      vt,
      route.distance_km,
      route.pickup_address,
      DROPOFF_ADDRESS,
      route.pickup_lat,
      route.pickup_lng,
      DROPOFF_LAT,
      DROPOFF_LNG
    );
    prices[vt] = estimate ? estimate.total_price : null;
    if (estimate?.pflichtgebiet) pflichtgebiet = true;
  }
  return {
    slug: route.slug,
    city: route.city,
    distance_km: route.distance_km,
    duration_min: route.duration_min,
    prices,
    pflichtgebiet,
  };
}

// GET /api/popular-routes - list of curated routes with live "ab X €" prices
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const details = await Promise.all(POPULAR_ROUTES.map(r => buildRouteDetail(req, r)));
    res.json(details);
  } catch (error) {
    console.error('popular-routes list error:', error);
    res.status(500).json({ error: 'Failed to load popular routes' });
  }
});

// GET /api/popular-routes/:slug - single route detail (for the SEO landing page)
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const route = POPULAR_ROUTES.find(r => r.slug === req.params.slug);
    if (!route) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const detail = await buildRouteDetail(req, route);
    res.json(detail);
  } catch (error) {
    console.error('popular-routes detail error:', error);
    res.status(500).json({ error: 'Failed to load route' });
  }
});

export default router;
