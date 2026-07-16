import { Router, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import {
  parseIcsEvents,
  fetchCalendarEvents,
  parseEventToDraft,
  hasServiceAccount,
  RawEvent,
  CompanyRef,
  AliasRef,
} from '../services/calendarImport';

const router = Router();

const CALENDAR_ID_KEY = 'google_calendar_id';

function generateBookingNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CAL${year}${month}${day}-${random}`;
}

async function loadMatchData(): Promise<{ companies: CompanyRef[]; aliases: AliasRef[] }> {
  const companies = await query(
    `SELECT id, company_name FROM companies WHERE status = 'active' ORDER BY company_name`
  );
  const aliases = await query('SELECT company_id, alias FROM company_aliases');
  return { companies, aliases };
}

// Dominanter Steuersatz je Firma aus bisherigen Buchungen (sonst 7% Flughafentransfer)
async function loadDefaultSteuersaetze(): Promise<Map<number, number>> {
  const rows = await query(
    `SELECT company_id, steuersatz, COUNT(*) AS cnt FROM bookings
     WHERE company_id IS NOT NULL AND steuersatz IS NOT NULL
     GROUP BY company_id, steuersatz ORDER BY cnt DESC`
  );
  const map = new Map<number, number>();
  for (const r of rows) {
    if (!map.has(Number(r.company_id))) map.set(Number(r.company_id), Number(r.steuersatz));
  }
  return map;
}

async function buildDraftResponse(rawEvents: RawEvent[]) {
  const { companies, aliases } = await loadMatchData();
  const defaults = await loadDefaultSteuersaetze();

  const uids = rawEvents.map((e) => e.uid).filter(Boolean);
  const existingUids = new Set<string>();
  if (uids.length > 0) {
    const placeholders = uids.map(() => '?').join(',');
    const rows = await query(
      `SELECT calendar_event_uid FROM bookings WHERE calendar_event_uid IN (${placeholders})`,
      uids
    );
    for (const r of rows) existingUids.add(r.calendar_event_uid);
  }

  const drafts = rawEvents.map((raw) => {
    const draft = parseEventToDraft(raw, companies, aliases);
    draft.steuersatz = draft.company_id ? defaults.get(draft.company_id) ?? 7 : 7;
    return { ...draft, already_imported: existingUids.has(draft.uid) };
  });

  return { drafts, companies };
}

// ─── GET /events?month=YYYY-MM — Fahrten direkt aus Google Calendar laden ────

router.get('/events', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) { res.status(400).json({ error: 'month required (YYYY-MM)' }); return; }
    if (!hasServiceAccount()) {
      res.status(400).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON ist nicht konfiguriert. Bitte ICS-Upload verwenden.' });
      return;
    }
    const [setting] = await query('SELECT setting_value FROM settings WHERE setting_key = ?', [CALENDAR_ID_KEY]);
    const calendarId = setting?.setting_value;
    if (!calendarId) { res.status(400).json({ error: 'Keine Kalender-ID hinterlegt (Einstellungen).' }); return; }

    const rawEvents = await fetchCalendarEvents(calendarId, month);
    res.json(await buildDraftResponse(rawEvents));
  } catch (error: any) {
    console.error('Calendar events fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch calendar events' });
  }
});

// ─── POST /parse-ics — Fallback: exportierte .ics-Datei hochladen ────────────

router.post('/parse-ics', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { icsContent, month } = req.body as { icsContent?: string; month?: string };
    if (!icsContent || typeof icsContent !== 'string') {
      res.status(400).json({ error: 'icsContent string required' });
      return;
    }
    let rawEvents = parseIcsEvents(icsContent);
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      rawEvents = rawEvents.filter((e) => e.start && e.start.startsWith(month));
    }
    res.json(await buildDraftResponse(rawEvents));
  } catch (error: any) {
    console.error('ICS parse error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse ICS' });
  }
});

// ─── POST /import — geprüfte Entwürfe als bookings anlegen ───────────────────

interface ImportRide {
  uid: string;
  pickup_datetime: string;
  company_id: number;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  steuersatz?: number;
  vehicle_type?: string;
  notes?: string;
  guest_name?: string;
  save_alias?: boolean;
  alias_text?: string;
}

router.post('/import', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rides } = req.body as { rides?: ImportRide[] };
    if (!Array.isArray(rides) || rides.length === 0) {
      res.status(400).json({ error: 'rides array required' });
      return;
    }

    let imported = 0;
    let skippedDuplicates = 0;
    const errors: { uid: string; error: string }[] = [];

    for (const ride of rides) {
      try {
        if (!ride.uid || !ride.pickup_datetime || !ride.company_id || !(Number(ride.price) > 0)) {
          errors.push({ uid: ride.uid || '?', error: 'Firma, Datum und Preis sind Pflichtfelder' });
          continue;
        }
        if (!ride.pickup_address?.trim() || !ride.dropoff_address?.trim()) {
          errors.push({ uid: ride.uid, error: 'Von/Nach-Adresse fehlt' });
          continue;
        }

        const [existing] = await query('SELECT id FROM bookings WHERE calendar_event_uid = ?', [ride.uid]);
        if (existing) { skippedDuplicates++; continue; }

        const [company] = await query('SELECT * FROM companies WHERE id = ?', [ride.company_id]);
        if (!company) { errors.push({ uid: ride.uid, error: `Firma ${ride.company_id} nicht gefunden` }); continue; }

        const steuersatz = [0, 7, 19].includes(Number(ride.steuersatz)) ? Number(ride.steuersatz) : 7;

        await run(
          `INSERT INTO bookings (
            booking_number, status, pickup_address, dropoff_address, pickup_datetime,
            vehicle_type, passengers, name, phone, email, notes, price, payment_method,
            language, trip_type, steuersatz, company_id,
            source, calendar_event_uid, imported_at
          ) VALUES (?, 'confirmed', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'invoice', 'de', 'oneway', ?, ?, 'calendar', ?, NOW())`,
          [
            generateBookingNumber(),
            ride.pickup_address.trim(),
            ride.dropoff_address.trim(),
            ride.pickup_datetime,
            ride.vehicle_type || 'kombi',
            ride.guest_name?.trim() || company.contact_name || company.company_name,
            company.phone || '',
            company.email || '',
            ride.notes || null,
            Math.round(Number(ride.price) * 100) / 100,
            steuersatz,
            ride.company_id,
            ride.uid,
          ]
        );
        imported++;

        if (ride.save_alias && ride.alias_text?.trim()) {
          await run(
            `INSERT INTO company_aliases (company_id, alias) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE company_id = VALUES(company_id)`,
            [ride.company_id, ride.alias_text.trim().slice(0, 191)]
          );
        }
      } catch (rowErr: any) {
        // UNIQUE-Index auf calendar_event_uid fängt Race-Duplikate ab
        if (rowErr.message?.includes('Duplicate entry')) skippedDuplicates++;
        else errors.push({ uid: ride.uid, error: rowErr.message || 'Insert failed' });
      }
    }

    res.json({ imported, skipped_duplicates: skippedDuplicates, errors });
  } catch (error: any) {
    console.error('Calendar import error:', error);
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

// ─── Alias-Verwaltung (Eventtext → Firma) ────────────────────────────────────

router.get('/aliases', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const aliases = await query(
      `SELECT ca.id, ca.alias, ca.company_id, c.company_name
       FROM company_aliases ca LEFT JOIN companies c ON ca.company_id = c.id
       ORDER BY c.company_name, ca.alias`
    );
    res.json(aliases);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch aliases' });
  }
});

router.delete('/aliases/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM company_aliases WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete alias' });
  }
});

// ─── GET/PUT /settings — Kalender-ID (Service-Account-Key nur als Boolean) ───

router.get('/settings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [setting] = await query('SELECT setting_value FROM settings WHERE setting_key = ?', [CALENDAR_ID_KEY]);
    res.json({
      calendar_id: setting?.setting_value || '',
      service_account_configured: hasServiceAccount(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { calendar_id } = req.body as { calendar_id?: string };
    if (typeof calendar_id !== 'string') { res.status(400).json({ error: 'calendar_id string required' }); return; }
    await run(
      `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [CALENDAR_ID_KEY, calendar_id.trim()]
    );
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
