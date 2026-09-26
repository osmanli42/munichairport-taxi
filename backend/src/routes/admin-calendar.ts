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
import {
  fetchEventsRange,
  classifyEvent,
  parseInvoiceRide,
  drivingDistanceKm,
  steuersatzForDistance,
} from '../services/calendarInvoice';
import { generateSammelrechnungPdf, fetchBankSettings, roundGrossPrice } from '../services/rechnung';

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

// ═══ Kalender → Rechnung: Eingangskorb ═══════════════════════════════════════
// Statt alle Termine eines Monats zu sichten, zeigt der Kalender-Tab nur noch offene
// Rechnungsfahrten ("Rechnung" im Ort-Feld, ohne "gön"/"ödendi"/"iptal"), fertig
// ausgefüllt und nach Kunde + Monat gruppiert. Import und Rechnung sind ein Schritt.

function berlinNow(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', 'T');
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function toLocalDateTime(v: any): string {
  return String(v || '').slice(0, 16).replace(' ', 'T');
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isEmail = (s: unknown): s is string => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

async function invoicedBookingMap(): Promise<Map<number, { invoice_id: number; invoice_number: string }>> {
  const rows = await query('SELECT id, invoice_number, booking_ids FROM company_invoices');
  const map = new Map<number, { invoice_id: number; invoice_number: string }>();
  for (const r of rows) {
    let ids: unknown = [];
    try { ids = JSON.parse(r.booking_ids || '[]'); } catch { ids = []; }
    if (Array.isArray(ids)) for (const id of ids) map.set(Number(id), { invoice_id: r.id, invoice_number: r.invoice_number });
  }
  return map;
}

// Für die Entfernung (MwSt) nur die eigentliche Adresse: "Roland Steinzen, Gebrüder-Ott-Weg 17,
// 81241 München" → Gastfamilie vorne weg, sonst findet Google die Adresse nicht immer.
function geoQuery(addr: string): string {
  // "Flughafen München" allein geocodiert Google auf die Münchner Innenstadt (→ Erding 41 km statt ~17)
  if (/^flughafen münchen, gat$/i.test(addr)) return 'Allgemeine Luftfahrt 1, 85356 München-Flughafen';
  const t = addr.match(/^flughafen münchen(?:, terminal (\d))?$/i);
  if (t) return `Flughafen München Terminal ${t[1] || '2'}, 85356 München-Flughafen`;
  const parts = addr.split(/\s*,\s*/);
  if (parts.length >= 3 && !/\d/.test(parts[0]) && /\d/.test(parts[1])) return parts.slice(1).join(', ');
  return addr;
}

// ─── GET /inbox?months=4 — offene Rechnungsfahrten + zuletzt erledigte ───────

router.get('/inbox', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const months = Math.min(12, Math.max(1, Number(req.query.months) || 4));
    const now = berlinNow();
    const toMonth = now.slice(0, 7);
    const fromMonth = addMonths(toMonth, -(months - 1));

    if (!hasServiceAccount()) {
      res.status(400).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON ist nicht konfiguriert.' });
      return;
    }
    const [setting] = await query('SELECT setting_value FROM settings WHERE setting_key = ?', [CALENDAR_ID_KEY]);
    const calendarId = setting?.setting_value;
    if (!calendarId) { res.status(400).json({ error: 'Keine Kalender-ID hinterlegt (Einstellungen).' }); return; }

    const [events, matchData, companies, importedRows, ignoredRows, invoices, defaults, invoiced] = await Promise.all([
      fetchEventsRange(calendarId, fromMonth, toMonth),
      loadMatchData(),
      query(`SELECT id, company_name, contact_name, address, ust_idnr, invoice_email, payment_term_days
             FROM companies WHERE status = 'active' ORDER BY company_name`),
      query(`SELECT id, booking_number, calendar_event_uid, company_id, pickup_datetime, pickup_address,
                    dropoff_address, name, price, steuersatz
             FROM bookings WHERE calendar_event_uid IS NOT NULL`),
      query('SELECT uid, note, created_at FROM calendar_invoice_ignored'),
      query(`SELECT id, company_id, invoice_number, period_month, total, status, manual_sent_at
             FROM company_invoices WHERE period_month >= ? ORDER BY invoice_number`, [fromMonth]),
      loadDefaultSteuersaetze(),
      invoicedBookingMap(),
    ]);

    const importedUids = new Set(importedRows.map((b: any) => b.calendar_event_uid));
    const ignoredUids = new Set(ignoredRows.map((r: any) => r.uid));

    // 1) Offene Rechnungsfahrten aus dem Kalender (nur bereits gefahrene)
    const openEvents = events.filter((e) =>
      (e.start || '') <= now && classifyEvent(e) === 'open' && !importedUids.has(e.uid) && !ignoredUids.has(e.uid)
    );
    const rides = await Promise.all(openEvents.map(async (ev) => {
      const p = parseInvoiceRide(ev, matchData.companies, matchData.aliases);
      const warnings: string[] = [];
      const km = p.pickup_address && p.dropoff_address
        ? await drivingDistanceKm(geoQuery(p.pickup_address), geoQuery(p.dropoff_address))
        : null;
      let steuersatz: number;
      let mwstSource: 'distance' | 'default';
      if (km !== null) { steuersatz = steuersatzForDistance(km); mwstSource = 'distance'; }
      else { steuersatz = (p.company_id ? defaults.get(p.company_id) : undefined) ?? 7; mwstSource = 'default'; }

      if (!p.price) warnings.push('price_missing');
      if (!p.pickup_address || !p.dropoff_address) warnings.push('route_missing');
      if (p.price_conflict) warnings.push('price_conflict');
      if (p.stopover) warnings.push(km !== null && km > 35 && km <= 50 ? 'stopover_mwst' : 'stopover');
      // Google nimmt die schnellste Route — knapp um 50 km kann die gefahrene Strecke anders liegen
      else if (km !== null && km >= 48 && km <= 53) warnings.push('mwst_borderline');
      if (km === null && p.pickup_address && p.dropoff_address) warnings.push('no_distance');
      if (!p.company_id) warnings.push(p.billing ? 'new_customer' : 'customer_missing');

      return {
        key: `cal:${p.uid}`,
        kind: 'calendar' as const,
        booking_id: null as number | null,
        booking_number: null as string | null,
        ...p,
        steuersatz,
        distance_km: km,
        mwst_source: mwstSource,
        price_note: null as string | null,
        warnings,
      };
    }));

    // "(H+R)" = Preis für Hin- und Rückfahrt. Liegen genau beide Fahrten offen im Korb,
    // wird der Preis aufgeteilt (so wurde es bei SySt im Juni abgerechnet: 170 € → 2 × 85 €).
    const hrGroups = new Map<string, typeof rides>();
    for (const r of rides) {
      if (!r.round_trip_hint || !r.price) continue;
      const key = `${r.company_id ?? r.billing?.name ?? '?'}|${r.price}`;
      hrGroups.set(key, [...(hrGroups.get(key) || []), r]);
    }
    for (const group of hrGroups.values()) {
      for (const r of group) {
        if (group.length === 2) {
          r.price_note = `${String(r.price).replace('.', ',')} € (H+R) ÷ 2`;
          r.price = round2(r.price! / 2);
          r.warnings.push('hr_split');
        } else {
          r.warnings.push('hr');
        }
      }
    }

    // 2) Bereits übernommene Firmenfahrten ohne Rechnung (z.B. Rechnung gelöscht)
    const unbilledRows = await query(
      `SELECT id, booking_number, company_id, pickup_datetime, pickup_address, dropoff_address, name, price,
              steuersatz, source, calendar_event_uid
       FROM bookings
       WHERE company_id IS NOT NULL AND status <> 'cancelled' AND payment_method IN ('invoice', 'rechnung')
         AND pickup_datetime >= ? AND pickup_datetime <= ?`,
      [`${fromMonth}-01`, now]
    );
    const unbilled = unbilledRows
      .filter((b: any) => !invoiced.has(Number(b.id)))
      .map((b: any) => {
        const dt = toLocalDateTime(b.pickup_datetime);
        return {
          key: `bk:${b.id}`,
          kind: 'booking' as const,
          booking_id: Number(b.id),
          booking_number: b.booking_number,
          uid: b.calendar_event_uid || null,
          html_link: null,
          pickup_datetime: dt,
          month: dt.slice(0, 7),
          summary: '', location: '', description: '',
          tag: null,
          company_id: Number(b.company_id),
          company_via: null,
          billing: null,
          email_candidates: [] as string[],
          pickup_address: b.pickup_address,
          dropoff_address: b.dropoff_address,
          guest_name: b.name,
          price: Number(b.price),
          price_source: 'Buchung',
          price_conflict: null,
          round_trip_hint: false,
          stopover: null,
          steuersatz: b.steuersatz ?? defaults.get(Number(b.company_id)) ?? 7,
          distance_km: null,
          mwst_source: 'booking',
          price_note: null,
          warnings: ['unbilled_booking'],
        };
      });

    const open = [...rides, ...unbilled].sort((a, b) => ((a.pickup_datetime || '') < (b.pickup_datetime || '') ? -1 : 1));

    // 3) Erledigt: im Zeitraum übernommene Kalenderfahrten mit Rechnungsnummer
    const done = importedRows
      .filter((b: any) => b.company_id && toLocalDateTime(b.pickup_datetime) >= `${fromMonth}-01`)
      .map((b: any) => ({
        booking_id: Number(b.id),
        booking_number: b.booking_number,
        uid: b.calendar_event_uid,
        pickup_datetime: toLocalDateTime(b.pickup_datetime),
        pickup_address: b.pickup_address,
        dropoff_address: b.dropoff_address,
        guest_name: b.name,
        price: Number(b.price),
        company_id: b.company_id ? Number(b.company_id) : null,
        invoice: invoiced.get(Number(b.id)) || null,
      }))
      .sort((a: any, b: any) => (a.pickup_datetime < b.pickup_datetime ? 1 : -1));

    const eventsByUid = new Map(events.map((e) => [e.uid, e]));
    const ignored = ignoredRows
      .filter((r: any) => eventsByUid.has(r.uid))
      .map((r: any) => {
        const e = eventsByUid.get(r.uid)!;
        return { uid: r.uid, note: r.note, pickup_datetime: e.start, summary: e.summary, location: e.location, html_link: e.htmlLink };
      });

    res.json({
      window: { from: fromMonth, to: toMonth, months },
      fetched_at: new Date().toISOString(),
      calendar_events: events.length,
      open,
      done,
      ignored,
      companies,
      invoices,
    });
  } catch (error: any) {
    console.error('Calendar inbox error:', error);
    res.status(500).json({ error: error.message || 'Kalender konnte nicht geladen werden' });
  }
});

