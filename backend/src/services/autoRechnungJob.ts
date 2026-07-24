// Auto-invoice cron: mails the Rechnung to customers who requested one at booking
// time, once their ride is over.
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
const MAX_ATTEMPTS = 3;
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
  const candidates = await query<any>(
    `SELECT * FROM bookings
      WHERE rechnung_required = 1
        AND (rechnung_number IS NULL OR rechnung_number = '')
        AND status <> 'cancelled'
        AND email IS NOT NULL AND email <> ''
        AND rechnung_attempts < ?
        AND STR_TO_DATE(pickup_datetime, '%Y-%m-%dT%H:%i:%s')
            + INTERVAL (COALESCE(duration_minutes, 0) + ?) MINUTE <= ?
      ORDER BY pickup_datetime ASC
      LIMIT ${BATCH_SIZE}`,
    [MAX_ATTEMPTS, BUFFER_MINUTES, nowBerlin]
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
