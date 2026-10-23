// Buchungsmails nachsenden: Wenn beim Buchen die Admin- oder Kundenmail nicht rausging
// (Resend kurz nicht erreichbar, Neustart mitten im Versand …), holt dieser Job das alle
// 5 Minuten nach. Nach 4 erfolglosen Versuchen: einmal WhatsApp an den Admin und ein
// Eintrag unter Dashboard → „Handlungsbedarf“ (routes/admin-dashboard.ts, mailFailed).
//
// Nur Buchungen mit mail_attempts IS NOT NULL (seit Einführung gesetzt) — ältere nie.

import cron from 'node-cron';
import { query, run } from '../db';
import { buildCustomerMailData } from './bookingConfirmed';
import { sendAdminNotification, sendCustomerConfirmation, sendAdminWhatsApp, markBookingMails } from './notifications';
import { bookingConfirmUrl } from '../utils/bookingConfirmToken';

export const MAIL_MAX_ATTEMPTS = 4;
let running = false;

export async function retryBookingMails(): Promise<number> {
  if (running) return 0;
  running = true;
  let done = 0;
  try {
    const rows = await query<any>(
      `SELECT * FROM bookings
        WHERE mail_attempts IS NOT NULL AND mail_attempts < ?
          AND (mail_admin_sent_at IS NULL OR mail_customer_sent_at IS NULL)
          AND status <> 'cancelled'
          AND created_at < NOW() - INTERVAL 3 MINUTE AND created_at > NOW() - INTERVAL 2 DAY
        ORDER BY id LIMIT 20`,
      [MAIL_MAX_ATTEMPTS]
    );
    for (const b of rows) {
      const data = await buildCustomerMailData(b);
      try { data.confirm_url = bookingConfirmUrl(b.booking_number); } catch { /* no JWT secret */ }
      const errors: string[] = [];
      let adminOk = !!b.mail_admin_sent_at;
      let customerOk = !!b.mail_customer_sent_at;
      if (!adminOk) {
        try { await sendAdminNotification(data); adminOk = true; } catch (e: any) { errors.push(`Admin: ${e?.message || e}`); }
      }
      if (!customerOk) {
        try { await sendCustomerConfirmation(data); customerOk = true; } catch (e: any) { errors.push(`Kunde: ${e?.message || e}`); }
      }
      await markBookingMails(b.id, adminOk, customerOk, errors.join(' | '));
      console.log(`[MailRetry] ${b.booking_number}: Admin ${adminOk ? 'ok' : 'FEHLER'}, Kunde ${customerOk ? 'ok' : 'FEHLER'}`);
      if (adminOk && customerOk) done++;
      else if (Number(b.mail_attempts) + 1 >= MAIL_MAX_ATTEMPTS) {
        await sendAdminWhatsApp([
          `MAIL NICHT ZUGESTELLT ${b.booking_number}`,
          `${b.name} - ${b.email}`,
          !customerOk ? 'Kundenbestaetigung fehlt - bitte im Admin manuell senden' : 'Admin-Mail fehlt',
        ].map((l) => encodeURIComponent(l)).join('%0A')).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[MailRetry] error:', e);
  } finally {
    running = false;
  }
  return done;
}

export function startMailRetryJob(): void {
  cron.schedule('*/5 * * * *', () => { retryBookingMails().catch(() => {}); });
}