// ─── Rechnung aus dem Eingangskorb: Validierung (für Vorschau und Erstellen) ─

interface InvoiceRideInput {
  uid: string;
  pickup_datetime: string;
  pickup_address: string;
  dropoff_address: string;
  guest_name?: string;
  price: number;
  steuersatz: number;
  notes?: string;
}

interface InvoiceBody {
  company_id?: number;
  new_company?: { company_name?: string; address?: string; contact_name?: string; ust_idnr?: string };
  alias?: string;
  invoice_email?: string;
  project_name?: string;
  rides?: InvoiceRideInput[];
  booking_ids?: number[];
}

interface InvoiceDraft {
  company: any | null; // bestehende Firma
  newCompany: { company_name: string; address: string; contact_name: string; ust_idnr: string | null } | null;
  rides: InvoiceRideInput[];
  existingBookings: any[];
  month: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function buildInvoiceDraft(body: InvoiceBody): Promise<InvoiceDraft> {
  const rides = Array.isArray(body.rides) ? body.rides : [];
  const bookingIds = Array.isArray(body.booking_ids) ? body.booking_ids.map(Number).filter((n) => n > 0) : [];
  if (rides.length + bookingIds.length === 0) throw new HttpError(400, 'Keine Fahrten ausgewählt');

  for (const r of rides) {
    if (!r.uid || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.pickup_datetime || '')) throw new HttpError(400, 'Datum fehlt');
    if (!r.pickup_address?.trim() || !r.dropoff_address?.trim()) throw new HttpError(400, 'Von/Nach-Adresse fehlt');
    if (!(Number(r.price) > 0)) throw new HttpError(400, 'Preis fehlt');
    if (![0, 7, 19].includes(Number(r.steuersatz))) throw new HttpError(400, 'Ungültiger MwSt-Satz');
  }

