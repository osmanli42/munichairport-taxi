// Month-end reminder (dashboard → Handlungsbedarf, red): invoices that pile up over a month
// and must be sent once it is over —
//   · company customers paying "auf Rechnung": one Sammelrechnung per company and month
//     (company_invoices); a month with rides but no Sammelrechnung is open
//   · Rechnung rides from the Google Calendar that are driven but not invoiced yet
// A month counts from its last day on (Berlin), and stays until the invoices exist.
// Switch: settings.month_end_invoice_reminder ('0' = off), B2B → Einstellungen.

import { query } from '../db';
import { berlinDateSql } from '../utils/berlinTime';
import { calendarOpenInvoiceMonths } from '../routes/admin-calendar';

const SETTING = 'month_end_invoice_reminder';
// Older open months are history from before this reminder, not a to-do.
const LOOKBACK_MONTHS = 3;

export type OpenCompanyMonth = { company_id: number; company_name: string; month: string; rides: number; total: number };
export type MonthEndInvoices = { companies: OpenCompanyMonth[]; calendar: { month: string; rides: number }[] };

export async function monthEndReminderEnabled(): Promise<boolean> {
  const [row] = await query<{ setting_value: string }>('SELECT setting_value FROM settings WHERE setting_key = ?', [SETTING]);
  return row?.setting_value !== '0';
}

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Months that are due: every earlier month, and the current one on its last day. */
function dueRange(): { from: string; to: string } {
  const today = berlinDateSql(0);
  const month = today.slice(0, 7);
  const lastDay = berlinDateSql(1).slice(0, 7) !== month;
  return { from: addMonths(month, -LOOKBACK_MONTHS), to: lastDay ? month : addMonths(month, -1) };
}

export async function monthEndInvoices(): Promise<MonthEndInvoices | null> {
  if (!(await monthEndReminderEnabled())) return null;
  const { from, to } = dueRange();

  const companies = await query<any>(
    `SELECT b.company_id, c.company_name, LEFT(b.pickup_datetime, 7) AS month,
            COUNT(*) AS rides, COALESCE(SUM(b.price), 0) AS total
       FROM bookings b
       JOIN companies c ON c.id = b.company_id
      WHERE b.status <> 'cancelled'
        AND b.payment_method IN ('invoice', 'rechnung')
        AND LEFT(b.pickup_datetime, 7) BETWEEN ? AND ?
        AND NOT EXISTS (SELECT 1 FROM company_invoices ci
                         WHERE ci.company_id = b.company_id AND ci.period_month = LEFT(b.pickup_datetime, 7))
      GROUP BY b.company_id, c.company_name, LEFT(b.pickup_datetime, 7)
      ORDER BY month, c.company_name`,
    [from, to]);

  // Google may be slow or unreachable — the dashboard must not wait on it or fail.
  const cal = await Promise.race([
    calendarOpenInvoiceMonths().catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 4000)),
  ]);
  const calendar = Object.entries(cal || {})
    .filter(([m, n]) => m >= from && m <= to && n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rides]) => ({ month, rides }));

  if (!companies.length && !calendar.length) return null;
  return {
    companies: companies.map((r) => ({
      company_id: Number(r.company_id), company_name: r.company_name, month: r.month,
      rides: Number(r.rides) || 0, total: Number(r.total) || 0,
    })),
    calendar,
  };
}
