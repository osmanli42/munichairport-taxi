// Auto-invoice cron: mails the Rechnung once a ride is over, to
//   - customers who requested one (booking-form tickbox, or armed by the office via
//     "Automatische Rechnung" in admin — both set rechnung_required), and
//   - every cash and/or card ride, when the admin switches auto_rechnung_cash_enabled /
//     auto_rechnung_card_enabled on (Rechnung tab).
//
// "Over" is derived from the schedule rather than the booking status, because the
// status can lag (or be flipped by hand hours later): pickup time + estimated ride
// duration + a 15 min buffer for traffic.

import cron from 'node-cron';
import { query, run } from '../db';
import { berlinNowSql } from '../utils/berlinTime';
import { sendRechnungForBooking } from './rechnungSender';

// Traffic/handover buffer added on top of the estimated ride duration.
const BUFFER_MINUTES = 15;
// Give up after this many failed sends so a permanently broken address or API key
// doesn't retry every minute forever. Surfaced in the admin list as a red badge.
export const MAX_ATTEMPTS = 3;
// Cap per tick — sending is network-bound and the cron fires every minute.
const BATCH_SIZE = 20;

// Sends can outlast the one-minute interval; without this guard two overlapping
// ticks would pick up the same rows (rechnung_number is only written after a
// successful send) and mail the customer twice.
let isRunning = false;

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await query<{ setting_value: string }>(
    'SELECT setting_value FROM settings WHERE setting_key = ?', [key]
  );
  return row?.setting_value ?? fallback;
}

export async function runAutoRechnungOnce(): Promise<number> {
  // pickup_datetime is a VARCHAR of Berlin-local wall-clock time ('YYYY-MM-DDTHH:mm:ss'),
  // so it has to be parsed per row before the buffer can be added to it.
  const nowBerlin = berlinNowSql();

  // Per-payment-method switches. Each one only covers rides that end after it was switched
  // on (*_since, stamped by routes/settings.ts), so turning it on never mails the backlog
  // of old rides that were never invoiced. A missing stamp means "never on" — the far-future
  // fallback keeps that branch empty even if the flag somehow reads '1'.
  const [cardOn, cardSince, cashOn, cashSince] = await Promise.all([
    getSetting('auto_rechnung_card_enabled', '0'),
    getSetting('auto_rechnung_card_since', '9999-12-31 00:00:00'),
    getSetting('auto_rechnung_cash_enabled', '0'),
    getSetting('auto_rechnung_cash_since', '9999-12-31 00:00:00'),
  ]);

  const rideEnd = `STR_TO_DATE(pickup_datetime, '%Y-%m-%dT%H:%i:%s')
            + INTERVAL (COALESCE(duration_minutes, 0) + ${BUFFER_MINUTES}) MINUTE`;

  // Company bookings are left out of the payment-method branches: they are billed through
  // the B2B / Sammelrechnung flow, and a per-ride invoice on top would bill them twice.
  // Those branches also require a confirmed/completed booking — a ride still 'new' may
  // never have happened. Card rides whose Stripe charge failed are skipped, since the
  // invoice would print "Kreditkarte bezahlt" for money that never arrived.
  const candidates = await query<any>(
    `SELECT * FROM bookings
      WHERE (rechnung_number IS NULL OR rechnung_number = '')
        AND status <> 'cancelled'
        AND email IS NOT NULL AND email <> ''
        AND rechnung_attempts < ?
        AND ${rideEnd} <= ?
        AND (
          rechnung_required = 1
          OR (? = '1' AND company_id IS NULL AND payment_method = 'card'
              AND COALESCE(charge_status, '') <> 'failed'
              AND status IN ('confirmed', 'completed')
              AND ${rideEnd} >= ?)
          OR (? = '1' AND company_id IS NULL AND payment_method = 'cash'
              AND status IN ('confirmed', 'completed')
              AND ${rideEnd} >= ?)
        )
      ORDER BY pickup_datetime ASC
      LIMIT ${BATCH_SIZE}`,
    [MAX_ATTEMPTS, nowBerlin, cardOn, cardSince, cashOn, cashSince]
  );

  let sent = 0;
  for (const booking of candidates) {
    try {
      // Sequential on purpose: nextRechnungsnummer() reads the max issued number,
      // so each send must be persisted before the next number is drawn.
      const { rechnungsnummer } = await sendRechnungForBooking(booking);
      sent++;
      console.log(`[AutoRechnung] Rechnung ${rechnungsnummer} an ${booking.email} gesendet (Buchung ${booking.booking_number})`);
    } catch (err: any) {
      const msg = String(err?.message || err).slice(0, 500);
      await run(
        `UPDATE bookings SET rechnung_attempts = rechnung_attempts + 1, rechnung_error = ? WHERE id = ?`,
        [msg, booking.id]
      ).catch(() => {});
      console.error(`[AutoRechnung] Fehler bei Buchung ${booking.booking_number}:`, msg);
    }
  }
  return sent;
}

export function startAutoRechnungJob(): void {
  cron.schedule('* * * * *', async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      // Kill switch — flip to '0' in settings to stop auto-sending without a deploy.
      const enabled = await getSetting('auto_rechnung_enabled', '1');
      if (enabled !== '1') return;

      const sent = await runAutoRechnungOnce();
      if (sent > 0) console.log(`[AutoRechnung] ${sent} Rechnung(en) automatisch versendet`);
    } catch (err: any) {
      console.error('[AutoRechnung] Cron-Fehler:', err?.message);
    } finally {
      isRunning = false;
    }
  });

  console.log('[AutoRechnung] Cron job gestartet — jede Minute prüfen (auto_rechnung_enabled Einstellung steuert Aktivierung)');
}
