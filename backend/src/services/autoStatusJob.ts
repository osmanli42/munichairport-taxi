import cron from 'node-cron';
import { query, run } from '../db';
import { chargeSavedCard, getCompanyForCharge } from './stripeCards';

const BERLIN_TZ = 'Europe/Berlin';

// Date -> 'YYYY-MM-DDTHH:mm:ss' in Europe/Berlin, matching the format pickup_datetime
// is stored in (see frontend buchen/page.tsx `${date}T${time}:00` and
// calendarImport.ts's toBerlinLocal) — needed because pickup_datetime is a plain
// VARCHAR of local wall-clock time, not a real DATETIME, so NOW() can't compare to
// it directly without first converting to the same Berlin-local, zero-padded shape.
function toBerlinLocalSeconds(date: Date): string {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BERLIN_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
  return s.replace(' ', 'T');
}

interface ConfirmedRow {
  id: number;
  company_id: number | null;
  payment_method: string;
  price: number;
  charge_status: string | null;
}

async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await query<{ setting_value: string }>(
    'SELECT setting_value FROM settings WHERE setting_key = ?', [key]
  );
  return row?.setting_value ?? fallback;
}

export function startAutoStatusJob(): void {
  cron.schedule('* * * * *', async () => {
    try {
      const enabled = await getSetting('auto_status_enabled', '0');
      if (enabled !== '1') return;

      const confirmHours = parseFloat(await getSetting('auto_confirm_hours', '1')) || 1;
      const bufferMinutes = parseInt(await getSetting('auto_complete_buffer_minutes', '0'), 10) || 0;
      const includeCompanyCharge = (await getSetting('auto_complete_include_company_charge', '0')) === '1';

      // Step A: Neu -> Bestätigt. Pure DB field update, no side effects — safe to
      // run as a single idempotent SQL statement (see admin.ts PATCH /status: the
      // 'confirmed' branch has no email/charge logic).
      const confirmResult = await run(
        `UPDATE bookings SET status = 'confirmed' WHERE status = 'new' AND created_at <= NOW() - INTERVAL ? HOUR`,
        [confirmHours]
      );
      if (confirmResult.affectedRows > 0) {
        console.log(`[AutoStatus] ${confirmResult.affectedRows} Buchung(en) auto-bestätigt`);
      }

      // Step B: Bestätigt -> Abgeschlossen. Per-row, because company card-on-file
      // bookings billed "on_completion" trigger a real Stripe charge (see admin.ts
      // PATCH /status) and must be skippable via auto_complete_include_company_charge.
      const threshold = toBerlinLocalSeconds(new Date(Date.now() - bufferMinutes * 60000));
      const candidates = await query<ConfirmedRow>(
        `SELECT id, company_id, payment_method, price, charge_status FROM bookings
         WHERE status = 'confirmed' AND pickup_datetime <= ?`,
        [threshold]
      );

      let completedCount = 0;
      for (const booking of candidates) {
        const company = booking.company_id ? await getCompanyForCharge(booking.company_id) : null;
        const isOnCompletionCharge =
          booking.payment_method === 'card' && company?.charge_mode === 'on_completion' && !!company.stripe_payment_method_id;

        if (isOnCompletionCharge && !includeCompanyCharge) {
          continue; // stays 'confirmed' — manual "Abschließen" required
        }

        await run('UPDATE bookings SET status = ? WHERE id = ?', ['completed', booking.id]);
        completedCount++;

        if (isOnCompletionCharge && booking.charge_status !== 'succeeded' && company) {
          chargeSavedCard(booking.id, company, Number(booking.price)).catch(err =>
            console.error('[AutoStatus] On-completion charge error:', err)
          );
        }
      }
      if (completedCount > 0) {
        console.log(`[AutoStatus] ${completedCount} Buchung(en) auto-abgeschlossen`);
      }
    } catch (err: any) {
      console.error('[AutoStatus] Cron-Fehler:', err?.message);
    }
  });

  console.log('[AutoStatus] Cron job gestartet — jede Minute prüfen (auto_status_enabled Einstellung steuert Aktivierung)');
}
