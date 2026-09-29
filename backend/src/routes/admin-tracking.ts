// Admin side of live tracking: drivers, settings, live board, alert feed, and the
// per-booking controls shown in the booking modal. Mounted at /api/admin/tracking.

import { Router, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { newTraccarDeviceId } from '../utils/trackingToken';
import {
  getTrackingSettings, saveTrackingSettings, DEFAULT_SETTINGS, TrackingSettings, ALERT_KINDS,
  MEETING_POINT_KEYS, LIFECYCLE, DriverStatus, loadBookingById, setDriverStatus, trackingPhase,
  resolvePickup, flightFor, buildAdminLive, customerTrackingUrl, singleRideDriverUrl, driverAppUrl,
  traccarServerUrl, recordEvent,
} from '../services/driverTracking';
import { sendTrackingCustomerEmail } from '../services/trackingEmails';

const router = Router();
router.use(authenticateAdmin);

const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// ─── settings ───────────────────────────────────────────────────────────────

router.get('/settings', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({
      settings: await getTrackingSettings(),
      defaults: DEFAULT_SETTINGS,
      traccar_server_url: traccarServerUrl(),
      admin_email_default: process.env.ADMIN_EMAIL || 'info@flughafen-muenchen.taxi',
      email_configured: !!process.env.RESEND_API_KEY,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cur = await getTrackingSettings();
    const b = req.body || {};
    const bool = (k: keyof TrackingSettings) => (typeof b[k] === 'boolean' ? b[k] : (cur as any)[k]);
    const next: TrackingSettings = {
      ...cur,
      enabled: bool('enabled'),
      share_customer_location: bool('share_customer_location'),
      mail_enroute: bool('mail_enroute'),
      mail_arrived: bool('mail_arrived'),
      auto_onboard: bool('auto_onboard'),
      auto_finish: bool('auto_finish'),
      complete_booking_on_finish: bool('complete_booking_on_finish'),
      arrival_radius_m: clampNum(b.arrival_radius_m, 30, 1000, cur.arrival_radius_m),
      good_accuracy_m: clampNum(b.good_accuracy_m, 10, 300, cur.good_accuracy_m),
      max_accuracy_m: clampNum(b.max_accuracy_m, 50, 5000, cur.max_accuracy_m),
      gps_lost_minutes: clampNum(b.gps_lost_minutes, 1, 60, cur.gps_lost_minutes),
      retention_hours: clampNum(b.retention_hours, 1, 24 * 30, cur.retention_hours),
      link_open_hours_before: clampNum(b.link_open_hours_before, 1, 24 * 14, cur.link_open_hours_before),
      link_close_hours_after: clampNum(b.link_close_hours_after, 0, 48, cur.link_close_hours_after),
      admin_email_to: typeof b.admin_email_to === 'string' ? b.admin_email_to.trim().slice(0, 200) : cur.admin_email_to,
      admin: { ...cur.admin },
      meeting_points: { ...cur.meeting_points },
      airport_generic_text: { ...cur.airport_generic_text, ...(b.airport_generic_text || {}) },
    };
    if (next.admin_email_to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.admin_email_to)) {
      res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
      return;
    }
    for (const kind of ALERT_KINDS) {
      const a = b.admin?.[kind];
      if (a) next.admin[kind] = { sound: !!a.sound, email: !!a.email };
    }
    for (const key of MEETING_POINT_KEYS) {
      const m = b.meeting_points?.[key];
      if (!m) continue;
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      // Keep pins near the airport — a slip on the map must not send drivers elsewhere.
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat - 48.354) > 0.05 || Math.abs(lng - 11.786) > 0.08) {
        res.status(400).json({ error: `Treffpunkt ${key.toUpperCase()}: Koordinaten liegen nicht am Flughafen München` });
        return;
      }
      next.meeting_points[key] = {
        lat, lng,
        radius_m: clampNum(m.radius_m, 50, 1000, cur.meeting_points[key].radius_m),
        label: { ...cur.meeting_points[key].label, ...(m.label || {}) },
        text: { ...cur.meeting_points[key].text, ...(m.text || {}) },
      };
    }
    res.json({ settings: await saveTrackingSettings(next) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── drivers ────────────────────────────────────────────────────────────────

async function driverRows(where = '', params: any[] = []) {
  const rows = await query<any>(
    `SELECT d.*,
        TIMESTAMPDIFF(SECOND, d.last_seen_app_at, NOW()) AS last_seen_age_s,
        TIMESTAMPDIFF(SECOND, d.last_fix_at, NOW()) AS last_fix_age_s,
        (SELECT booking_number FROM bookings WHERE assigned_driver_id = d.id AND driver_status IN ('enroute','arrived','onboard') AND status <> 'cancelled' ORDER BY driver_enroute_at DESC LIMIT 1) AS active_booking,
        (SELECT COUNT(*) FROM bookings WHERE assigned_driver_id = d.id AND status <> 'cancelled' AND (driver_status IS NULL OR driver_status <> 'completed')) AS open_rides
       FROM drivers d ${where} ORDER BY d.active DESC, d.name ASC`,
    params
  );
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    phone: d.phone || '',
    vehicle_plate: d.vehicle_plate || '',
    vehicle_model: d.vehicle_model || '',
    language: d.language || 'de',
    active: !!Number(d.active),
    app_link: driverAppUrl(d),
    traccar_device_id: d.traccar_device_id || null,
    last_seen_age_s: d.last_seen_age_s != null ? Number(d.last_seen_age_s) : null,
    last_source: d.last_source || null,
    last_fix_age_s: d.last_fix_age_s != null ? Number(d.last_fix_age_s) : null,
    last_location: d.last_lat != null && d.last_fix_age_s != null && Number(d.last_fix_age_s) < 1800
      ? { lat: Number(d.last_lat), lng: Number(d.last_lng), heading: d.last_heading != null ? Number(d.last_heading) : null, accuracy: d.last_accuracy != null ? Number(d.last_accuracy) : null }
      : null,
    active_booking: d.active_booking || null,
    open_rides: Number(d.open_rides) || 0,
  }));
}