  let company: any = null;
  let newCompany: InvoiceDraft['newCompany'] = null;
  if (body.company_id) {
    [company] = await query(`SELECT * FROM companies WHERE id = ? AND status = 'active'`, [body.company_id]);
    if (!company) throw new HttpError(404, 'Firma nicht gefunden');
  } else if (body.new_company?.company_name?.trim()) {
    const name = body.new_company.company_name.trim().slice(0, 200);
    // gleicher Name schon vorhanden → keine Dublette anlegen
    [company] = await query(`SELECT * FROM companies WHERE LOWER(company_name) = LOWER(?) AND status = 'active'`, [name]);
    if (!company) {
      newCompany = {
        company_name: name,
        address: (body.new_company.address || '').trim(),
        contact_name: (body.new_company.contact_name || '').trim() || name,
        ust_idnr: body.new_company.ust_idnr?.trim() || null,
      };
    }
  } else {
    throw new HttpError(400, 'Kunde fehlt');
  }

  let existingBookings: any[] = [];
  if (bookingIds.length) {
    if (!company) throw new HttpError(400, 'Buchungen gehören zu keiner bestehenden Firma');
    existingBookings = await query(
      `SELECT * FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')}) AND company_id = ? AND status <> 'cancelled'`,
      [...bookingIds, company.id]
    );
    if (existingBookings.length !== bookingIds.length) throw new HttpError(400, 'Buchung gehört nicht zu dieser Firma');
    const invoiced = await invoicedBookingMap();
    const already = existingBookings.find((b) => invoiced.has(Number(b.id)));
    if (already) throw new HttpError(409, `Buchung ${already.booking_number} ist bereits in ${invoiced.get(Number(already.id))!.invoice_number}`);
  }

