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
    city: 'München Hauptbahnhof',
    distance_km: 38,
    duration_min: 40,
    pickup_address: 'München Hauptbahnhof, 80335 München',
    pickup_lat: 48.1402,
    pickup_lng: 11.5600,
  },
  {
    slug: 'taxi-landshut-flughafen-muenchen',
    city: 'Landshut',
    distance_km: 37.6,
    duration_min: 29,
    pickup_address: 'Landshut, Hauptbahnhof (ZOB), 84032 Landshut, Deutschland',
    pickup_lat: 48.5325,
    pickup_lng: 12.1509,
  },
  {
    slug: 'taxi-salzburg-flughafen-muenchen',
    city: 'Salzburg Hauptbahnhof',
    distance_km: 183.3,
    duration_min: 119,
    pickup_address: 'Salzburg Hauptbahnhof, 5020 Salzburg, Österreich',
    pickup_lat: 47.8130,
    pickup_lng: 13.0447,
  },
  {
    slug: 'taxi-garmisch-partenkirchen-flughafen-muenchen',
    city: 'Garmisch-Partenkirchen',
    distance_km: 123,
    duration_min: 85,
    pickup_address: 'Garmisch-Partenkirchen, 82467 Garmisch-Partenkirchen',
    pickup_lat: 47.4917,
    pickup_lng: 11.0956,
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

// GET /api/popular-routes/:slug - single route detail (live price for a given city, e.g. for use on its /blog page)
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
