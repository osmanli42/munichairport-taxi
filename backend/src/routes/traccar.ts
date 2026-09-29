// Receiver for the free Traccar Client app (iOS/Android), which keeps sending GPS with the
// screen locked — the one thing a browser page cannot do. Configure the app with
//   Server URL:  https://flughafen-muenchen.taxi/api/traccar
//   Device ID:   the per-driver id shown in admin → Fahrer
// Both OsmAnd flavours are accepted: query/form parameters (id, lat, lon, speed in knots,
// bearing, accuracy, timestamp) and the JSON body of newer app versions
// ({ device_id, location: { coords: {...}, timestamp } }).
//
// The device id is the credential (the protocol has none). Unknown ids still get 200 so the
// app doesn't retry and drain the battery; positions of a driver without a live ride are
// not stored (see driverTracking.ingestFix).

import { Router, Request, Response } from 'express';
import { query } from '../db';
import { loadActiveRideForDriver, ingestFix, parseFix } from '../services/driverTracking';

const router = Router();

function parseTimestamp(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n < 1e11 ? n * 1000 : n;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

function extract(req: Request): { deviceId: string | null; raw: any } {
  const q: any = { ...(req.query || {}), ...(typeof req.body === 'object' && req.body && !req.body.location ? req.body : {}) };
  const body: any = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.location && typeof body.location === 'object') {
    const loc = body.location;
    const c = loc.coords || {};
    return {
      deviceId: String(body.device_id || body.deviceId || q.id || q.deviceid || '') || null,
      raw: {
        lat: c.latitude, lng: c.longitude, accuracy: c.accuracy,
        heading: c.heading, speed: c.speed, // m/s in this format
        timestamp: parseTimestamp(loc.timestamp),
      },
    };
  }
  const knots = q.speed !== undefined && q.speed !== '' ? Number(q.speed) : null;
  return {
    deviceId: String(q.id || q.deviceid || '') || null,
    raw: {
      lat: q.lat, lng: q.lon ?? q.lng, accuracy: q.accuracy,
      heading: q.bearing ?? q.heading,
      speed: knots != null && Number.isFinite(knots) ? knots * 0.514444 : null,
      timestamp: parseTimestamp(q.timestamp),
    },
  };
}

async function handle(req: Request, res: Response): Promise<void> {
  try {
    const { deviceId, raw } = extract(req);
    if (!deviceId || !/^[A-Za-z0-9_-]{8,64}$/.test(deviceId)) {
      res.status(200).end();
      return;
    }
    const [driver] = await query<{ id: number; active: number }>(
      'SELECT id, active FROM drivers WHERE traccar_device_id = ?',
      [deviceId]
    );
    if (!driver || !Number(driver.active)) {
      res.status(200).end();
      return;
    }
    const fix = parseFix(raw, 'traccar');
    if (fix) {
      const b = await loadActiveRideForDriver(driver.id);
      await ingestFix(b, fix, driver.id);
    }
    res.status(200).end();
  } catch (error: any) {
    console.error('Traccar ingest error:', error?.message);
    // 200 anyway — a 5xx makes the client queue and resend the same point forever.
    res.status(200).end();
  }
}

router.get('/', handle);
router.post('/', handle);

export default router;