function driverInput(body: any) {
  const lang = ['de', 'en', 'tr'].includes(body?.language) ? body.language : 'de';
  return {
    name: String(body?.name || '').trim().slice(0, 120),
    phone: String(body?.phone || '').trim().slice(0, 40),
    vehicle_plate: String(body?.vehicle_plate || '').trim().toUpperCase().slice(0, 40),
    vehicle_model: String(body?.vehicle_model || '').trim().slice(0, 80),
    language: lang,
  };
}

router.get('/drivers', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ drivers: await driverRows(), traccar_server_url: traccarServerUrl() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/drivers', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const d = driverInput(req.body);
    if (!d.name) {
      res.status(400).json({ error: 'Name ist erforderlich' });
      return;
    }
    const r = await run(
      'INSERT INTO drivers (name, phone, vehicle_plate, vehicle_model, language) VALUES (?, ?, ?, ?, ?)',
      [d.name, d.phone, d.vehicle_plate, d.vehicle_model, d.language]
    );
    const [row] = await driverRows('WHERE d.id = ?', [r.insertId]);
    res.status(201).json({ driver: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/drivers/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const d = driverInput(req.body);
    if (!d.name) {
      res.status(400).json({ error: 'Name ist erforderlich' });
      return;
    }
    const active = req.body?.active === false ? 0 : 1;
    await run(
      'UPDATE drivers SET name = ?, phone = ?, vehicle_plate = ?, vehicle_model = ?, language = ?, active = ? WHERE id = ?',
      [d.name, d.phone, d.vehicle_plate, d.vehicle_model, d.language, active, req.params.id]
    );
    const [row] = await driverRows('WHERE d.id = ?', [req.params.id]);
    if (!row) {
      res.status(404).json({ error: 'Fahrer nicht gefunden' });
      return;
    }
    res.json({ driver: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/drivers/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Open rides go back to "no driver"; finished ones keep the id for history.
    await run(
      `UPDATE bookings SET assigned_driver_id = NULL, driver_status = NULL
        WHERE assigned_driver_id = ? AND (driver_status IS NULL OR driver_status <> 'completed')`,
      [req.params.id]
    );
    await run('DELETE FROM drivers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// New personal link; every link handed out before stops working.
router.post('/drivers/:id/rotate-link', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('UPDATE drivers SET app_token_version = app_token_version + 1 WHERE id = ?', [req.params.id]);
    const [row] = await driverRows('WHERE d.id = ?', [req.params.id]);
    res.json({ driver: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/drivers/:id/traccar', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('UPDATE drivers SET traccar_device_id = ? WHERE id = ?', [newTraccarDeviceId(), req.params.id]);
    const [row] = await driverRows('WHERE d.id = ?', [req.params.id]);
    res.json({ driver: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/drivers/:id/traccar', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('UPDATE drivers SET traccar_device_id = NULL WHERE id = ?', [req.params.id]);
    const [row] = await driverRows('WHERE d.id = ?', [req.params.id]);
    res.json({ driver: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── live board + alert feed ────────────────────────────────────────────────

router.get('/live', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [live, drivers] = await Promise.all([buildAdminLive(), driverRows('WHERE d.active = 1')]);
    res.json({ ...live, drivers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const since = Number(req.query.since);
    const [maxRow] = await query<{ id: number }>('SELECT MAX(id) AS id FROM tracking_events');
    const events = Number.isFinite(since)
      ? await query<any>(
          `SELECT e.id, e.booking_id, e.booking_number, e.kind, e.detail, e.created_at, d.name AS driver_name
             FROM tracking_events e LEFT JOIN drivers d ON d.id = e.driver_id
            WHERE e.id > ? ORDER BY e.id LIMIT 20`,
          [since]
        )
      : [];
    const s = await getTrackingSettings();
    res.json({
      events,
      last_id: Number(maxRow?.id || 0),
      sound: Object.fromEntries(ALERT_KINDS.map((k) => [k, s.admin[k].sound])),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── per booking (booking modal) ────────────────────────────────────────────

async function bookingPanel(id: number) {
  const b = await loadBookingById(id);
  if (!b) return null;
  const s = await getTrackingSettings();
  const flight = await flightFor(b);
  const pickup = await resolvePickup(b, s, flight);
  let driver: any = null;
  if (b.assigned_driver_id) {
    const [d] = await query<any>('SELECT * FROM drivers WHERE id = ?', [b.assigned_driver_id]);
    if (d) driver = { id: d.id, name: d.name, phone: d.phone || '', vehicle_plate: d.vehicle_plate || '', app_link: driverAppUrl(d) };
  }
  const n = (v: any) => (v === null || v === undefined ? null : Number(v));
  return {
    booking_id: b.id,
    booking_number: b.booking_number,
    phase: trackingPhase(b, s),
    status: LIFECYCLE.includes(b.driver_status) ? b.driver_status : (b.assigned_driver_id ? 'assigned' : null),
    driver,
    timeline: { enroute: n(b.enroute_ts), arrived: n(b.arrived_ts), onboard: n(b.onboard_ts), completed: n(b.completed_ts) },
    driver_loc_age_s: n(b.driver_loc_age_s),
    driver_accuracy: n(b.driver_accuracy),
    driver_source: b.driver_source || null,
    gps_lost: !!b.tracking_gps_lost_at,
    customer_sharing: b.customer_lat != null && n(b.customer_loc_age_s) != null && Number(b.customer_loc_age_s) < 1800,
    meeting_point: b.meeting_point || null,
    resolved_pickup: pickup ? { label: pickup.meeting_point?.label.de || null, radius_m: pickup.radius_m } : null,
    airport: !!pickup?.meeting_point,
    mails: {
      link: !!b.tracking_mail_link_at,
      enroute: !!b.tracking_mail_enroute_at,
      arrived: !!b.tracking_mail_arrived_at,
    },
    links: {
      customer: customerTrackingUrl(b.booking_number, b.language),
      single_ride_driver: singleRideDriverUrl(b.booking_number, null),
    },
    customer: { name: b.name, phone: b.phone || '', email: b.email || '', language: b.language || 'de' },
  };
}

router.get('/bookings/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const panel = await bookingPanel(Number(req.params.id));
    if (!panel) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings/:id/assign', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const b = await loadBookingById(Number(req.params.id));
    if (!b) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    const driverId = req.body?.driver_id ? Number(req.body.driver_id) : null;
    if (driverId) {
      const [d] = await query<any>('SELECT id FROM drivers WHERE id = ?', [driverId]);
      if (!d) {
        res.status(404).json({ error: 'Fahrer nicht gefunden' });
        return;
      }
    }
    // Same driver again: nothing to reset (the old UI wiped the live position here).
    if (driverId !== (b.assigned_driver_id ? Number(b.assigned_driver_id) : null)) {
      await run(
        `UPDATE bookings SET assigned_driver_id = ?, driver_status = ?,
            driver_lat = NULL, driver_lng = NULL, driver_accuracy = NULL, driver_heading = NULL, driver_speed = NULL,
            driver_fix_at = NULL, driver_source = NULL, driver_location_updated_at = NULL,
            driver_enroute_at = NULL, driver_arrived_at = NULL, driver_onboard_at = NULL, driver_completed_at = NULL,
            tracking_gps_lost_at = NULL
          WHERE id = ?`,
        [driverId, driverId ? 'assigned' : null, b.id]
      );
    }
    res.json(await bookingPanel(b.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const b = await loadBookingById(Number(req.params.id));
    if (!b) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    if (!b.assigned_driver_id) {
      res.status(409).json({ error: 'Zuerst einen Fahrer zuweisen' });
      return;
    }
    const to = req.body?.status as DriverStatus;
    if (!LIFECYCLE.includes(to)) {
      res.status(400).json({ error: 'Ungültiger Status' });
      return;
    }
    const r = await setDriverStatus(b, to, 'admin');
    if (!r.ok) {
      res.status(409).json({ error: r.error });
      return;
    }
    res.json(await bookingPanel(b.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings/:id/meeting-point', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const v = req.body?.meeting_point;
    const value = v === null || v === '' || v === 'auto' ? null : v;
    if (value !== null && value !== 'address' && !MEETING_POINT_KEYS.includes(value)) {
      res.status(400).json({ error: 'Ungültiger Treffpunkt' });
      return;
    }
    await run('UPDATE bookings SET meeting_point = ? WHERE id = ?', [value, req.params.id]);
    const panel = await bookingPanel(Number(req.params.id));
    if (!panel) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    res.json(panel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// E-mail the customer their tracking link now (e.g. the evening before an airport pickup).
router.post('/bookings/:id/send-link', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const b = await loadBookingById(Number(req.params.id));
    if (!b) {
      res.status(404).json({ error: 'Buchung nicht gefunden' });
      return;
    }
    if (!b.email) {
      res.status(400).json({ error: 'Buchung hat keine E-Mail-Adresse' });
      return;
    }
    if (!process.env.RESEND_API_KEY) {
      res.status(503).json({ error: 'E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY)' });
      return;
    }
    const s = await getTrackingSettings();
    const pickup = await resolvePickup(b, s, null);
    await sendTrackingCustomerEmail('link', {
      booking: b,
      trackUrl: customerTrackingUrl(b.booking_number, b.language),
      etaMinutes: null,
      meetingPoint: pickup?.meeting_point || null,
    });
    await run('UPDATE bookings SET tracking_mail_link_at = NOW() WHERE id = ?', [b.id]);
    res.json(await bookingPanel(b.id));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Versand fehlgeschlagen' });
  }
});

// Lets the office try the alert sound/e-mail path without waiting for a real ride.
router.post('/test-alert', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = ALERT_KINDS.includes(req.body?.kind) ? req.body.kind : 'arrived';
    const [b] = await query<any>(
      `SELECT b.*, d.name AS driver_name, d.phone AS driver_phone FROM bookings b
         LEFT JOIN drivers d ON d.id = b.assigned_driver_id ORDER BY b.id DESC LIMIT 1`
    );
    if (!b) {
      res.status(404).json({ error: 'Keine Buchung vorhanden' });
      return;
    }
    await recordEvent(b, kind, 'Testalarm');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