  const monthsInvolved = new Set([
    ...rides.map((r) => r.pickup_datetime.slice(0, 7)),
    ...existingBookings.map((b) => toLocalDateTime(b.pickup_datetime).slice(0, 7)),
  ]);
  if (monthsInvolved.size !== 1) throw new HttpError(400, 'Eine Rechnung darf nur Fahrten aus einem Monat enthalten');
  const month = [...monthsInvolved][0];

  if (rides.length) {
    const taken = await query(
      `SELECT calendar_event_uid FROM bookings WHERE calendar_event_uid IN (${rides.map(() => '?').join(',')})`,
      rides.map((r) => r.uid)
    );
    if (taken.length) throw new HttpError(409, 'Mindestens eine Fahrt wurde bereits übernommen — bitte neu laden');
  }

  return { company, newCompany, rides, existingBookings, month };
}

// CAL-Nummern sind zufällig (4 Ziffern je Tag) — bei mehreren Fahrten pro Request Kollision ausschließen
async function uniqueBookingNumber(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const n = generateBookingNumber();
    const [hit] = await query('SELECT id FROM bookings WHERE booking_number = ?', [n]);
    if (!hit) return n;
  }
  throw new Error('Keine freie Buchungsnummer gefunden');
}

async function nextInvoiceNumber(companyId: number, month: string): Promise<string> {
  const base = `SR-${month.replace('-', '')}-${companyId}`;
  const rows = await query('SELECT invoice_number FROM company_invoices WHERE invoice_number = ? OR invoice_number LIKE ?', [base, `${base}-%`]);
  const taken = new Set(rows.map((r: any) => r.invoice_number));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

function dueDateFor(company: any): string {
  const d = new Date();
  d.setDate(d.getDate() + (Number(company?.payment_term_days) || 7));
  return d.toISOString().slice(0, 10);
}

function invoiceTotal(bookings: any[]): number {
  return round2(bookings.reduce((sum, b) => sum + roundGrossPrice(Number(b.price) || 0, b.source === 'calendar'), 0));
}

function dominantRate(bookings: any[]): number {
  const counts = new Map<number, number>();
  for (const b of bookings) {
    const r = [0, 7, 19].includes(Number(b.steuersatz)) ? Number(b.steuersatz) : 7;
    counts.set(r, (counts.get(r) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 7;
}

function rideAsBooking(r: InvoiceRideInput, bookingNumber: string) {
  return {
    booking_number: bookingNumber,
    pickup_datetime: r.pickup_datetime,
    pickup_address: r.pickup_address.trim(),
    dropoff_address: r.dropoff_address.trim(),
    name: r.guest_name?.trim() || '',
    price: round2(Number(r.price)),
    steuersatz: Number(r.steuersatz),
    source: 'calendar',
  };
}

// ─── POST /invoice-preview — PDF-Entwurf, nichts wird gespeichert ────────────

router.post('/invoice-preview', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const draft = await buildInvoiceDraft(req.body as InvoiceBody);
    const c = draft.company || draft.newCompany!;
    const number = draft.company ? await nextInvoiceNumber(draft.company.id, draft.month) : `SR-${draft.month.replace('-', '')}-neu`;
    const bookings = [...draft.existingBookings, ...draft.rides.map((r) => rideAsBooking(r, 'neu'))]
      .sort((a, b) => (toLocalDateTime(a.pickup_datetime) < toLocalDateTime(b.pickup_datetime) ? -1 : 1));
    const pdf = await generateSammelrechnungPdf({
      company: { company_name: c.company_name, contact_name: c.contact_name, address: c.address, ust_idnr: c.ust_idnr || undefined },
      invoiceNumber: `ENTWURF ${number}`,
      periodMonth: draft.month,
      mwst: dominantRate(bookings) as 0 | 7 | 19,
      bookings,
      total: invoiceTotal(bookings),
      dueDate: dueDateFor(draft.company),
      mahngebuehr: 0,
      reminderLevel: 0,
      s: await fetchBankSettings(),
      projectName: (req.body as InvoiceBody).project_name?.trim() || null,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Entwurf_${number}.pdf`);
    res.send(pdf);
  } catch (error: any) {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    console.error('Invoice preview error:', error);
    res.status(500).json({ error: error.message || 'Vorschau fehlgeschlagen' });
  }
});

// ─── POST /invoice — Kunde (ggf. neu) + Fahrten übernehmen + Rechnung in einem Schritt ─

router.post('/invoice', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const createdBookingIds: number[] = [];
  let createdCompanyId: number | null = null;
  try {
    const body = req.body as InvoiceBody;
    const draft = await buildInvoiceDraft(body);

    let company = draft.company;
    if (!company && draft.newCompany) {
      // companies.email = eigene Adresse wie bei den übrigen Kalender-Kunden, damit keine
      // automatische Mail (Mahnung, Buchungsmail) beim Kunden landet. Versand an den Kunden
      // läuft nur bewusst über "Senden" mit invoice_email.
      const [own] = await query(
        `SELECT c.email, COUNT(*) AS n FROM companies c JOIN company_aliases a ON a.company_id = c.id
         WHERE c.email <> '' GROUP BY c.email ORDER BY n DESC LIMIT 1`
      );
      const nc = draft.newCompany;
      const result = await run(
        `INSERT INTO companies (company_name, contact_name, email, phone, address, ust_idnr, status, created_at)
         VALUES (?, ?, ?, '', ?, ?, 'active', NOW())`,
        [nc.company_name, nc.contact_name, own?.email || '', nc.address, nc.ust_idnr]
      );
      createdCompanyId = result.insertId;
      [company] = await query('SELECT * FROM companies WHERE id = ?', [createdCompanyId]);
    }

    for (const r of draft.rides) {
      const b = rideAsBooking(r, await uniqueBookingNumber());
      const result = await run(
        `INSERT INTO bookings (
          booking_number, status, pickup_address, dropoff_address, pickup_datetime,
          vehicle_type, passengers, name, phone, email, notes, price, payment_method,
          language, trip_type, steuersatz, company_id,
          source, calendar_event_uid, imported_at
        ) VALUES (?, 'completed', ?, ?, ?, 'kombi', 1, ?, ?, ?, ?, ?, 'invoice', 'de', 'oneway', ?, ?, 'calendar', ?, NOW())`,
        [
          b.booking_number, b.pickup_address, b.dropoff_address, b.pickup_datetime,
          b.name || company.contact_name || company.company_name,
          company.phone || '', company.email || '',
          r.notes?.slice(0, 1000) || null,
          b.price, b.steuersatz, company.id, r.uid,
        ]
      );
      createdBookingIds.push(result.insertId);
    }

    const allIds = [...draft.existingBookings.map((b) => Number(b.id)), ...createdBookingIds];
    const bookings = await query(
      `SELECT * FROM bookings WHERE id IN (${allIds.map(() => '?').join(',')}) ORDER BY pickup_datetime`,
      allIds
    );
    const invoiceNumber = await nextInvoiceNumber(company.id, draft.month);
    await run(
      `INSERT INTO company_invoices (company_id, invoice_number, period_month, mwst_satz, booking_ids, total, due_date, status, project_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)`,
      [
        company.id, invoiceNumber, draft.month, dominantRate(bookings),
        JSON.stringify(bookings.map((b: any) => Number(b.id))), invoiceTotal(bookings),
        dueDateFor(company), body.project_name?.trim() || null,
      ]
    );

    // Ab hier ist die Rechnung angelegt — Komfortdaten dürfen sie nicht mehr zurückrollen
    if (body.alias?.trim()) {
      await run(
        `INSERT INTO company_aliases (company_id, alias) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE company_id = VALUES(company_id)`,
        [company.id, body.alias.trim().slice(0, 191)]
      ).catch((e) => console.error('Alias speichern fehlgeschlagen:', e.message));
    }
    if (isEmail(body.invoice_email)) {
      await run('UPDATE companies SET invoice_email = ? WHERE id = ?', [body.invoice_email.trim(), company.id])
        .catch((e) => console.error('invoice_email speichern fehlgeschlagen:', e.message));
    }

    const [invoice] = await query('SELECT * FROM company_invoices WHERE invoice_number = ?', [invoiceNumber]);
    res.json({ invoice, company: { id: company.id, company_name: company.company_name, created: !!createdCompanyId } });
  } catch (error: any) {
    // Nichts halb angelegt zurücklassen
    if (createdBookingIds.length) {
      await run(`DELETE FROM bookings WHERE id IN (${createdBookingIds.map(() => '?').join(',')})`, createdBookingIds).catch(() => {});
    }
    if (createdCompanyId) await run('DELETE FROM companies WHERE id = ?', [createdCompanyId]).catch(() => {});
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (String(error.message).includes('Duplicate entry')) {
      res.status(409).json({ error: 'Fahrt oder Rechnungsnummer existiert bereits — bitte neu laden' });
      return;
    }
    console.error('Calendar invoice error:', error);
    res.status(500).json({ error: error.message || 'Rechnung konnte nicht erstellt werden' });
  }
});

// ─── Fahrt aus dem Korb nehmen (wird nicht über das System abgerechnet) ──────

router.post('/ignore', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { uid, note } = req.body as { uid?: string; note?: string };
    if (!uid) { res.status(400).json({ error: 'uid required' }); return; }
    await run(
      `INSERT INTO calendar_invoice_ignored (uid, note) VALUES (?, ?) ON DUPLICATE KEY UPDATE note = VALUES(note)`,
      [uid.slice(0, 191), note?.trim().slice(0, 255) || null]
    );
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to ignore ride' });
  }
});

router.delete('/ignore/:uid', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM calendar_invoice_ignored WHERE uid = ?', [req.params.uid]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to restore ride' });
  }
});

// ─── Rechnungs-E-Mail des Kunden merken (Vorbelegung beim nächsten Versand) ──

router.put('/companies/:id/invoice-email', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!isEmail(email)) { res.status(400).json({ error: 'Gültige E-Mail-Adresse erforderlich' }); return; }
    await run('UPDATE companies SET invoice_email = ? WHERE id = ?', [email.trim(), req.params.id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save invoice email' });
  }
});

export default router;
