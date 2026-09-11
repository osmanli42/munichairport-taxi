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

// Next proforma number for today: PRO-YYYYMMDD-NNN. Deliberately a SEPARATE series from
// the WEB-… invoice numbers: a proforma is not an invoice under §14 UStG, so it must not
// consume a slot in the gapless invoice sequence, and it is never written to
// rechnung_number (which would make autoRechnungJob skip the real invoice entirely).
export async function nextProformaNummer(): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `PRO-${datePart}-`;
  const rows = await query<{ proforma_number: string }>(
    'SELECT proforma_number FROM bookings WHERE proforma_number LIKE ?',
    [`${prefix}%`]
  );
  let maxN = 0;
  for (const r of rows) {
    const m = r.proforma_number?.slice(prefix.length).match(/^(\d+)$/);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  return `${prefix}${String(maxN + 1).padStart(3, '0')}`;
}

// Payment deadline for a proforma: the money has to be on our account before the ride,
// so the due date is one day before pickup. For rides less than a day away there is no
// room left — fall back to today, and the admin can see it is effectively "immediately".
export function proformaDueDate(booking: any): Date {
  const pickup = booking.pickup_datetime ? new Date(booking.pickup_datetime) : null;
  const today = new Date();
  if (!pickup || isNaN(pickup.getTime())) return today;
  const due = new Date(pickup);
  due.setDate(due.getDate() - 1);
  return due.getTime() < today.getTime() ? today : due;
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
    zahlungsart: booking.payment_method === 'card'
      ? 'kreditkarte'
      : booking.payment_method === 'ueberweisung' ? 'ueberweisung' : 'bar',
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

  // Only mark as sent after the mail actually went out. rechnung_adresse must be
  // persisted here too — it was missing before, so a custom address typed straight
  // into the admin's send form (rather than pre-filled from the booking's own
  // rechnung_adresse column) made it into the actual PDF/email but then vanished
  // from the DB, so re-rendering the "sent" invoice later fell back to name+email
  // and silently dropped the customer's real billing address.
  await run(
    `UPDATE bookings
       SET rechnung_number = ?, rechnung_sent_at = ?, rechnung_mwst = ?,
           rechnung_sprache = ?, rechnung_zahlungsart = ?, rechnung_adresse = ?, rechnung_error = NULL
     WHERE id = ?`,
    [
      rechnungsnummer,
      sentAt.toISOString().slice(0, 19).replace('T', ' '),
      mwst, lang, zahlungsart, empfaenger_adresse || null, booking.id,
    ]
  );

  return { rechnungsnummer };
}

// ─── PROFORMA ────────────────────────────────────────────────────────────────
//
// Sent BEFORE the ride to a customer paying by bank transfer: they pay against the
// proforma, and once the ride is over the normal invoice flow (autoRechnungJob) mails
// the real WEB-… invoice, which then prints "Bereits per Überweisung bezahlt" provided
// an admin has confirmed the incoming payment.
//
// Its own in-flight guard: a proforma and a real invoice for the same booking are
// different documents and may legitimately be in flight at the same time.
const proformaInFlight = new Set<number>();

export async function sendProformaForBooking(
  booking: any,
  opts: {
    proformanummer?: string;
    mwst?: 0 | 7 | 19;
    lang?: 'de' | 'en';
    empfaenger_adresse?: string;
    force?: boolean;
  } = {}
): Promise<{ proformanummer: string; due_date: string }> {
  if (!booking?.email) throw new Error('Buchung hat keine E-Mail-Adresse');
  if (proformaInFlight.has(booking.id)) throw new Error('Proforma wird für diese Buchung bereits versendet');
  proformaInFlight.add(booking.id);
  try {
    return await doSendProforma(booking, opts);
  } finally {
    proformaInFlight.delete(booking.id);
  }
}

async function doSendProforma(
  booking: any,
  opts: {
    proformanummer?: string;
    mwst?: 0 | 7 | 19;
    lang?: 'de' | 'en';
    empfaenger_adresse?: string;
    force?: boolean;
  }
): Promise<{ proformanummer: string; due_date: string }> {
  // Same stale-row guard as the invoice path: re-read before spending a number.
  const [fresh] = await query<{ proforma_number: string | null }>(
    'SELECT proforma_number FROM bookings WHERE id = ?', [booking.id]
  );
  if (fresh?.proforma_number && !opts.force) {
    throw new Error(`Für diese Buchung wurde bereits eine Proforma-Rechnung gesendet (${fresh.proforma_number}). Zum bewussten erneuten Versand "force" bestätigen.`);
  }

  const d = defaultsFromBooking(booking);
  const proformanummer = opts.proformanummer?.trim() || (await nextProformaNummer());
  const mwst = opts.mwst ?? d.mwst;
  const lang = opts.lang ?? d.lang;
  const empfaenger_adresse = opts.empfaenger_adresse ?? d.empfaenger_adresse;
  const sentAt = new Date();
  const dueDate = proformaDueDate(booking);

  const s = await fetchBankSettings();
  const pdfBuffer = await generateRechnungPdf({
    booking, rechnungsnummer: proformanummer, mwst, lang, s, empfaenger_adresse,
    // A proforma is always the bank-transfer document — that is its whole purpose.
    zahlungsart: 'ueberweisung',
    invoice_date: sentAt,
    due_date_override: dueDate,
    proforma: true,
  });

  const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY);
  const subject = lang === 'en'
    ? `Proforma Invoice ${proformanummer} – Munich Airport Taxi`
    : `Proforma-Rechnung ${proformanummer} – Flughafen München Taxi`;
  const htmlBody = buildRechnungEmail({
    booking, rechnungsnummer: proformanummer, mwst, lang, s,
    zahlungsart: 'ueberweisung', proforma: true, due_date: dueDate,
  });

  const { error: sendError } = await resend.emails.send({
    from: `Flughafen München Taxi <${FROM_EMAIL}>`,
    to: booking.email,
    subject,
    html: htmlBody,
    attachments: [{
      filename: `Proforma_${proformanummer}.pdf`,
      content: pdfBuffer.toString('base64'),
    }],
  });
  if (sendError) throw new Error(`Resend: ${sendError.message}`);

  // Only persist after the mail actually went out. rechnung_number is deliberately
  // untouched. rechnung_required is switched on so the existing auto-invoice cron mails
  // the real invoice once the ride is over — the customer paying up front should not
  // also have to have ticked the invoice box at booking time.
  // rechnung_adresse is written too (same as doSendRechnung does): if the admin edited
  // the billing address in the dialog, the real invoice that follows must carry the same
  // address as the proforma the customer already paid against.
  await run(
    `UPDATE bookings
       SET proforma_number = ?, proforma_sent_at = ?, proforma_adresse = ?,
           rechnung_adresse = COALESCE(?, rechnung_adresse),
           rechnung_sprache = ?, rechnung_mwst = ?, rechnung_required = 1
     WHERE id = ?`,
    [
      proformanummer,
      sentAt.toISOString().slice(0, 19).replace('T', ' '),
      empfaenger_adresse || null,
      empfaenger_adresse || null,
      lang, mwst, booking.id,
    ]
  );

  return { proformanummer, due_date: dueDate.toISOString().slice(0, 10) };
}
