// Card rides that should already be charged but are not.
//
// Card payments for a ride are charged the day before ("Morgen abbuchen" on the dashboard),
// right after the customer reminder mails go out at 20:00. From 20:15 Berlin time, any card
// ride of tomorrow that is still open is flagged — on the
// dashboard (Handlungsbedarf) and once per day by e-mail (alert category 'card_charge').
// Today's rides that have not happened yet and are still not charged are flagged all day.

import cron from 'node-cron';
import { Resend } from 'resend';
import { query } from '../db';
import { berlinDateSql, berlinNowSql } from '../utils/berlinTime';
import { shouldSendAlert, getAlertConfig } from './alertCenter';

/** HH:mm Berlin, set in System → E-posta Uyarıları (20:15 … 23:00, default 20:15). */
export async function cardDeadline(): Promise<string> {
  return (await getAlertConfig()).card_charge_deadline;
}

export type UnchargedCard = {
  id: number;
  booking_number: string;
  name: string;
  pickup_datetime: string;
  price: number;
  company_id: number | null;
  card_brand: string | null;
  card_last4: string | null;
  charge_status: string | null;
  charge_error: string | null;
  legacy_card: boolean;   // old booking with a stored card number, no Stripe card
  day: 'today' | 'tomorrow';
};

export async function unchargedCards(): Promise<UnchargedCard[]> {
  const now = berlinNowSql();                       // 'YYYY-MM-DD HH:mm:ss'
  const today = now.slice(0, 10);
  const tomorrow = berlinDateSql(1);
  const afterDeadline = now.slice(11, 16) >= (await cardDeadline());
  const rows = await query<any>(`
    SELECT b.id, b.booking_number, b.name, b.pickup_datetime, b.price, b.company_id, b.card_brand, b.card_last4,
           b.charge_status, b.charge_error, (b.card_number_enc IS NOT NULL AND b.card_number_enc <> '') AS legacy_card
      FROM bookings b
      LEFT JOIN companies c ON c.id = b.company_id
     WHERE b.payment_method = 'card' AND b.status IN ('new', 'confirmed')
       AND COALESCE(b.charge_status, '') <> 'succeeded'
       AND (b.stripe_charge_id IS NULL OR b.stripe_charge_id = '')
       -- Companies charged after the ride (autoStatusJob) are not due the day before.
       AND COALESCE(c.charge_mode, '') <> 'on_completion'
       AND (
         (LEFT(b.pickup_datetime, 10) = ? AND REPLACE(b.pickup_datetime, 'T', ' ') >= ?)
         OR (? = 1 AND LEFT(b.pickup_datetime, 10) = ?)
       )
     ORDER BY REPLACE(b.pickup_datetime, 'T', ' ')`,
    [today, now, afterDeadline ? 1 : 0, tomorrow]);
  return rows.map((r) => ({
    ...r,
    price: Number(r.price) || 0,
    legacy_card: !!Number(r.legacy_card),
    pickup_datetime: String(r.pickup_datetime).replace(' ', 'T').slice(0, 16),
    day: String(r.pickup_datetime).slice(0, 10) === today ? 'today' : 'tomorrow',
  }));
}

const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function checkAndMail(): Promise<void> {
  // Only the live server mails — a local run works on the test DB.
  if (!process.env.RESEND_API_KEY || process.env.NODE_ENV !== 'production') return;
  const tomorrow = berlinDateSql(1);
  const list = (await unchargedCards()).filter((c) => c.day === 'tomorrow');
  if (!list.length) return;
  // One mail per day (for tomorrow's rides); the admin can switch the category off in System.
  if (!(await shouldSendAlert('card_charge', `card_charge:${tomorrow}`, 20))) return;
  const total = list.reduce((s, c) => s + c.price, 0);
  const rows = list.map((c) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:bold">${esc(c.pickup_datetime.slice(11, 16))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(c.name)}<br><span style="color:#888;font-size:12px">${esc(c.booking_number)}</span></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${c.company_id ? 'Firmenkarte' : c.card_last4 ? `${esc((c.card_brand || 'Karte').toUpperCase())} •••• ${esc(c.card_last4)}` : c.legacy_card ? 'alte Karte (manuell)' : '—'}
        ${c.charge_status === 'failed' ? `<br><span style="color:#dc2626;font-size:12px">fehlgeschlagen: ${esc(c.charge_error || '')}</span>` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold">${c.price.toFixed(2).replace('.', ',')} €</td>
    </tr>`).join('');
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `Munich Airport Taxi <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `💳 ${list.length} Kreditkarte${list.length > 1 ? 'n' : ''} für morgen noch nicht abgebucht (${total.toFixed(2).replace('.', ',')} €)`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb">
          <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #f59e0b">
            <h1 style="margin:0 0 8px;font-size:18px;color:#111">Kartenzahlungen für morgen offen</h1>
            <p style="margin:0 0 16px;color:#555;font-size:14px">Es ist nach ${await cardDeadline()} Uhr und diese Fahrten von morgen sind noch nicht abgebucht:</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
            <p style="margin:16px 0 0"><a href="https://flughafen-muenchen.taxi/admin" style="background:#1a365d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Im Admin abbuchen</a></p>
            <p style="margin:16px 0 0;color:#888;font-size:12px">Abschaltbar: Admin → System → E-Mail-Warnungen → „Kart çekilmedi“.</p>
          </div>
        </div>`,
    });
  } catch (e: any) {
    console.error('[cardChargeReminder] mail failed:', e?.message || e);
  }
}

export function startCardChargeReminderJob(): void {
  // Every 5 minutes from 20:00 to 23:55 — nothing is due before the chosen deadline; the
  // first run after it sends, the rest are stopped by the daily cooldown.
  cron.schedule('*/5 20-23 * * *', () => { checkAndMail().catch(() => {}); }, { timezone: 'Europe/Berlin' });
}
