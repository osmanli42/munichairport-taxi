// Personal driver app (/fahrer?d=…): one revocable link per driver, installed once on the
// phone's home screen. Lists the driver's rides, drives the ride lifecycle and receives
// GPS from the browser. Background GPS from the Traccar Client app lands in routes/traccar.

import { Router, Request, Response } from 'express';
import { query } from '../db';
import { parseDriverAppToken } from '../utils/trackingToken';
import {
  loadRidesForDriver, loadBookingByNumber, loadActiveRideForDriver, buildDriverRideView,
  setDriverStatus, ingestFix, parseFix, getTrackingSettings, trackingPhase,
  LIFECYCLE, LIVE_STATUSES, DriverStatus, traccarServerUrl,
} from '../services/driverTracking';

const router = Router();

interface DriverRow {
  id: number; name: string; phone: string; vehicle_plate: string; vehicle_model: string;
  active: number; app_token_version: number; traccar_device_id: string | null; language: string;
  last_seen_app_age_s: number | null; last_fix_age_s: number | null; last_source: string | null;
}

async function authDriver(req: Request, res: Response): Promise<DriverRow | null> {
  const token = (req.query.d as string | undefined) || (req.body?.d as string | undefined);
  const parsed = parseDriverAppToken(token);
  if (!parsed) {
    res.status(401).json({ error: 'invalid_link' });
    return null;
  }
  const [driver] = await query<DriverRow>(
    `SELECT *, TIMESTAMPDIFF(SECOND, last_seen_app_at, NOW()) AS last_seen_app_age_s,
            TIMESTAMPDIFF(SECOND, last_fix_at, NOW()) AS last_fix_age_s
       FROM drivers WHERE id = ?`,
    [parsed.driverId]
  );
  if (!driver || Number(driver.app_token_version) !== parsed.version) {
    res.status(401).json({ error: 'invalid_link' });
    return null;
  }
  if (!Number(driver.active)) {
    res.status(403).json({ error: 'driver_inactive' });
    return null;
  }
  return driver;
}

function driverPublic(d: DriverRow) {
  return {
    id: d.id,
    name: d.name,
    phone: d.phone || null,
    vehicle_plate: d.vehicle_plate || null,
    vehicle_model: d.vehicle_model || null,
    language: d.language || 'de',
    traccar: d.traccar_device_id
      ? { device_id: d.traccar_device_id, server_url: traccarServerUrl(), last_fix_age_s: d.last_source === 'traccar' ? d.last_fix_age_s : null }
      : null,
  };
}

// GET /api/driver-app/me?d= — profile + ride list (live details only for the active ride)
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await authDriver(req, res);
    if (!driver) return;
    const s = await getTrackingSettings();
    const rows = await loadRidesForDriver(driver.id);
    const rides = [];
    for (const b of rows) {
      const live = LIVE_STATUSES.includes(b.driver_status);
      rides.push({ ...(await buildDriverRideView(b, { live })), phase: trackingPhase(b, s) });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ driver: driverPublic(driver), tracking_enabled: s.enabled, rides });
  } catch (error: any) {
    console.error('Driver app /me error:', error?.message);
    res.status(500).json({ error: 'Failed to load rides' });
  }
});

async function ownRide(req: Request, res: Response, driver: DriverRow): Promise<any | null> {
  const b = await loadBookingByNumber(req.params.booking_number);
  if (!b || Number(b.assigned_driver_id) !== driver.id) {
    res.status(404).json({ error: 'ride_not_found' });
    return null;
  }
  return b;
}

// GET /api/driver-app/rides/:booking_number?d= — one ride with map data, ETA, flight
router.get('/rides/:booking_number', async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await authDriver(req, res);
    if (!driver) return;
    const b = await ownRide(req, res, driver);
    if (!b) return;
    const s = await getTrackingSettings();
    res.set('Cache-Control', 'no-store');
    res.json({ ride: { ...(await buildDriverRideView(b, { live: true })), phase: trackingPhase(b, s) } });
  } catch (error: any) {
    console.error('Driver app ride error:', error?.message);
    res.status(500).json({ error: 'Failed to load ride' });
  }
});

// POST /api/driver-app/rides/:booking_number/status — { d, status }
router.post('/rides/:booking_number/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await authDriver(req, res);
    if (!driver) return;
    const b = await ownRide(req, res, driver);
    if (!b) return;
    const to = req.body?.status as DriverStatus;
    if (!LIFECYCLE.includes(to)) {
      res.status(400).json({ error: 'invalid_status' });
      return;
    }
    const s = await getTrackingSettings();
    if (trackingPhase(b, s) !== 'active' && to !== 'assigned') {
      res.status(409).json({ error: 'ride_not_active' });
      return;
    }
    // One live ride per driver: the GPS stream has to belong to exactly one booking.
    if (LIVE_STATUSES.includes(to)) {
      const other = await loadActiveRideForDriver(driver.id);
      if (other && other.id !== b.id) {
        res.status(409).json({ error: 'other_ride_active', booking_number: other.booking_number });
        return;
      }
    }
    const r = await setDriverStatus(b, to, 'driver');
    if (!r.ok) {
      res.status(409).json({ error: r.error });
      return;
    }
    const fresh = await loadBookingByNumber(b.booking_number);
    res.json({ ok: true, ride: { ...(await buildDriverRideView(fresh, { live: true })), phase: trackingPhase(fresh, s) } });
  } catch (error: any) {
    console.error('Driver app status error:', error?.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/driver-app/location — { d, lat, lng, accuracy, heading, speed, timestamp }
router.post('/location', async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await authDriver(req, res);
    if (!driver) return;
    const fix = parseFix(req.body, 'web');
    if (!fix) {
      res.status(400).json({ error: 'lat and lng required' });
      return;
    }
    const b = await loadActiveRideForDriver(driver.id);
    const r = await ingestFix(b, fix, driver.id);
    res.json({
      ok: true,
      stored: r.stored,
      reason: r.reason || null,
      active_booking_number: b?.booking_number || null,
      status: b?.driver_status || null,
    });
  } catch (error: any) {
    console.error('Driver app location error:', error?.message);
    res.status(500).json({ error: 'Failed to store location' });
  }
});

export default router;
