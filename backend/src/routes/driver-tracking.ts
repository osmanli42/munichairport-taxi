import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { verifyToken } from '../utils/trackingToken';

const router = Router();

const _k1 = process.env.GOOGLE_MAPS_API_KEY || '';
const _k2 = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_API_KEY = _k1.length > 35 ? _k1 : _k2.length > 35 ? _k2 : 'AIzaSyA7wWp8hvzPOVGUsy4pTFVgTzF9QBkmFxI';

const ARRIVAL_RADIUS_M = 150;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', GOOGLE_API_KEY);
    const r = await fetch(url.toString());
    const data = await r.json() as any;
    const loc = data?.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch { return null; }
}

async function driveEtaMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<number | null> {
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${from.lat},${from.lng}`);
    url.searchParams.set('destinations', `${to.lat},${to.lng}`);
    url.searchParams.set('key', GOOGLE_API_KEY);
    url.searchParams.set('mode', 'driving');
    const r = await fetch(url.toString());
    const data = await r.json() as any;
    const el = data?.rows?.[0]?.elements?.[0];
    if (el?.status !== 'OK') return null;
    return Math.ceil(el.duration.value / 60);
  } catch { return null; }
}

// Ensure a booking has pickup coordinates; geocode + persist on first need.
async function ensurePickupCoords(booking: any): Promise<{ lat: number; lng: number } | null> {
  if (booking.pickup_lat != null && booking.pickup_lng != null) {
    return { lat: booking.pickup_lat, lng: booking.pickup_lng };
  }
  const coords = await geocode(booking.pickup_address);
  if (coords) {
    await run('UPDATE bookings SET pickup_lat = ?, pickup_lng = ? WHERE id = ?', [coords.lat, coords.lng, booking.id]);
  }
  return coords;
}

// GET /api/tracking/:booking_number?t=<customerToken> — customer view
router.get('/:booking_number', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'cust', req.query.t as string | undefined)) {
      res.status(403).json({ error: 'Invalid tracking token' });
      return;
    }
    const [booking] = await query<any>('SELECT * FROM bookings WHERE booking_number = ?', [bn]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    let driver: any = null;
    if (booking.assigned_driver_id) {
      [driver] = await query<any>('SELECT name, phone, vehicle_plate, vehicle_model FROM drivers WHERE id = ?', [booking.assigned_driver_id]);
    }

    const pickup = await ensurePickupCoords(booking);

    let eta_minutes: number | null = null;
    const hasLoc = booking.driver_lat != null && booking.driver_lng != null;
    if (hasLoc && pickup && booking.driver_status !== 'arrived') {
      eta_minutes = await driveEtaMinutes(
        { lat: booking.driver_lat, lng: booking.driver_lng },
        pickup
      );
    }

    const hasCustLoc = booking.customer_lat != null && booking.customer_lng != null;

    res.json({
      booking_number: bn,
      driver_status: booking.driver_status || (booking.assigned_driver_id ? 'assigned' : null),
      pickup_address: booking.pickup_address,
      dropoff_address: booking.dropoff_address,
      pickup_datetime: booking.pickup_datetime,
      pickup: pickup,
      driver: driver ? { name: driver.name, phone: driver.phone, vehicle_plate: driver.vehicle_plate, vehicle_model: driver.vehicle_model } : null,
      driver_location: hasLoc ? { lat: booking.driver_lat, lng: booking.driver_lng, updated_at: booking.driver_location_updated_at } : null,
      customer_location: hasCustLoc ? { lat: booking.customer_lat, lng: booking.customer_lng, updated_at: booking.customer_location_updated_at } : null,
      eta_minutes,
    });
  } catch (error) {
    console.error('Tracking GET error:', error);
    res.status(500).json({ error: 'Failed to load tracking' });
  }
});

// POST /api/tracking/:booking_number/location — driver pushes GPS
router.post('/:booking_number/location', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    const { lat, lng, t } = req.body || {};
    if (!verifyToken(bn, 'drv', t)) {
      res.status(403).json({ error: 'Invalid driver token' });
      return;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng required' });
      return;
    }
    const [booking] = await query<any>('SELECT * FROM bookings WHERE booking_number = ?', [bn]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // Decide status: assigned -> enroute on first ping; auto-arrival within radius.
    let newStatus = booking.driver_status === 'arrived' ? 'arrived' : 'enroute';
    const pickup = await ensurePickupCoords(booking);
    if (pickup && haversineMeters(lat, lng, pickup.lat, pickup.lng) <= ARRIVAL_RADIUS_M) {
      newStatus = 'arrived';
    }

    await run(
      `UPDATE bookings SET driver_lat = ?, driver_lng = ?, driver_location_updated_at = NOW(), driver_status = ? WHERE id = ?`,
      [lat, lng, newStatus, booking.id]
    );

    const hasCustLoc = booking.customer_lat != null && booking.customer_lng != null;

    res.json({
      ok: true,
      driver_status: newStatus,
      pickup: pickup ?? null,
      pickup_address: booking.pickup_address ?? null,
      dropoff_address: booking.dropoff_address ?? null,
      customer_name: booking.name ?? null,
      customer_location: hasCustLoc ? { lat: booking.customer_lat, lng: booking.customer_lng } : null,
    });
  } catch (error) {
    console.error('Tracking location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// POST /api/tracking/:booking_number/customer-location — customer shares GPS
router.post('/:booking_number/customer-location', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    const { lat, lng, t } = req.body || {};
    if (!verifyToken(bn, 'cust', t)) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng required' });
      return;
    }
    await run(
      `UPDATE bookings SET customer_lat = ?, customer_lng = ?, customer_location_updated_at = NOW() WHERE booking_number = ?`,
      [lat, lng, bn]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Customer location error:', error);
    res.status(500).json({ error: 'Failed to update customer location' });
  }
});

export default router;
