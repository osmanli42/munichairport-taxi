// Shared invoice (Rechnung) generation + delivery.
//
// Used by two callers that must behave identically:
//   1. POST /api/admin/bookings/:id/rechnung — admin sends manually
//   2. autoRechnungJob — customer ticked "Rechnung für Ihr Unternehmen?" at booking
//      time and the ride is over
//
// Both persist the render parameters alongside the invoice number, so the exact
// same PDF can be reproduced later via GET /api/admin/bookings/:id/rechnung.pdf.

import { query, run } from '../db';
import { fetchBankSettings, generateRechnungPdf, buildRechnungEmail } from './rechnung';

const FROM_EMAIL = 'info@flughafen-muenchen.taxi';

export type Zahlungsart = 'bar' | 'kreditkarte' | 'ueberweisung';

// Next invoice number for today: WEB-YYYYMMDD-NNN. The sequence resets daily and
// only advances once a Rechnung has actually been sent, so numbering stays gapless
// (GoBD). Derived by scanning already-issued numbers — callers must persist the
// returned number before requesting another one.
export async function nextRechnungsnummer(): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `WEB-${datePart}-`;
  const rows = await query<{ rechnung_number: string }>(
    'SELECT rechnung_number FROM bookings WHERE rechnung_number LIKE ?',
    [`${prefix}%`]
  );
  let maxN = 0;
  for (const r of rows) {
    const m = r.rechnung_number?.slice(prefix.length).match(/^(\d+)$/);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  return `${prefix}${String(maxN + 1).padStart(3, '0')}`;
}

// Defaults derived from the booking itself, so the automated path needs no admin input.
export function defaultsFromBooking(booking: any): {
  mwst: 0 | 7 | 19;
  lang: 'de' | 'en';
  zahlungsart: Zahlungsart;
  empfaenger_adresse: string | undefined;
} {
  // generateRechnungPdf prefers booking.steuersatz anyway; mirror it here so the
  // value we persist matches what the PDF actually printed.
  const steuersatz = Number(booking.steuersatz);
  return {
    mwst: [0, 7, 19].includes(steuersatz) ? (steuersatz as 0 | 7 | 19) : 19,
    lang: booking.language === 'en' ? 'en' : 'de',
    zahlungsart: booking.payment_method === 'card' ? 'kreditkarte' : 'bar',
    empfaenger_adresse: booking.rechnung_adresse || undefined,
  };
}

// Bookings currently being invoiced. The cron and the manual "abschließen" path run
// in the same process and can target the same booking within the same minute;
// rechnung_number is only written after a successful send, so without this claim both
// could mail the customer. Cleared in the finally block below.
const inFlight = new Set<number>();

export async function sendRechnungForBooking(
  booking: any,
  opts: {
    rechnungsnummer?: string;
    mwst?: 0 | 7 | 19;
    lang?: 'de' | 'en';
    zahlungsart?: Zahlungsart;
    empfaenger_adresse?: string;
    force?: boolean;
  } = {}
): Promise<{ rechnungsnummer: string }> {
  if (!booking?.email) throw new Error('Buchung hat keine E-Mail-Adresse');
  if (inFlight.has(booking.id)) throw new Error('Rechnung wird für diese Buchung bereits versendet');
  inFlight.add(booking.id);
  try {
    return await doSendRechnung(booking, opts);
  } finally {
    inFlight.delete(booking.id);
  }
}

async function doSendRechnung(
  booking: any,
  opts: {
    rechnungsnummer?: string;
    mwst?: 0 | 7 | 19;
    lang?: 'de' | 'en';
    zahlungsart?: Zahlungsart;
    empfaenger_adresse?: string;
    force?: boolean;
  }
): Promise<{ rechnungsnummer: string }> {
  // The caller's row may be stale: the cron reads its whole batch up front, so a
  // booking invoiced manually mid-batch would still look unsent. Re-check before
  // spending an invoice number — regardless of whether the caller passed an explicit
  // rechnungsnummer, since that used to bypass this check entirely and caused a real
  // double-send (customer got two invoice emails for the same ride). Only opts.force
  // is allowed to bypass it now, for a deliberate, explicit re-issue.
  const [fresh] = await query<{ rechnung_number: string | null }>(
    'SELECT rechnung_number FROM bookings WHERE id = ?', [booking.id]
  );
  if (fresh?.rechnung_number && !opts.force) {
    if (!opts.rechnungsnummer) {
      // Silent path (cron / auto-complete trigger): already sent, nothing to do.
      return { rechnungsnummer: fresh.rechnung_number };
    }
    // Explicit path (admin manually issuing via the Rechnung form): block clearly
    // instead of silently resending, so the admin sees why nothing new went out.
    throw new Error(`Für diese Buchung wurde bereits eine Rechnung gesendet (${fresh.rechnung_number}). Zum bewussten erneuten Versand "force" bestätigen.`);
  }

  const d = defaultsFromBooking(booking);
  const rechnungsnummer = opts.rechnungsnummer?.trim() || (await nextRechnungsnummer());
  const mwst = opts.mwst ?? d.mwst;
  const lang = opts.lang ?? d.lang;
  const zahlungsart = opts.zahlungsart ?? d.zahlungsart;
  const empfaenger_adresse = opts.empfaenger_adresse ?? d.empfaenger_adresse;

  // Issue date == send time, and it is what we persist, so a later re-render of this
  // invoice reproduces the same Datum/Zahlungsziel.
  const sentAt = new Date();

  const s = await fetchBankSettings();
  const pdfBuffer = await generateRechnungPdf({
    booking, rechnungsnummer, mwst, lang, s, empfaenger_adresse, zahlungsart,
    invoice_date: sentAt,
  });

  const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY);
  const subject = lang === 'en'
    ? `Your Invoice ${rechnungsnummer} – Munich Airport Taxi`
    : `Ihre Rechnung ${rechnungsnummer} – Flughafen München Taxi`;
  const htmlBody = buildRechnungEmail({ booking, rechnungsnummer, mwst, lang, s, zahlungsart });

  const { error: sendError } = await resend.emails.send({
    from: `Flughafen München Taxi <${FROM_EMAIL}>`,
    to: booking.email,
    subject,
    html: htmlBody,
    attachments: [{
      filename: `Rechnung_${rechnungsnummer}.pdf`,
      content: pdfBuffer.toString('base64'),
    }],
  });
  // Resend reports API-level failures in `error` rather than throwing — an unchecked
  // send silently looks successful, which has bitten this project before.
  if (sendError) throw new Error(`Resend: ${sendError.message}`);

  // Only mark as sent after the mail actually went out.
  await run(
    `UPDATE bookings
       SET rechnung_number = ?, rechnung_sent_at = ?, rechnung_mwst = ?,
           rechnung_sprache = ?, rechnung_zahlungsart = ?, rechnung_error = NULL
     WHERE id = ?`,
    [
      rechnungsnummer,
      sentAt.toISOString().slice(0, 19).replace('T', ' '),
      mwst, lang, zahlungsart, booking.id,
    ]
  );

  return { rechnungsnummer };
}
