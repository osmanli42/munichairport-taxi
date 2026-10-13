// Stornorechnung (GoBD): an issued invoice is never deleted, edited or renumbered. It is
// cancelled by a separate document with its own gapless number (ST-YYYY-NNNN) that stores a
// snapshot of what the original said — recipient, positions, amounts, VAT, date. The PDF is
// always rendered from that snapshot.
//
// Single-ride invoices keep their bookings.rechnung_number (so autoRechnungJob never issues a
// second invoice by itself); a Sammelrechnung gets status 'storniert', which frees its rides
// for a new invoice.

import { query, run, withTransaction, nextSequenceValue } from '../db';
import { customerRecipient } from '../utils/recipient';
import { formatPhoneDisplay } from '../utils/phone';
import { fetchBankSettings, generateStornoPdf, roundGrossPrice, fmtDate, fmtPrice, isRoundtripBooking, StornoLine } from './rechnung';
import { berlinDateSql } from '../utils/berlinTime';

const FROM_EMAIL = 'info@flughafen-muenchen.taxi';

export interface StornoRow {
  id: number;
  storno_number: string;
  kind: 'single' | 'sammel';
  booking_id: number | null;
  company_invoice_id: number | null;
  original_number: string;
  original_date: string | null;
  amount: number;
  lang: 'de' | 'en';
  lines_json: string;
  recipient_json: string;
  reason: string | null;
  sent_to: string | null;
  sent_at: string | null;
  send_error: string | null;
  created_by: string | null;
  created_at: string;
}

const rate = (v: unknown): 0 | 7 | 19 | null => ([0, 7, 19].includes(Number(v)) && v !== null && v !== '' ? Number(v) as 0 | 7 | 19 : null);

