// Public tracking endpoints, authorised by the per-booking HMAC token in the link:
//   customer page  /track/:bn?t=…    (role 'cust')
//   single-ride driver page /fahrer/:bn?t=…  (role 'drv') — for drivers without the app
// All decisions (status, ETA, pickup point, time window) come from services/driverTracking.

import { Router, Request, Response } from 'express';
import { run } from '../db';
import { verifyToken } from '../utils/trackingToken';
import {
  loadBookingByNumber, buildCustomerView, buildDriverRideView, getTrackingSettings, trackingPhase,
  ingestFix, parseFix, setDriverStatus, LIFECYCLE, DriverStatus,
} from '../services/driverTracking';

const router = Router();

function tokenOf(req: Request): string | undefined {
  return (req.query.t as string | undefined) || (req.body?.t as string | undefined);
}

// GET /api/tracking/:booking_number?t= — customer view
router.get('/:booking_number', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'cust', tokenOf(req))) {
      res.status(403).json({ error: 'Invalid tracking token' });
      return;
    }
    const b = await loadBookingByNumber(bn);
    if (!b) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.json(await buildCustomerView(b));
  } catch (error: any) {
    console.error('Tracking GET error:', error?.message);
    res.status(500).json({ error: 'Failed to load tracking' });
  }
});

// POST /api/tracking/:booking_number/customer-location — customer opted in to share GPS
router.post('/:booking_number/customer-location', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'cust', tokenOf(req))) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    const fix = parseFix(req.body, 'web');
    if (!fix) {
      res.status(400).json({ error: 'lat and lng required' });
      return;
    }
    const b = await loadBookingByNumber(bn);
    const s = await getTrackingSettings();
    if (!b || !s.share_customer_location || trackingPhase(b, s) !== 'active'
      || b.driver_status === 'onboard' || b.driver_status === 'completed') {
      res.json({ ok: false });
      return;
    }
    if (fix.accuracy != null && fix.accuracy > s.max_accuracy_m) {
      res.json({ ok: false, reason: 'inaccurate' });
      return;
    }
    await run(
      `UPDATE bookings SET customer_lat = ?, customer_lng = ?, customer_accuracy = ?, customer_location_updated_at = NOW() WHERE id = ?`,
      [fix.lat, fix.lng, fix.accuracy, b.id]
    );
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Customer location error:', error?.message);
    res.status(500).json({ error: 'Failed to update customer location' });
  }
});

// DELETE /api/tracking/:booking_number/customer-location?t= — customer stops sharing
router.delete('/:booking_number/customer-location', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'cust', tokenOf(req))) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    await run(
      `UPDATE bookings SET customer_lat = NULL, customer_lng = NULL, customer_accuracy = NULL, customer_location_updated_at = NULL WHERE booking_number = ?`,
      [bn]
    );
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/tracking/:booking_number/driver?t= — single-ride driver page
router.get('/:booking_number/driver', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'drv', tokenOf(req))) {
      res.status(403).json({ error: 'Invalid driver token' });
      return;
    }
    const b = await loadBookingByNumber(bn);
    if (!b) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    const s = await getTrackingSettings();
    const phase = trackingPhase(b, s);
    res.set('Cache-Control', 'no-store');
    res.json({ phase, ride: phase === 'active' || phase === 'too_early' ? await buildDriverRideView(b, { live: true }) : null });
  } catch (error: any) {
    console.error('Driver ride GET error:', error?.message);
    res.status(500).json({ error: 'Failed to load ride' });
  }
});

// POST /api/tracking/:booking_number/driver/status — { t, status }
router.post('/:booking_number/driver/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'drv', tokenOf(req))) {
      res.status(403).json({ error: 'Invalid driver token' });
      return;
    }
    const to = req.body?.status as DriverStatus;
    if (!LIFECYCLE.includes(to)) {
      res.status(400).json({ error: 'Ungültiger Status' });
      return;
    }
    const b = await loadBookingByNumber(bn);
    if (!b) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    const s = await getTrackingSettings();
    if (trackingPhase(b, s) !== 'active') {
      res.status(409).json({ error: 'Diese Fahrt ist nicht (mehr) aktiv' });
      return;
    }
    const r = await setDriverStatus(b, to, 'driver');
    if (!r.ok) {
      res.status(409).json({ error: r.error });
      return;
    }
    const fresh = await loadBookingByNumber(bn);
    res.json({ ok: true, ride: await buildDriverRideView(fresh, { live: true }) });
  } catch (error: any) {
    console.error('Driver status error:', error?.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// POST /api/tracking/:booking_number/location — single-ride driver pushes GPS
router.post('/:booking_number/location', async (req: Request, res: Response): Promise<void> => {
  try {
    const bn = req.params.booking_number;
    if (!verifyToken(bn, 'drv', tokenOf(req))) {
      res.status(403).json({ error: 'Invalid driver token' });
      return;
    }
    const fix = parseFix(req.body, 'web');
    if (!fix) {
      res.status(400).json({ error: 'lat and lng required' });
      return;
    }
    const b = await loadBookingByNumber(bn);
    if (!b) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    const r = await ingestFix(b, fix, b.assigned_driver_id ? Number(b.assigned_driver_id) : null);
    res.json({ ok: true, stored: r.stored, reason: r.reason || null, status: b.driver_status || 'assigned' });
  } catch (error: any) {
    console.error('Tracking location error:', error?.message);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router;
