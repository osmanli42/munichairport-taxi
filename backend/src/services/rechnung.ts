import PDFDocument from 'pdfkit';
import path from 'path';
import { query } from '../db';

// Standard-PDF-Fonts (Helvetica) unterstützen kein Türkisch (ı, ğ, ş, İ fehlen in WinAnsi).
// Work Sans (SIL OFL) deckt alle Türkisch-Zeichen ab — für Rechnungen mit türkischen Namen registriert.
const FONT_DIR = path.join(__dirname, '../assets/fonts');
function registerUnicodeFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont('WorkSans', path.join(FONT_DIR, 'WorkSans-Regular.ttf'));
  doc.registerFont('WorkSans-Bold', path.join(FONT_DIR, 'WorkSans-Bold.ttf'));
}

// ─── BANK & COMPANY SETTINGS ─────────────────────────────────────────────────

export const BANK_SETTINGS_KEYS = [
  'bank_name', 'bank_iban', 'bank_bic', 'bank_kontoinhaber',
  'company_name', 'company_address', 'company_phone', 'company_email',
  'company_steuernr', 'company_ustidnr',
];

// ─── SHARED BRANDED EMAIL WRAPPER ────────────────────────────────────────────

export function wrapBrandedEmail(opts: { title: string; bodyHtml: string }): string {
  const { title, bodyHtml } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
        <tr><td style="background:#0c2d48;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:0.5px;">Flughafen-muenchen.<span style="color:#fbbf24;">TAXI</span></h1>
          <p style="margin:8px 0 0;color:#fbbf24;font-size:14px;font-weight:600;">Firmenkundenportal</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#0c2d48;border-radius:8px;padding:18px;text-align:center;">
            <p style="margin:0 0 6px;color:#ffffff;font-size:13px;">Fragen? Wir sind für Sie da:</p>
            <p style="margin:4px 0;"><a href="tel:+4915141620000" style="color:#fbbf24;text-decoration:none;font-weight:bold;">📞 +49 151 41620000</a></p>
            <p style="margin:4px 0;"><a href="mailto:info@flughafen-muenchen.taxi" style="color:#fbbf24;text-decoration:none;font-weight:bold;">✉️ info@flughafen-muenchen.taxi</a></p>
          </div>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">
            Flughafen-muenchen.TAXI · Eisvogelweg 2, 85356 Freising<br>
            <a href="https://flughafen-muenchen.taxi" style="color:#9ca3af;">flughafen-muenchen.taxi</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function fetchBankSettings(): Promise<Record<string, string>> {
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${BANK_SETTINGS_KEYS.map(() => '?').join(',')})`,
    BANK_SETTINGS_KEYS
  );
  const s: Record<string, string> = {};
  for (const key of BANK_SETTINGS_KEYS) s[key] = '';
  for (const row of rows) s[row.setting_key] = row.setting_value;
  return s;
}

// ─── PRICE HELPERS ───────────────────────────────────────────────────────────

export function fmtPrice(amount: number): string {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Reguläre Web-Buchungen werden auf 0,50 aufgerundet (Bargeld-Handhabung). Kalender-Fahrten
// (source='calendar') sind bereits fest zugesagte Brutto-Preise (z.B. "RechnungFahrt 111,90€")
// — die dürfen NICHT verändert werden, sonst weicht die Rechnung vom zugesagten Preis ab.
export function roundGrossPrice(price: number, exact: boolean = false): number {
  if (exact) return Math.round(price * 100) / 100;
  return Math.ceil(price * 2) / 2;
}

export function fmtDate(dateStr: string, lang: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

// ─── SINGLE BOOKING RECHNUNG PDF ─────────────────────────────────────────────

export function generateRechnungPdf(opts: {
  booking: any;
  rechnungsnummer: string;
  mwst: 0 | 7 | 19;
  lang: 'de' | 'en';
  s: Record<string, string>;
  empfaenger_adresse?: string;
  zahlungsart?: 'bar' | 'kreditkarte' | 'ueberweisung';
  // Issue date of the invoice. Defaults to now for a fresh invoice; pass the stored
  // rechnung_sent_at when re-rendering an already-sent invoice so the reproduced PDF
  // carries the same Datum/Zahlungsziel the customer received.
  invoice_date?: string | Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { booking, rechnungsnummer, lang, s, empfaenger_adresse, zahlungsart } = opts;
    // The booking's own tax rate (set per ride by an admin) takes precedence over whatever
    // rate was passed in, since that's the actual applicable rate for this specific ride.
    const mwst: 0 | 7 | 19 = [0, 7, 19].includes(Number(booking.steuersatz)) ? Number(booking.steuersatz) as 0 | 7 | 19 : opts.mwst;
    const isPaid = zahlungsart === 'bar' || zahlungsart === 'kreditkarte';
    const isEn = lang === 'en';

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    registerUnicodeFonts(doc);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BRAND = '#0c2d48';
    const GRAY = '#6b7280';
    const LIGHTGRAY = '#f3f4f6';
    const pageW = doc.page.width - 100;
    const marginL = 50;
    const companyName = s.company_name || 'Taxi N&N GbR';

    // ── LOGO (above RECHNUNGSEMPFÄNGER)
    const logoY = 50;
    doc.fontSize(13).font('WorkSans-Bold');
    const logoPart1 = 'Flughafen-muenchen.';
    const logoPart2 = 'TAXI';
    const logoW = doc.widthOfString(logoPart1) + doc.widthOfString(logoPart2);
    doc.fillColor(BRAND).text(logoPart1, marginL, logoY, { continued: true, lineBreak: false });
    doc.fillColor('#fbbf24').text(logoPart2, { lineBreak: false });

    const logoAddress = s.company_address || 'Eisvogelweg 2, 85356 Freising';
    doc.fontSize(8).font('WorkSans');
    const logoAddressW = doc.widthOfString(logoAddress);
    doc.fillColor(GRAY).text(logoAddress, marginL + (logoW - logoAddressW) / 2, logoY + 18, { lineBreak: false });

    const titleX = marginL + pageW - 250;
    doc.fontSize(17).font('WorkSans-Bold').fillColor(BRAND)
      .text(isEn ? 'INVOICE' : 'RECHNUNG', titleX, 50, { width: 250, align: 'right' });

    const today = new Date();
    const todayStr = fmtDate(today.toISOString(), lang);
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateStr = fmtDate(dueDate.toISOString(), lang);

    const zahlungsartLabel = isPaid
      ? (zahlungsart === 'bar'
          ? (isEn ? 'Paid in Cash' : 'Bar bezahlt')
          : (isEn ? 'Paid by Credit Card' : 'Kreditkarte bezahlt'))
      : (isEn ? 'Bank Transfer' : 'Überweisung');

    doc.fontSize(8).font('WorkSans').fillColor(GRAY);
    const metaX = titleX + 60;
    const metaLabelW = 95;
    const metaValW = 250 - 60 - metaLabelW;
    const rows2: [string, string][] = [
      [isEn ? 'Invoice No.:' : 'Rechnungsnr.:', rechnungsnummer],
      [isEn ? 'Invoice Date:' : 'Datum:', todayStr],
      [isEn ? 'Booking No.:' : 'Buchungsnr.:', booking.booking_number || '—'],
      isPaid
        ? [isEn ? 'Payment:' : 'Zahlung:', zahlungsartLabel]
        : [isEn ? 'Payment Due:' : 'Zahlungsziel:', dueDateStr],
    ];
    let ry = 74;
    for (const [label, val] of rows2) {
      doc.font('WorkSans').fillColor(GRAY).text(label, metaX, ry, { width: metaLabelW, lineBreak: false });
      doc.font('WorkSans-Bold').fillColor('#111827').text(val, metaX + metaLabelW, ry, { width: metaValW, align: 'right', lineBreak: false });
      ry += 11;
    }

    // ── CUSTOMER BLOCK
    const custY = logoY + 60;
    doc.fontSize(8).font('WorkSans').fillColor(GRAY)
      .text(isEn ? 'BILL TO' : 'RECHNUNGSEMPFÄNGER', marginL, custY);
    if (empfaenger_adresse && empfaenger_adresse.trim()) {
      const lines = empfaenger_adresse.trim().replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
      let addrY = custY + 12;
      doc.fontSize(11).font('WorkSans-Bold').fillColor('#111827')
        .text(lines[0] || '—', marginL, addrY, { width: pageW, lineBreak: false });
      addrY += 16;
      doc.fontSize(9).font('WorkSans').fillColor('#374151');
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], marginL, addrY, { width: pageW, lineBreak: false });
        addrY += 13;
      }
      doc.text('', marginL, addrY - 4);
    } else {
      let addrY = custY + 12;
      doc.fontSize(11).font('WorkSans-Bold').fillColor('#111827')
        .text(booking.name || '—', marginL, addrY, { width: pageW, lineBreak: false });
      addrY += 16;
      doc.fontSize(9).font('WorkSans').fillColor('#374151');
      if (booking.email) { doc.text(booking.email, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
      if (booking.phone) { doc.text(booking.phone, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
      doc.text('', marginL, addrY - 4);
    }

    // ── SEPARATOR
    const sepY = doc.y + 18;
    doc.moveTo(marginL, sepY).lineTo(marginL + pageW, sepY)
      .lineWidth(1).strokeColor(BRAND).stroke();

    // ── SERVICES TABLE
    const tableTop = sepY + 16;
    const colPos    = marginL;
    const colDesc   = marginL + 30;
    const colMenge  = marginL + pageW - 195;
    const colEinzel = marginL + pageW - 138;
    const colGesamt = marginL + pageW - 62;
    const wDesc     = colMenge - colDesc - 8;
    const wMenge    = colEinzel - colMenge - 4;
    const wEinzel   = colGesamt - colEinzel - 4;
    const wGesamt   = marginL + pageW - colGesamt;

    doc.rect(marginL, tableTop, pageW, 20).fill(BRAND);
    doc.fontSize(8.5).font('WorkSans-Bold').fillColor('#ffffff');
    doc.text(isEn ? 'Pos.' : 'Pos.', colPos, tableTop + 6, { width: 25, align: 'left', lineBreak: false });
    doc.text(isEn ? 'Description' : 'Beschreibung', colDesc, tableTop + 6, { width: wDesc, lineBreak: false });
    doc.text(isEn ? 'Qty' : 'Menge', colMenge, tableTop + 6, { width: wMenge, align: 'center', lineBreak: false });
    doc.text(isEn ? 'Unit Price' : 'Einzelpreis', colEinzel, tableTop + 6, { width: wEinzel, align: 'right', lineBreak: false });
    doc.text(isEn ? 'Total' : 'Gesamt', colGesamt, tableTop + 6, { width: wGesamt, align: 'right', lineBreak: false });

    const grossPrice = roundGrossPrice(Number(booking.price) || 0, booking.source === 'calendar');
    const netPrice = mwst > 0 ? grossPrice / (1 + mwst / 100) : grossPrice;
    const mwstAmount = grossPrice - netPrice;

    const pickupDate = booking.pickup_datetime ? fmtDate(booking.pickup_datetime, lang) : '';
    const descLine1 = isEn ? 'Airport Transfer Munich' : 'Flughafentransfer München';
    const descLine2 = `${isEn ? 'From:' : 'Von:'} ${(booking.pickup_address || '').substring(0, 60)}`;
    const descLine3 = `${isEn ? 'To:' : 'Nach:'} ${(booking.dropoff_address || '').substring(0, 60)}`;
    const descLine4 = pickupDate ? (isEn ? `Date: ${pickupDate}` : `Datum: ${pickupDate}`) : '';

    const ROW_H_SERVICE = descLine4 ? 65 : 54;
    const rowTop = tableTop + 20;
    doc.rect(marginL, rowTop, pageW, ROW_H_SERVICE).fill(LIGHTGRAY);
    doc.fillColor('#111827').fontSize(8.5).font('WorkSans-Bold');
    doc.text('1', colPos, rowTop + 8, { width: 25, lineBreak: false });
    doc.font('WorkSans-Bold').text(descLine1, colDesc, rowTop + 8, { width: wDesc, height: 10, ellipsis: true });
    doc.font('WorkSans').fontSize(8).fillColor(GRAY)
      .text(descLine2, colDesc, rowTop + 20, { width: wDesc, height: 9, ellipsis: true });
    doc.text(descLine3, colDesc, rowTop + 31, { width: wDesc, height: 9, ellipsis: true });
    if (descLine4) {
      doc.text(descLine4, colDesc, rowTop + 42, { width: wDesc, height: 9, ellipsis: true });
    }
    doc.fontSize(8.5).fillColor('#111827').font('WorkSans');
    doc.text('1×', colMenge, rowTop + 8, { width: wMenge, align: 'center', lineBreak: false });
    doc.text(fmtPrice(grossPrice), colEinzel, rowTop + 8, { width: wEinzel, align: 'right', lineBreak: false });
    doc.font('WorkSans-Bold').text(fmtPrice(grossPrice), colGesamt, rowTop + 8, { width: wGesamt, align: 'right', lineBreak: false });

    const tableBottom = rowTop + ROW_H_SERVICE;
    doc.moveTo(marginL, tableBottom).lineTo(marginL + pageW, tableBottom)
      .lineWidth(0.5).strokeColor('#e5e7eb').stroke();

    // ── TOTALS
    const totX = marginL + pageW - 250;
    const totValX = marginL + pageW - 40;
    let totY = tableBottom + 16;

    const totRows: [string, number, boolean][] = [
      [isEn ? 'Net Amount:' : 'Nettobetrag:', netPrice, false],
      [isEn ? `VAT (${mwst}%):` : `MwSt. (${mwst}%):`, mwstAmount, false],
      [isEn ? 'TOTAL AMOUNT:' : 'GESAMTBETRAG:', grossPrice, true],
    ];
    for (const [label, amount, bold] of totRows) {
      if (bold) {
        doc.moveTo(totX, totY - 4).lineTo(marginL + pageW, totY - 4).lineWidth(0.5).strokeColor(BRAND).stroke();
      }
      doc.fontSize(bold ? 11 : 9)
        .font(bold ? 'WorkSans-Bold' : 'WorkSans')
        .fillColor(bold ? BRAND : '#374151');
      doc.text(label, totX, totY, { width: 160, lineBreak: false });
      doc.text(fmtPrice(amount), totValX, totY, { width: 50, align: 'right', lineBreak: false });
      totY += bold ? 18 : 14;
    }

    if (mwst === 0) {
      doc.fontSize(8).font('WorkSans').fillColor(GRAY)
        .text(isEn
          ? 'VAT-exempt pursuant to §4 No. 21 UStG'
          : 'Kein Steuerausweis, da MwSt.-befreit gemäß §4 Nr. 21 UStG',
          marginL, totY + 8, { width: pageW });
      totY += 24;
    }

    // ── BANK TRANSFER BOX or BEZAHLT BOX (anchored near the bottom of the page, like the Sammelrechnung)
    const pageBottom = doc.page.height - 120;
    const bankBoxH = isPaid ? 44 : 90;
    const bankY = Math.max(totY + 24, pageBottom - bankBoxH);
    if (isPaid) {
      const paidLabel = zahlungsart === 'bar'
        ? (isEn ? '✓  Paid in Cash' : '✓  Bar bezahlt')
        : (isEn ? '✓  Paid by Credit Card' : '✓  Kreditkarte bezahlt');
      doc.rect(marginL, bankY, pageW, 44).fill('#f0fdf4').stroke('#bbf7d0');
      doc.fontSize(11).font('WorkSans-Bold').fillColor('#15803d')
        .text(paidLabel, marginL + 12, bankY + 15);
    } else {
      doc.rect(marginL, bankY, pageW, 90).fill('#f9fafb').stroke();
      doc.fontSize(8).font('WorkSans-Bold').fillColor(BRAND)
        .text(isEn ? 'BANK TRANSFER DETAILS' : 'BANKVERBINDUNG', marginL + 12, bankY + 14);
      doc.fontSize(7.5).font('WorkSans').fillColor('#374151');

      const bankRows: [string, string][] = [
        [isEn ? 'Account Holder:' : 'Kontoinhaber:', s.bank_kontoinhaber || companyName],
        [isEn ? 'Bank:' : 'Bank:', s.bank_name || '—'],
        ['IBAN:', s.bank_iban || '—'],
        ['BIC/SWIFT:', s.bank_bic || '—'],
        [isEn ? 'Reference:' : 'Verwendungszweck:', rechnungsnummer],
      ];
      let bY = bankY + 32;
      for (const [label, val] of bankRows) {
        doc.font('WorkSans').fillColor(GRAY).text(label, marginL + 12, bY, { width: 110, lineBreak: false });
        doc.font('WorkSans-Bold').fillColor('#111827').text(val, marginL + 125, bY, { width: pageW - 135, lineBreak: false });
        bY += 11;
      }
    }

    // ── FOOTER
    const footerY = doc.page.height - 80;
    doc.moveTo(marginL, footerY).lineTo(marginL + pageW, footerY)
      .lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.fontSize(7.5).font('WorkSans').fillColor(GRAY);
    const footerParts: string[] = [companyName, s.company_address || ''].filter(Boolean);
    if (s.company_steuernr) footerParts.push((isEn ? 'Tax No.: ' : 'Steuer-Nr.: ') + s.company_steuernr);
    if (s.company_ustidnr) footerParts.push((isEn ? 'VAT ID: ' : 'USt-IdNr.: ') + s.company_ustidnr);
    doc.text(footerParts.join('  ·  '), marginL, footerY + 8, { width: pageW, align: 'center' });
    doc.text('flughafen-muenchen.taxi', marginL, footerY + 20, { width: pageW, align: 'center' });

    doc.end();
  });
}

// ─── SINGLE BOOKING RECHNUNG EMAIL ───────────────────────────────────────────

export function buildRechnungEmail(opts: {
  booking: any;
  rechnungsnummer: string;
  mwst: 0 | 7 | 19;
  lang: 'de' | 'en';
  s: Record<string, string>;
  zahlungsart?: 'bar' | 'kreditkarte' | 'ueberweisung';
}): string {
  const { booking, rechnungsnummer, mwst, lang, s, zahlungsart } = opts;
  const isPaid = zahlungsart === 'bar' || zahlungsart === 'kreditkarte';
  const isEn = lang === 'en';
  const companyName = s.company_name || 'Taxi N&N GbR';
  const grossPrice = roundGrossPrice(Number(booking.price) || 0, booking.source === 'calendar');
  const netPrice = mwst > 0 ? grossPrice / (1 + mwst / 100) : grossPrice;
  const mwstAmount = grossPrice - netPrice;
  const BRAND = '#0c2d48';

  const greeting = isEn
    ? `Dear ${booking.name || 'Customer'},`
    : `Sehr geehrte/r ${booking.name || 'Kunde/Kundin'},`;

  const intro = isEn
    ? `Thank you for choosing Munich Airport Taxi. Please find your invoice <strong>${rechnungsnummer}</strong> attached to this email.`
    : `Vielen Dank für Ihre Buchung bei Flughafen München Taxi. Anbei erhalten Sie Ihre Rechnung <strong>${rechnungsnummer}</strong> als PDF-Anhang.`;

  const tableRows = `
    <tr style="background:#f3f4f6;">
      <td style="padding:10px 12px;font-weight:600;color:#111827;">${isEn ? 'Airport Transfer Munich' : 'Flughafentransfer München'}</td>
      <td style="padding:10px 12px;text-align:right;color:#111827;">${fmtPrice(netPrice)}</td>
    </tr>
    <tr><td style="padding:8px 12px;color:#6b7280;font-size:12px;" colspan="2">${booking.pickup_address} → ${booking.dropoff_address}</td></tr>
    <tr style="border-top:1px solid #e5e7eb;">
      <td style="padding:8px 12px;color:#6b7280;">${isEn ? 'Net Amount' : 'Nettobetrag'}</td>
      <td style="padding:8px 12px;text-align:right;color:#374151;">${fmtPrice(netPrice)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;color:#6b7280;">${isEn ? `VAT (${mwst}%)` : `MwSt. (${mwst}%)`}</td>
      <td style="padding:8px 12px;text-align:right;color:#374151;">${fmtPrice(mwstAmount)}</td>
    </tr>
    <tr style="border-top:2px solid ${BRAND};background:#f0f9ff;">
      <td style="padding:12px;font-weight:700;color:${BRAND};font-size:15px;">${isEn ? 'Total Amount' : 'Gesamtbetrag'}</td>
      <td style="padding:12px;text-align:right;font-weight:700;color:${BRAND};font-size:15px;">${fmtPrice(grossPrice)}</td>
    </tr>
  `;

  const paidLabel = zahlungsart === 'bar'
    ? (isEn ? '✓ Paid in Cash' : '✓ Bar bezahlt')
    : (isEn ? '✓ Paid by Credit Card' : '✓ Kreditkarte bezahlt');

  const bankSection = isPaid ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:20px;">
      <p style="margin:0;font-weight:700;color:#15803d;font-size:14px;">${paidLabel}</p>
    </div>
  ` : (s.bank_iban ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:20px;">
      <p style="margin:0 0 10px;font-weight:700;color:${BRAND};font-size:13px;">${isEn ? 'BANK TRANSFER DETAILS' : 'BANKVERBINDUNG'}</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        ${s.bank_kontoinhaber ? `<tr><td style="color:#6b7280;padding:3px 0;width:130px;">${isEn ? 'Account Holder:' : 'Kontoinhaber:'}</td><td style="font-weight:600;">${s.bank_kontoinhaber}</td></tr>` : ''}
        ${s.bank_name ? `<tr><td style="color:#6b7280;padding:3px 0;">${isEn ? 'Bank:' : 'Bank:'}</td><td style="font-weight:600;">${s.bank_name}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:3px 0;">IBAN:</td><td style="font-weight:600;font-family:monospace;">${s.bank_iban}</td></tr>
        ${s.bank_bic ? `<tr><td style="color:#6b7280;padding:3px 0;">BIC/SWIFT:</td><td style="font-weight:600;font-family:monospace;">${s.bank_bic}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:3px 0;">${isEn ? 'Reference:' : 'Verwendungszweck:'}</td><td style="font-weight:600;">${rechnungsnummer}</td></tr>
      </table>
    </div>
  ` : '');

  const closing = isEn
    ? 'If you have any questions, please do not hesitate to contact us.'
    : 'Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:${BRAND};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">${isEn ? 'Your Invoice' : 'Ihre Rechnung'}</p>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">${rechnungsnummer} · ${companyName}</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">${greeting}</p>
    <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">${intro}</p>
    <!-- Invoice table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
      <tr style="background:${BRAND};">
        <td style="padding:10px 12px;color:#fff;font-weight:700;">${isEn ? 'Description' : 'Beschreibung'}</td>
        <td style="padding:10px 12px;color:#fff;font-weight:700;text-align:right;">${isEn ? 'Amount' : 'Betrag'}</td>
      </tr>
      ${tableRows}
    </table>
    ${bankSection}
    <p style="margin:24px 0 0;color:#374151;font-size:14px;">${closing}</p>
    <p style="margin:8px 0 0;color:#374151;font-size:14px;">${isEn ? 'With kind regards,<br>' : 'Mit freundlichen Grüßen,<br>'}<strong>${companyName}</strong></p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:11px;">${companyName} · ${s.company_address || ''}</p>
    ${s.company_phone ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">${s.company_phone} · <a href="mailto:${s.company_email || ''}" style="color:#9ca3af;">${s.company_email || ''}</a></p>` : ''}
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ─── SAMMELRECHNUNG (COLLECTIVE INVOICE) PDF ─────────────────────────────────

export function generateSammelrechnungPdf(opts: {
  company: { company_name: string; contact_name: string; address: string; ust_idnr?: string };
  invoiceNumber: string;
  periodMonth: string;
  mwst: 0 | 7 | 19;
  bookings: any[];
  total: number;
  dueDate: string;
  mahngebuehr: number;
  reminderLevel: number;
  s: Record<string, string>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { company, invoiceNumber, periodMonth, mwst, bookings, total, dueDate, mahngebuehr, reminderLevel, s } = opts;

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    registerUnicodeFonts(doc);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BRAND = '#0c2d48';
    const GRAY = '#6b7280';
    const LIGHTGRAY = '#f3f4f6';
    const pageW = doc.page.width - 100;
    const marginL = 50;
    const companyName = s.company_name || 'Taxi N&N GbR';

    // ── HEADER
    const titleX = marginL + pageW - 250;
    const titleLabel = reminderLevel >= 3 ? 'MAHNUNG' : reminderLevel > 0 ? 'ZAHLUNGSERINNERUNG' : 'RECHNUNG';
    doc.fontSize(17).font('WorkSans-Bold').fillColor(reminderLevel >= 3 ? '#dc2626' : BRAND)
      .text(titleLabel, titleX, 50, { width: 250, align: 'right' });

    const todayStr = fmtDate(new Date().toISOString(), 'de');
    const dueDateStr = fmtDate(dueDate, 'de');

    doc.fontSize(8).font('WorkSans').fillColor(GRAY);
    const metaX = titleX + 60;
    const metaLabelW = 75;
    const metaValueW = 250 - 60 - metaLabelW;
    const metaRows: [string, string][] = [
      ['Rechnungsnr.:', invoiceNumber],
      ['Datum:', todayStr],
      ['Zeitraum:', periodMonth],
      ['Zahlbar bis:', dueDateStr],
    ];
    let ry = 74;
    for (const [label, val] of metaRows) {
      doc.font('WorkSans').fillColor(GRAY).text(label, metaX, ry, { width: metaLabelW, lineBreak: false });
      doc.font('WorkSans-Bold').fillColor('#111827').text(val, metaX + metaLabelW, ry, { width: metaValueW, align: 'right', lineBreak: false });
      ry += 11;
    }

    // ── LOGO (above RECHNUNGSEMPFÄNGER)
    const logoY = 50;
    doc.fontSize(13).font('WorkSans-Bold');
    const logoPart1 = 'Flughafen-muenchen.';
    const logoPart2 = 'TAXI';
    const logoW = doc.widthOfString(logoPart1) + doc.widthOfString(logoPart2);
    doc.fillColor(BRAND).text(logoPart1, marginL, logoY, { continued: true, lineBreak: false });
    doc.fillColor('#fbbf24').text(logoPart2, { lineBreak: false });

    const logoAddress = 'Eisvogelweg 2, 85356 Freising';
    doc.fontSize(8).font('WorkSans');
    const logoAddressW = doc.widthOfString(logoAddress);
    doc.fillColor(GRAY).text(logoAddress, marginL + (logoW - logoAddressW) / 2, logoY + 18, { lineBreak: false });

    // ── CUSTOMER BLOCK
    const custY = logoY + 60;
    doc.fontSize(8).font('WorkSans').fillColor(GRAY)
      .text('RECHNUNGSEMPFÄNGER', marginL, custY);
    let addrY = custY + 12;
    doc.fontSize(11).font('WorkSans-Bold').fillColor('#111827')
      .text(company.company_name, marginL, addrY, { width: pageW, lineBreak: false });
    addrY += 16;
    doc.fontSize(9).font('WorkSans').fillColor('#374151');
    if (company.contact_name) { doc.text(company.contact_name, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
    if (company.address) { doc.text(company.address, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
    if (company.ust_idnr) { doc.text('USt-IdNr.: ' + company.ust_idnr, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
    doc.text('', marginL, addrY - 4);

    // ── SEPARATOR
    const sepY = doc.y + 14;
    doc.moveTo(marginL, sepY).lineTo(marginL + pageW, sepY).lineWidth(1).strokeColor(BRAND).stroke();

    // ── BOOKINGS TABLE
    const tableTop = sepY + 12;
    const colWidths = { pos: 25, date: 65, nr: 55, route: 150, guest: 70, kst: 50, price: pageW - 25 - 65 - 55 - 150 - 70 - 50 };
    const colX = {
      pos: marginL,
      date: marginL + colWidths.pos,
      nr: marginL + colWidths.pos + colWidths.date,
      route: marginL + colWidths.pos + colWidths.date + colWidths.nr,
      guest: marginL + colWidths.pos + colWidths.date + colWidths.nr + colWidths.route,
      kst: marginL + colWidths.pos + colWidths.date + colWidths.nr + colWidths.route + colWidths.guest,
      price: marginL + pageW - colWidths.price,
    };

    // Table header
    doc.rect(marginL, tableTop, pageW, 16).fill(BRAND);
    doc.fontSize(6.5).font('WorkSans-Bold').fillColor('#ffffff');
    doc.text('Pos.', colX.pos, tableTop + 4.5, { width: colWidths.pos, lineBreak: false });
    doc.text('Datum', colX.date, tableTop + 4.5, { width: colWidths.date, lineBreak: false });
    doc.text('Buchung', colX.nr, tableTop + 4.5, { width: colWidths.nr, lineBreak: false });
    doc.text('Strecke', colX.route, tableTop + 4.5, { width: colWidths.route, lineBreak: false });
    doc.text('Gast', colX.guest, tableTop + 4.5, { width: colWidths.guest, lineBreak: false });
    doc.text('KSt.', colX.kst, tableTop + 4.5, { width: colWidths.kst, lineBreak: false });
    doc.text('Betrag (Netto)', colX.price, tableTop + 4.5, { width: colWidths.price, align: 'right', lineBreak: false });

    let curY = tableTop + 16;
    const ROW_H = 26;
    const pageBottom = doc.page.height - 120;

    for (let i = 0; i < bookings.length; i++) {
      if (curY + ROW_H > pageBottom) {
        doc.addPage();
        curY = 50;
      }
      const b = bookings[i];
      const bg = i % 2 === 0 ? LIGHTGRAY : '#ffffff';
      doc.rect(marginL, curY, pageW, ROW_H).fill(bg);
      doc.fontSize(6.5).font('WorkSans').fillColor('#111827');
      const cellH = ROW_H - 6;
      doc.text(String(i + 1), colX.pos, curY + 4, { width: colWidths.pos, height: cellH, ellipsis: true });
      doc.text(b.pickup_datetime ? fmtDate(b.pickup_datetime, 'de') : '', colX.date, curY + 4, { width: colWidths.date, height: cellH, ellipsis: true });
      doc.text(b.booking_number || '', colX.nr, curY + 4, { width: colWidths.nr, height: cellH, ellipsis: true });
      const route = `${b.pickup_address || ''} - ${b.dropoff_address || ''}`;
      doc.text(route, colX.route, curY + 4, { width: colWidths.route, height: cellH, ellipsis: true });
      doc.text(b.name || '', colX.guest, curY + 4, { width: colWidths.guest, height: cellH, ellipsis: true });
      doc.text((b.cost_center || ''), colX.kst, curY + 4, { width: colWidths.kst, height: cellH, ellipsis: true });
      const rowGross = roundGrossPrice(Number(b.price) || 0, b.source === 'calendar');
      const rowRate = (b.steuersatz !== null && b.steuersatz !== undefined && [0, 7, 19].includes(Number(b.steuersatz))) ? Number(b.steuersatz) : mwst;
      const rowNet = rowRate > 0 ? rowGross / (1 + rowRate / 100) : rowGross;
      doc.font('WorkSans-Bold').text(fmtPrice(rowNet), colX.price, curY + 4, { width: colWidths.price, height: cellH, align: 'right', ellipsis: true });
      curY += ROW_H;
    }

    // Table bottom border
    doc.moveTo(marginL, curY).lineTo(marginL + pageW, curY).lineWidth(0.5).strokeColor('#e5e7eb').stroke();

    // ── TOTALS
    if (curY + 100 > pageBottom) { doc.addPage(); curY = 50; }

    // `total` is the grand total already including any Mahngebühr baked in by the caller.
    const subtotal = total - mahngebuehr;
    const grandTotal = total;

    // Group bookings by their own tax rate (per-ride steuersatz overrides the invoice-level default `mwst`),
    // since a single Sammelrechnung can mix 7%/19%/0% rides.
    const rateGroups = new Map<number, number>();
    for (const b of bookings) {
      const rate = (b.steuersatz !== null && b.steuersatz !== undefined && [0, 7, 19].includes(Number(b.steuersatz))) ? Number(b.steuersatz) : mwst;
      const gross = roundGrossPrice(Number(b.price) || 0, b.source === 'calendar');
      rateGroups.set(rate, (rateGroups.get(rate) || 0) + gross);
    }
    const sortedRates = Array.from(rateGroups.keys()).sort((a, b) => b - a);

    const totX = marginL + pageW - 250;
    const totValX = marginL + pageW - 40;
    let totY = curY + 16;

    const totItems: [string, number, boolean][] = [];
    for (const rate of sortedRates) {
      const gross = rateGroups.get(rate)!;
      const net = rate > 0 ? gross / (1 + rate / 100) : gross;
      totItems.push([`Nettobetrag (${rate}%):`, net, false]);
      if (rate > 0) totItems.push([`MwSt. (${rate}%):`, gross - net, false]);
    }
    totItems.push(['Zwischensumme:', subtotal, false]);
    if (mahngebuehr > 0) {
      totItems.push(['Mahngebühr:', mahngebuehr, false]);
    }
    totItems.push(['GESAMTBETRAG:', grandTotal, true]);

    for (const [label, amount, bold] of totItems) {
      if (bold) {
        doc.moveTo(totX, totY - 4).lineTo(marginL + pageW, totY - 4).lineWidth(0.5).strokeColor(BRAND).stroke();
      }
      doc.fontSize(bold ? 11 : 9)
        .font(bold ? 'WorkSans-Bold' : 'WorkSans')
        .fillColor(bold ? BRAND : '#374151');
      doc.text(label, totX, totY, { width: 160, lineBreak: false });
      doc.text(fmtPrice(amount), totValX, totY, { width: 50, align: 'right', lineBreak: false });
      totY += bold ? 18 : 14;
    }

    if (sortedRates.length === 1 && sortedRates[0] === 0) {
      doc.fontSize(8).font('WorkSans').fillColor(GRAY)
        .text('Kein Steuerausweis, da MwSt.-befreit gemäß §4 Nr. 21 UStG', marginL, totY + 8, { width: pageW });
      totY += 24;
    }

    // ── DUE DATE LINE + BANK DETAILS (anchored near the bottom of the page)
    const bankBoxH = 90;
    let bankStartY = Math.max(totY + 28 + 13, pageBottom - bankBoxH);
    if (bankStartY + bankBoxH > doc.page.height - 50) {
      doc.addPage();
      bankStartY = 50 + 13;
    }
    doc.fontSize(10).font('WorkSans-Bold').fillColor(BRAND)
      .text(`Zahlbar bis: ${dueDateStr}`, marginL, bankStartY - 13, { width: pageW });
    doc.rect(marginL, bankStartY, pageW, 90).fill('#f9fafb').stroke();
    doc.fontSize(8).font('WorkSans-Bold').fillColor(BRAND)
      .text('BANKVERBINDUNG', marginL + 12, bankStartY + 14);
    doc.fontSize(7.5).font('WorkSans').fillColor('#374151');

    const bankRows: [string, string][] = [
      ['Kontoinhaber:', s.bank_kontoinhaber || companyName],
      ['Bank:', s.bank_name || '—'],
      ['IBAN:', s.bank_iban || '—'],
      ['BIC/SWIFT:', s.bank_bic || '—'],
      ['Verwendungszweck:', invoiceNumber],
    ];
    let bY = bankStartY + 32;
    for (const [label, val] of bankRows) {
      doc.font('WorkSans').fillColor(GRAY).text(label, marginL + 12, bY, { width: 110, lineBreak: false });
      doc.font('WorkSans-Bold').fillColor('#111827').text(val, marginL + 125, bY, { width: pageW - 135, lineBreak: false });
      bY += 11;
    }

    // ── FOOTER (on every page)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const fY = doc.page.height - 80;
      doc.moveTo(marginL, fY).lineTo(marginL + pageW, fY).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
      doc.fontSize(7.5).font('WorkSans').fillColor(GRAY);
      const footerParts: string[] = [companyName, s.company_address || ''].filter(Boolean);
      if (s.company_steuernr) footerParts.push('Steuer-Nr.: ' + s.company_steuernr);
      if (s.company_ustidnr) footerParts.push('USt-IdNr.: ' + s.company_ustidnr);
      doc.text(footerParts.join('  ·  '), marginL, fY + 6, { width: pageW, align: 'center' });
      doc.text(`flughafen-muenchen.taxi  ·  Seite ${i - range.start + 1} von ${range.count}`, marginL, fY + 18, { width: pageW, align: 'center' });
    }

    doc.end();
  });
}

// ─── REMINDER / MAHNUNG EMAIL ────────────────────────────────────────────────

export function buildReminderEmail(opts: {
  level: 1 | 2 | 3;
  invoice: { invoice_number: string; period_month: string; total: number; due_date: string; mahngebuehr: number };
  company: { company_name: string; contact_name: string };
  s: Record<string, string>;
}): string {
  const { level, invoice, company, s } = opts;
  const companyName = s.company_name || 'Taxi N&N GbR';
  const BRAND = '#0c2d48';
  const dueDateStr = fmtDate(invoice.due_date, 'de');
  // invoice.total is the caller-supplied grand total, already including any Mahngebühr for level >= 3.
  const grandTotal = invoice.total;

  const greeting = `Sehr geehrte Damen und Herren der ${company.company_name},`;

  let subject: string;
  let heading: string;
  let headingColor: string;
  let bodyText: string;

  if (level === 1) {
    subject = `Zahlungserinnerung – Rechnung ${invoice.invoice_number}`;
    heading = 'Zahlungserinnerung';
    headingColor = '#d97706';
    bodyText = `wir möchten Sie freundlich daran erinnern, dass die Rechnung <strong>${invoice.invoice_number}</strong> für den Zeitraum <strong>${invoice.period_month}</strong> in Höhe von <strong>${fmtPrice(invoice.total)}</strong> seit dem <strong>${dueDateStr}</strong> fällig ist.<br><br>Sollte die Zahlung bereits erfolgt sein, betrachten Sie diese Erinnerung bitte als gegenstandslos.`;
  } else if (level === 2) {
    subject = `2. Zahlungserinnerung – Rechnung ${invoice.invoice_number}`;
    heading = '2. Zahlungserinnerung';
    headingColor = '#ea580c';
    bodyText = `leider konnten wir bisher keinen Zahlungseingang für die Rechnung <strong>${invoice.invoice_number}</strong> (Zeitraum: <strong>${invoice.period_month}</strong>, Betrag: <strong>${fmtPrice(invoice.total)}</strong>, fällig seit: <strong>${dueDateStr}</strong>) feststellen.<br><br>Wir bitten Sie, den offenen Betrag umgehend zu überweisen.`;
  } else {
    subject = `Mahnung – Rechnung ${invoice.invoice_number}`;
    heading = 'Mahnung';
    headingColor = '#dc2626';
    bodyText = `trotz unserer bisherigen Zahlungserinnerungen ist die Rechnung <strong>${invoice.invoice_number}</strong> (Zeitraum: <strong>${invoice.period_month}</strong>, fällig seit: <strong>${dueDateStr}</strong>) weiterhin nicht beglichen.<br><br>Wir sind daher gezwungen, Ihnen eine Mahngebühr in Höhe von <strong>${fmtPrice(invoice.mahngebuehr)}</strong> zu berechnen.<br><br><strong>Neuer Gesamtbetrag: ${fmtPrice(grandTotal)}</strong><br><br>Bitte überweisen Sie den Gesamtbetrag innerhalb von 7 Tagen. Bei weiterem Zahlungsverzug behalten wir uns die Einleitung weiterer Maßnahmen vor.`;
  }

  const bankSection = s.bank_iban ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:20px;">
      <p style="margin:0 0 10px;font-weight:700;color:${BRAND};font-size:13px;">BANKVERBINDUNG</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        ${s.bank_kontoinhaber ? `<tr><td style="color:#6b7280;padding:3px 0;width:130px;">Kontoinhaber:</td><td style="font-weight:600;">${s.bank_kontoinhaber}</td></tr>` : ''}
        ${s.bank_name ? `<tr><td style="color:#6b7280;padding:3px 0;">Bank:</td><td style="font-weight:600;">${s.bank_name}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:3px 0;">IBAN:</td><td style="font-weight:600;font-family:monospace;">${s.bank_iban}</td></tr>
        ${s.bank_bic ? `<tr><td style="color:#6b7280;padding:3px 0;">BIC/SWIFT:</td><td style="font-weight:600;font-family:monospace;">${s.bank_bic}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:3px 0;">Verwendungszweck:</td><td style="font-weight:600;">${invoice.invoice_number}</td></tr>
      </table>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:${headingColor};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">${heading}</p>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${invoice.invoice_number} · ${companyName}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">${greeting}</p>
    <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">${bodyText}</p>
    ${bankSection}
    <p style="margin:24px 0 0;color:#374151;font-size:14px;">Die aktuelle Rechnung finden Sie als PDF im Anhang dieser E-Mail.</p>
    <p style="margin:16px 0 0;color:#374151;font-size:14px;">Mit freundlichen Grüßen,<br><strong>${companyName}</strong></p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:11px;">${companyName} · ${s.company_address || ''}</p>
    ${s.company_phone ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">${s.company_phone} · <a href="mailto:${s.company_email || ''}" style="color:#9ca3af;">${s.company_email || ''}</a></p>` : ''}
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