async function createStorno(row: {
  kind: 'single' | 'sammel';
  booking_id?: number | null;
  company_invoice_id?: number | null;
  original_number: string;
  // Passed through as read from MySQL (Date or string), so it is written back unchanged.
  original_date: string | Date | null;
  lang: 'de' | 'en';
  lines: StornoLine[];
  recipient: string[];
  reason?: string | null;
  created_by?: string | null;
}, alsoInTx?: (conn: any) => Promise<void>): Promise<StornoRow> {
  const amount = Math.round(row.lines.reduce((s, l) => s + l.gross, 0) * 100) / 100;
  const id = await withTransaction(async (conn) => {
    const year = berlinDateSql(0).slice(0, 4);
    const n = await nextSequenceValue(conn, `storno_${year}`);
    const number = `ST-${year}-${String(n).padStart(4, '0')}`;
    const [res] = await conn.execute(
      `INSERT INTO invoice_cancellations
         (storno_number, kind, booking_id, company_invoice_id, original_number, original_date, amount, lang,
          lines_json, recipient_json, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [number, row.kind, row.booking_id ?? null, row.company_invoice_id ?? null, row.original_number,
        row.original_date, amount, row.lang, JSON.stringify(row.lines), JSON.stringify(row.recipient),
        row.reason?.trim() || null, row.created_by ?? null]
    );
    if (alsoInTx) await alsoInTx(conn);
    return (res as any).insertId as number;
  });
  const [created] = await query<StornoRow>('SELECT * FROM invoice_cancellations WHERE id = ?', [id]);
  return created;
}

export async function getStorno(id: number): Promise<StornoRow | null> {
  const [row] = await query<StornoRow>('SELECT * FROM invoice_cancellations WHERE id = ?', [id]);
  return row || null;
}

export async function renderStornoPdf(st: StornoRow): Promise<Buffer> {
  let bookingNumber: string | null = null;
  if (st.booking_id) {
    const [b] = await query<{ booking_number: string }>('SELECT booking_number FROM bookings WHERE id = ?', [st.booking_id]);
    bookingNumber = b?.booking_number || null;
  }
  return generateStornoPdf({
    storno_number: st.storno_number,
    storno_date: st.created_at,
    original_number: st.original_number,
    original_date: st.original_date,
    booking_number: bookingNumber,
    lang: st.lang === 'en' ? 'en' : 'de',
    recipient: JSON.parse(st.recipient_json || '[]'),
    lines: JSON.parse(st.lines_json || '[]'),
    reason: st.reason,
    s: await fetchBankSettings(),
  });
}

/** Mails the Stornorechnung; records sent_at / send_error. Returns the error text, if any. */
export async function sendStornoEmail(st: StornoRow, to: string): Promise<string | null> {
  const isEn = st.lang === 'en';
  try {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt');
    const s = await fetchBankSettings();
    const pdf = await renderStornoPdf(st);
    const amount = fmtPrice(-Number(st.amount));
    const origDate = st.original_date ? fmtDate(new Date(st.original_date).toISOString(), st.lang) : '';
    const body = isEn
      ? `<p>Dear Sir or Madam,</p>
         <p>please find attached the cancellation invoice <strong>${st.storno_number}</strong> for invoice
         <strong>${st.original_number}</strong>${origDate ? ` dated ${origDate}` : ''}. The invoice is cancelled in full (${amount}).</p>
         ${st.reason ? `<p>Reason: ${escapeHtml(st.reason)}</p>` : ''}
         <p>Kind regards,<br>${escapeHtml(s.company_name || 'Taxi N&N GbR')}</p>`
      : `<p>Sehr geehrte Damen und Herren,</p>
         <p>anbei erhalten Sie die Stornorechnung <strong>${st.storno_number}</strong> zur Rechnung
         <strong>${st.original_number}</strong>${origDate ? ` vom ${origDate}` : ''}. Die Rechnung ist damit vollständig storniert (${amount}).</p>
         ${st.reason ? `<p>Grund: ${escapeHtml(st.reason)}</p>` : ''}
         <p>Mit freundlichen Grüßen,<br>${escapeHtml(s.company_name || 'Taxi N&N GbR')}</p>`;
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px 12px;background:#eef2f7;font-family:Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
          <tr><td style="background:#0c2d48;padding:24px 32px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:22px">Flughafen-muenchen.<span style="color:#fbbf24">TAXI</span></h1>
          </td></tr>
          <tr><td style="padding:28px 32px;color:#374151;font-size:15px;line-height:1.6">${body}</td></tr>
          <tr><td style="background:#f9fafb;padding:14px 32px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb">
            Flughafen-muenchen.TAXI · Eisvogelweg 2, 85356 Freising · +49 151 41620000 · info@flughafen-muenchen.taxi
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    const { Resend } = await import('resend');
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `Flughafen München Taxi <${FROM_EMAIL}>`,
      to: st.kind === 'single' ? customerRecipient(to) : to,
      subject: isEn
        ? `Cancellation invoice ${st.storno_number} for invoice ${st.original_number}`
        : `Stornorechnung ${st.storno_number} zur Rechnung ${st.original_number}`,
      html,
      attachments: [{ filename: `${isEn ? 'Cancellation' : 'Stornorechnung'}_${st.storno_number}.pdf`, content: pdf.toString('base64') }],
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    await run('UPDATE invoice_cancellations SET sent_to = ?, sent_at = NOW(), send_error = NULL WHERE id = ?', [to, st.id]);
    return null;
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 500);
    await run('UPDATE invoice_cancellations SET send_error = ? WHERE id = ?', [msg, st.id]);
    return msg;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// ─── Single-ride invoice ─────────────────────────────────────────────────────

/** The storno already issued for this booking's current invoice number, if any. */
export async function stornoForBookingInvoice(bookingId: number, number: string): Promise<StornoRow | null> {
  const [row] = await query<StornoRow>(
    `SELECT * FROM invoice_cancellations WHERE kind = 'single' AND booking_id = ? AND original_number = ? ORDER BY id DESC LIMIT 1`,
    [bookingId, number]
  );
  return row || null;
}

export async function stornoSingleInvoice(
  bookingId: number,
  opts: { reason?: string | null; send?: boolean; createdBy?: string | null } = {}
): Promise<{ storno: StornoRow; existed: boolean; emailError: string | null }> {
  const [b] = await query<any>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!b) throw new Error('Buchung nicht gefunden');
  if (!b.rechnung_number) throw new Error('Für diese Buchung wurde keine Rechnung gesendet.');

  const existing = await stornoForBookingInvoice(b.id, b.rechnung_number);
  if (existing) return { storno: existing, existed: true, emailError: null };

  const lang: 'de' | 'en' = b.rechnung_sprache === 'en' ? 'en' : 'de';
  const isEn = lang === 'en';
  // Same precedence as generateRechnungPdf: the ride's own tax rate wins.
  const mwst = rate(b.steuersatz) ?? rate(b.rechnung_mwst) ?? 19;
  const gross = b.rechnung_amount != null
    ? Number(b.rechnung_amount)
    : roundGrossPrice(Number(b.price) || 0, b.source === 'calendar');

  const pickup = b.pickup_datetime ? fmtDate(b.pickup_datetime, lang) : '';
  const roundtrip = isRoundtripBooking(b);
  const sub = [
    `${isEn ? 'From:' : 'Von:'} ${b.pickup_address || ''}`,
    `${isEn ? 'To:' : 'Nach:'} ${b.dropoff_address || ''}`,
    roundtrip
      ? `${isEn ? 'Outbound' : 'Hinfahrt'}: ${pickup} · ${isEn ? 'Return' : 'Rückfahrt'}: ${fmtDate(b.return_datetime, lang)}`
      : `${isEn ? 'Date:' : 'Datum:'} ${pickup}`,
  ];
  const lines: StornoLine[] = [{
    desc: roundtrip
      ? (isEn ? 'Airport Transfer Munich – Return Trip' : 'Flughafentransfer München – Hin- und Rückfahrt')
      : (isEn ? 'Airport Transfer Munich' : 'Flughafentransfer München'),
    sub, gross, rate: mwst,
  }];

  const addr = String(b.rechnung_adresse || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const recipient = addr.length
    ? addr
    : [b.name || '—', b.email || '', b.phone ? formatPhoneDisplay(b.phone) : ''].filter(Boolean);

  const storno = await createStorno({
    kind: 'single', booking_id: b.id, original_number: b.rechnung_number,
    original_date: b.rechnung_sent_at || null,
    lang, lines, recipient, reason: opts.reason, created_by: opts.createdBy,
  });
  console.log(`[storno] ${storno.storno_number} for ${b.rechnung_number} (booking ${b.booking_number}) by ${opts.createdBy || '?'}`);

  let emailError: string | null = null;
  if (opts.send) {
    if (!b.email) emailError = 'Buchung hat keine E-Mail-Adresse';
    else emailError = await sendStornoEmail(storno, b.email);
  }
  return { storno: (await getStorno(storno.id))!, existed: false, emailError };
}

// ─── Sammelrechnung ──────────────────────────────────────────────────────────

export async function stornoCompanyInvoice(
  invoiceId: number,
  opts: { reason?: string | null; send?: boolean; email?: string | null; createdBy?: string | null } = {}
): Promise<{ storno: StornoRow; emailError: string | null }> {
  const [inv] = await query<any>('SELECT * FROM company_invoices WHERE id = ?', [invoiceId]);
  if (!inv) throw new Error('Rechnung nicht gefunden');
  if (inv.status === 'storniert') throw new Error('Diese Rechnung ist bereits storniert.');
  const [company] = await query<any>('SELECT * FROM companies WHERE id = ?', [inv.company_id]);
  if (!company) throw new Error('Firma nicht gefunden');

  const ids: number[] = JSON.parse(inv.booking_ids || '[]');
  const bookings = ids.length
    ? await query<any>(`SELECT price, source, steuersatz FROM bookings WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
    : [];
  const lang: 'de' | 'en' = inv.lang === 'en' ? 'en' : 'de';
  const isEn = lang === 'en';
  const defaultRate = rate(inv.mwst_satz) ?? 19;

  // Same grouping as generateSammelrechnungPdf: per-ride rate, gross rounded the same way.
  const groups = new Map<0 | 7 | 19, { gross: number; n: number }>();
  for (const b of bookings) {
    const r = rate(b.steuersatz) ?? defaultRate;
    const g = groups.get(r) || { gross: 0, n: 0 };
    g.gross += roundGrossPrice(Number(b.price) || 0, b.source === 'calendar');
    g.n += 1;
    groups.set(r, g);
  }
  const mahngebuehr = Number(inv.mahngebuehr) || 0;
  const baseLines: StornoLine[] = Array.from(groups.entries()).sort((a, b) => b[0] - a[0]).map(([r, g]) => ({
    desc: isEn ? `Collective invoice ${inv.invoice_number}` : `Sammelrechnung ${inv.invoice_number}`,
    sub: [
      `${isEn ? 'Period' : 'Leistungszeitraum'}: ${inv.period_month}`,
      `${g.n} ${isEn ? (g.n === 1 ? 'ride' : 'rides') : (g.n === 1 ? 'Fahrt' : 'Fahrten')}${groups.size > 1 ? ` · ${r} % ${isEn ? 'VAT' : 'MwSt.'}` : ''}`,
      ...(inv.project_name ? [`${isEn ? 'Project' : 'Projekt'}: ${inv.project_name}`] : []),
    ],
    gross: Math.round(g.gross * 100) / 100,
    rate: r,
  }));
  // The positions must add up to what the invoice actually billed (total minus the fee);
  // if rides were edited afterwards, put the stored total on the record instead.
  const billed = Math.round((Number(inv.total) - mahngebuehr) * 100) / 100;
  const sumLines = Math.round(baseLines.reduce((s, l) => s + l.gross, 0) * 100) / 100;
  const lines: StornoLine[] = baseLines.length && sumLines === billed
    ? baseLines
    : [{
        desc: isEn ? `Collective invoice ${inv.invoice_number}` : `Sammelrechnung ${inv.invoice_number}`,
        sub: [`${isEn ? 'Period' : 'Leistungszeitraum'}: ${inv.period_month}`, `${ids.length} ${isEn ? 'rides' : 'Fahrten'}`],
        gross: billed, rate: defaultRate,
      }];
  if (mahngebuehr > 0) {
    lines.push({ desc: isEn ? 'Reminder fee' : 'Mahngebühr', sub: [], gross: mahngebuehr, rate: 0 });
  }

  const recipient = [company.company_name, company.contact_name, company.address,
    company.ust_idnr ? `${isEn ? 'VAT ID' : 'USt-IdNr.'}: ${company.ust_idnr}` : '']
    .map((l) => String(l || '').trim()).filter(Boolean);

  const storno = await createStorno({
    kind: 'sammel', company_invoice_id: inv.id, original_number: inv.invoice_number,
    original_date: inv.created_at || null,
    lang, lines, recipient, reason: opts.reason, created_by: opts.createdBy,
  }, async (conn) => {
    await conn.execute(`UPDATE company_invoices SET status = 'storniert' WHERE id = ?`, [inv.id]);
  });
  console.log(`[storno] ${storno.storno_number} for ${inv.invoice_number} (${company.company_name}) by ${opts.createdBy || '?'}`);

  let emailError: string | null = null;
  if (opts.send) {
    const to = String(opts.email || company.invoice_email || company.email || '').trim();
    emailError = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? await sendStornoEmail(storno, to) : 'Keine gültige E-Mail-Adresse';
  }
  return { storno: (await getStorno(storno.id))!, emailError };
}

export async function listStornos(limit = 200): Promise<any[]> {
  return query<any>(
    `SELECT ic.id, ic.storno_number, ic.kind, ic.booking_id, ic.company_invoice_id, ic.original_number,
            ic.original_date, ic.amount, ic.reason, ic.sent_to, ic.sent_at, ic.send_error, ic.created_by, ic.created_at,
            b.booking_number, b.name AS booking_name, c.company_name
       FROM invoice_cancellations ic
       LEFT JOIN bookings b ON b.id = ic.booking_id
       LEFT JOIN company_invoices ci ON ci.id = ic.company_invoice_id
       LEFT JOIN companies c ON c.id = ci.company_id
      ORDER BY ic.id DESC LIMIT ${Math.max(1, Math.min(1000, Math.floor(limit)))}`
  );
}
