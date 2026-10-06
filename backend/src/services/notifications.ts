import { Resend } from 'resend';
import dotenv from 'dotenv';
import { formatPhoneDisplay } from '../utils/phone';
import { customerConfirmationEmail, adminNotificationEmail, customerCancellationEmail, adminCancellationEmail } from './bookingEmailTemplates';

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;

export interface BookingNotificationData {
  booking_number: string;
  name: string;
  email: string;
  phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  vehicle_type: string;
  passengers: number;
  price: number;
  payment_method: string;
  flight_number?: string;
  flight_validated?: string;
  flight_info?: string;
  pickup_sign?: string;
  child_seat: boolean;
  child_seat_details?: string;
  luggage_count: number;
  notes?: string;
  distance_km?: number;
  duration_minutes?: number;
  language: string;
  trip_type?: string;
  return_datetime?: string;
  oneway_price?: number;
  roundtrip_discount?: number;
  fahrrad_count?: number;
  fahrrad_price?: number;
  fahrrad_total?: number;
  anfahrt_cost?: number;
  zwischenstopp_address?: string;
  promo_code?: string;
  discount_amount?: number;
  base_total?: number;
  night_confirm?: boolean;
  company_name?: string;
  company_discount?: number;
  auto_discount_name?: string;
  auto_discount_amount?: number;
  auto_discount_show_in_email?: boolean;
  rechnung_adresse?: string;   // set when the customer asked for an invoice (PDF after the ride)
}

function formatPrice(price: number): string {
  const rounded = Math.ceil(price * 2) / 2;
  return rounded.toFixed(2);
}

// Display-only icon prefix for addresses (airport ✈️ / hotel 🏨) — never stored in DB
function addressIcon(addr: string): string {
  if (/flughafen|airport|terminal/i.test(addr)) return '✈️ ';
  if (/\b(hotel|hostel|pension|gasthof|gasthaus|motel|resort|novotel|mercure|ibis|marriott|hilton|hyatt)\b/i.test(addr)) return '🏨 ';
  return '';
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// Admin notification email (always German) — layout in bookingEmailTemplates.ts
export async function sendAdminNotification(booking: BookingNotificationData): Promise<void> {
  const { subject, html } = adminNotificationEmail(booking);
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: ADMIN_EMAIL,
    subject,
    html,
  });
}

// Customer confirmation email (DE/EN/TR) — layout in bookingEmailTemplates.ts
export async function sendCustomerConfirmation(booking: BookingNotificationData): Promise<void> {
  const { subject, html } = customerConfirmationEmail(booking);
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: booking.email,
    subject,
    html,
  });
}

async function sendWhatsAppNotification(booking: BookingNotificationData): Promise<void> {
  const formattedDate = formatDateTime(booking.pickup_datetime);
  const lines = [
    `NEUE BUCHUNG ${booking.booking_number}`,
    `EUR ${formatPrice(booking.price)} ${booking.trip_type === 'roundtrip' ? '(Hin+Rueck)' : '(Einfach)'}`,
    `Von: ${booking.pickup_address}`,
    `Nach: ${booking.dropoff_address}`,
    `Abfahrt: ${formattedDate}`,
    `${booking.passengers} Pax - ${booking.vehicle_type}`,
    booking.flight_number ? `Flug: ${booking.flight_number}` : '',
    `Kunde: ${booking.name}`,
    `Tel: ${formatPhoneDisplay(booking.phone)}`,
  ].filter(Boolean).join('%0A');

  await fetch(
    `https://api.callmebot.com/whatsapp.php?phone=491774447619&text=${lines}&apikey=4111858`,
    { method: 'GET' }
  );
}

// ─── MARKETING EMAIL ──────────────────────────────────────────────────────────

export interface MarketingEmailOptions {
  subject: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  recipientName?: string;
  isHtml?: boolean;  // true = content is raw HTML, false = plain text with markdown
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Convert all non-ASCII characters (emojis, special chars) to HTML numeric entities
// This prevents encoding issues when sending HTML via JSON
export function encodeNonAscii(str: string): string {
  return Array.from(str).map(c => {
    const code = c.codePointAt(0) ?? 0;
    return code > 127 ? `&#${code};` : c;
  }).join('');
}

// Convert plain text content (with simple markdown-like syntax) to HTML
function contentToHtml(content: string): string {
  const lines = content.replace(/\r/g, '').split('\n');
  const blocks: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push(
        `<ul style="margin:12px 0;padding-left:20px;color:#374151;font-size:15px;line-height:1.7;">${listBuffer
          .map((li) => `<li style="margin:6px 0;">${li}</li>`)
          .join('')}</ul>`
      );
      listBuffer = [];
    }
  };

  const formatInline = (text: string): string => {
    let out = escapeHtml(text);
    // **bold**
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // *italic*
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // [text](url)
    out = out.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:#1a365d;font-weight:bold;text-decoration:underline;">$1</a>'
    );
    return out;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    // Heading: # Header
    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      const level = line.match(/^(#{1,3})/)![1].length;
      const text = formatInline(line.replace(/^#{1,3}\s+/, ''));
      const sizes = { 1: 24, 2: 20, 3: 17 } as Record<number, number>;
      blocks.push(
        `<h${level} style="color:#1a365d;font-size:${sizes[level]}px;font-weight:bold;margin:20px 0 10px;border-bottom:2px solid #f6c644;padding-bottom:6px;">${text}</h${level}>`
      );
      continue;
    }
    // List items: - item or * item
    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(formatInline(line.replace(/^[-*]\s+/, '')));
      continue;
    }
    flushList();
    blocks.push(
      `<p style="margin:12px 0;color:#374151;font-size:15px;line-height:1.7;">${formatInline(line)}</p>`
    );
  }
  flushList();
  return blocks.join('\n');
}

export function generateMarketingEmailHtml(opts: MarketingEmailOptions): string {
  const { subject, content, buttonText, buttonUrl, recipientName } = opts;

  // Personalize: replace {isim} / {name} placeholder with recipient name
  let personalizedContent = content;
  if (recipientName) {
    personalizedContent = personalizedContent
      .replace(/\{isim\}/gi, recipientName)
      .replace(/\{name\}/gi, recipientName);
  } else {
    personalizedContent = personalizedContent
      .replace(/\{isim\}/gi, '')
      .replace(/\{name\}/gi, '');
  }

  const bodyHtml = contentToHtml(personalizedContent);

  const ctaHtml =
    buttonText && buttonUrl
      ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(buttonUrl)}"
         style="display:inline-block;background:#f6c644;color:#1a365d;padding:14px 32px;border-radius:6px;font-weight:bold;font-size:16px;text-decoration:none;border:2px solid #1a365d;">
        ${escapeHtml(buttonText)}
      </a>
    </div>`
      : '';

  const rawHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#1a365d;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:0.5px;">Flughafen-muenchen.TAXI</h1>
          <p style="margin:8px 0 0;color:#f6c644;font-size:14px;font-weight:600;">Münchner Flughafen Transfer</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${bodyHtml}
          ${ctaHtml}
        </td></tr>
        <!-- Contact box -->
        <tr><td style="padding:0 32px 24px;">
          <div style="background:#1a365d;border-radius:8px;padding:18px;text-align:center;">
            <p style="margin:0 0 6px;color:#ffffff;font-size:13px;">Fragen? Wir sind für Sie da:</p>
            <p style="margin:4px 0;"><a href="tel:+4915141620000" style="color:#f6c644;text-decoration:none;font-weight:bold;">📞 +49 151 41620000</a></p>
            <p style="margin:4px 0;"><a href="https://wa.me/4915141620000" style="color:#f6c644;text-decoration:none;font-weight:bold;">💬 WhatsApp</a></p>
            <p style="margin:4px 0;"><a href="mailto:info@flughafen-muenchen.taxi" style="color:#f6c644;text-decoration:none;font-weight:bold;">✉️ info@flughafen-muenchen.taxi</a></p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">
            Flughafen-muenchen.TAXI · Eisvogelweg 2, 85356 Freising<br>
            <a href="https://flughafen-muenchen.taxi" style="color:#9ca3af;">flughafen-muenchen.taxi</a>
          </p>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:10px;">
            Sie erhalten diese E-Mail, weil Sie bei uns eine Fahrt gebucht haben.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  // Encode all non-ASCII characters as HTML entities to prevent encoding issues
  return encodeNonAscii(rawHtml);
}

export interface MarketingRecipient {
  email: string;
  name?: string;
}

export interface MarketingSendResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

// Send marketing email in bulk via Resend Batch API (max 100 per batch)
export async function sendMarketingEmail(
  recipients: MarketingRecipient[],
  opts: MarketingEmailOptions
): Promise<MarketingSendResult> {
  const resend = new Resend(RESEND_API_KEY);
  const result: MarketingSendResult = { sent: 0, failed: 0, errors: [] };

  // De-duplicate by email (case-insensitive)
  const seen = new Set<string>();
  const unique = recipients.filter((r) => {
    const key = r.email.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const fromAddress = `Flughafen-muenchen.TAXI <${FROM_EMAIL}>`;
  const BATCH_SIZE = 100;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise(r => setTimeout(r, 500));
    const batch = unique.slice(i, i + BATCH_SIZE);
    const payload = batch.map((r) => ({
      from: fromAddress,
      to: r.email,
      subject: opts.subject,
      html: opts.isHtml
        ? encodeNonAscii(opts.content.replace(/\{isim\}/gi, r.name || '').replace(/\{name\}/gi, r.name || ''))
        : generateMarketingEmailHtml({ ...opts, recipientName: r.name }),
    }));

    try {
      const response = await (resend.batch as any).send(payload);
      // Resend batch returns { data: [{ id }, ...] } on success
      if (response?.error) {
        result.failed += batch.length;
        for (const r of batch) {
          result.errors.push({ email: r.email, error: response.error.message || 'Batch error' });
        }
      } else {
        result.sent += batch.length;
      }
    } catch (err: any) {
      // Fallback: send one by one if batch fails (e.g. SDK version doesn't support batch)
      console.warn('Batch send failed, falling back to per-email send:', err?.message);
      for (const r of batch) {
        try {
          await resend.emails.send({
            from: fromAddress,
            to: r.email,
            subject: opts.subject,
            html: opts.isHtml
              ? encodeNonAscii(opts.content.replace(/\{isim\}/gi, r.name || '').replace(/\{name\}/gi, r.name || ''))
              : generateMarketingEmailHtml({ ...opts, recipientName: r.name }),
          });
          result.sent++;
        } catch (sendErr: any) {
          result.failed++;
          result.errors.push({ email: r.email, error: sendErr?.message || 'Send failed' });
        }
      }
    }
  }

  return result;
}

// Cancellation email to customer
// Cancellation mails (customer DE/EN/TR, admin on self-service) — layout in bookingEmailTemplates.ts
export async function sendCancellationEmail(booking: BookingNotificationData): Promise<void> {
  const { subject, html } = customerCancellationEmail(booking);
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: booking.email,
    subject,
    html,
  });
}

export async function sendAdminCancellationEmail(booking: BookingNotificationData): Promise<void> {
  const { subject, html } = adminCancellationEmail(booking);
  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: ADMIN_EMAIL,
    subject,
    html,
  });
}

export async function sendReminderEmail(booking: BookingNotificationData): Promise<void> {
  const resend = new Resend(RESEND_API_KEY);
  const lang = ['de', 'en', 'tr'].includes(booking.language) ? booking.language : 'de';
  // Havalimanı ABHOLUNG: müşteri havalimanından alınıyor (pickup_address'te Flughafen var)
  const pickupIsAirport = /flughafen|airport|muc|terminal/i.test(booking.pickup_address || '');
  const hasFlightNumber = !!(booking.flight_number && booking.flight_number.trim());
  const isAirport = hasFlightNumber; // genel airport trip (uçuş no varsa)
  const showFlightTracking = hasFlightNumber && pickupIsAirport; // tracking notu sadece abholung'da

  const pickupDate = new Date(booking.pickup_datetime);
  const pickupTime = pickupDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const pickupDateStr = pickupDate.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const pickupDateStrEN = pickupDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const pickupDateStrTR = pickupDate.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const vehicleLabels: Record<string, Record<string, string>> = {
    de: { kombi: 'Kombi (bis 4 Pers.)', van: 'Van (bis 7 Pers.)', grossraumtaxi: 'Großraumtaxi (bis 8 Pers.)' },
    en: { kombi: 'Kombi (up to 4 pax)', van: 'Van (up to 7 pax)', grossraumtaxi: 'Minivan (up to 8 pax)' },
    tr: { kombi: 'Kombi (4 kişiye kadar)', van: 'Van (7 kişiye kadar)', grossraumtaxi: 'Büyük Araç (8 kişiye kadar)' },
  };
  const vehicleLabel = vehicleLabels[lang]?.[booking.vehicle_type] || booking.vehicle_type;

  const flightRow = (isAirport && booking.flight_number)
    ? `<tr><td style="padding:6px 0;color:#666;width:40%;">${lang === 'de' ? 'Flugnummer' : lang === 'en' ? 'Flight Number' : 'Uçuş No'}</td><td style="padding:6px 0;color:#333;font-weight:bold;">${booking.flight_number}</td></tr>`
    : '';

  const noteDE = showFlightTracking
    ? `✈️ <strong>Flugstatus-Tracking:</strong><br>Wir beobachten Ihren Flugstatus in Echtzeit. Auch bei Verspätungen wird Ihr Fahrer angepasst. Bitte halten Sie Ihr Telefon erreichbar.`
    : `📋 <strong>Bitte beachten:</strong><br>Ihr Fahrer wird Sie pünktlich am vereinbarten Treffpunkt abholen. Bitte halten Sie Ihr Telefon erreichbar.`;

  const noteEN = showFlightTracking
    ? `✈️ <strong>Live Flight Tracking:</strong><br>We monitor your flight status in real time. Even if your flight is delayed, your driver will adjust accordingly. Please keep your phone reachable.`
    : `📋 <strong>Please note:</strong><br>Your driver will pick you up punctually at the agreed location. Please keep your phone reachable.`;

  const noteTR = showFlightTracking
    ? `✈️ <strong>Uçuş Takibi:</strong><br>Uçuşunuzu gerçek zamanlı takip ediyoruz. Gecikme durumunda sürücümüz buna göre ayarlama yapar. Lütfen telefonunuzu açık tutun.`
    : `📋 <strong>Lütfen dikkat:</strong><br>Sürücümüz sizi belirlenen noktada tam zamanında karşılayacak. Lütfen telefonunuzu açık tutun.`;

  const detailsTable = (labels: { bn: string; date: string; time: string; pickup: string; drop: string; vehicle: string; pax: string; price: string }, note: string, dateStr: string) => `
    <div style="background:#f0f4f8;border-left:4px solid #f6c644;border-radius:6px;padding:20px;margin:20px 0;">
      <h2 style="color:#1a365d;font-size:16px;margin:0 0 15px;">🚕 ${lang === 'de' ? 'Fahrtdetails' : lang === 'en' ? 'Trip Details' : 'Transfer Detayları'}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#666;width:40%;">${labels.bn}</td><td style="padding:6px 0;color:#1a365d;font-weight:bold;">${booking.booking_number}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">${labels.date}</td><td style="padding:6px 0;color:#333;">${dateStr}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">${labels.time}</td><td style="padding:6px 0;color:#1a365d;font-weight:bold;">${pickupTime} Uhr</td></tr>
        <tr><td style="padding:6px 0;color:#666;">${labels.pickup}</td><td style="padding:6px 0;color:#333;">${addressIcon(booking.pickup_address)}${booking.pickup_address}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">${labels.drop}</td><td style="padding:6px 0;color:#333;">${addressIcon(booking.dropoff_address)}${booking.dropoff_address}</td></tr>
        ${flightRow}
        <tr><td style="padding:6px 0;color:#666;">${labels.vehicle}</td><td style="padding:6px 0;color:#333;">${vehicleLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">${labels.pax}</td><td style="padding:6px 0;color:#333;">${booking.passengers}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">${labels.price}</td><td style="padding:6px 0;color:#1a365d;font-weight:bold;">€${formatPrice(booking.price)}</td></tr>
      </table>
    </div>
    <div style="background:#fff8e1;border:1px solid #f6c644;border-radius:6px;padding:15px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#555;">${note}</p>
    </div>`;

  const contact = `
    <p style="font-size:14px;color:#555;">
      📞 <a href="tel:+4915141620000" style="color:#1a365d;">+49 151 41620000</a><br>
      💬 WhatsApp: <a href="https://wa.me/4915141620000" style="color:#1a365d;">+49 151 41620000</a><br>
      ✉️ <a href="mailto:info@flughafen-muenchen.taxi" style="color:#1a365d;">info@flughafen-muenchen.taxi</a>
    </p>`;

  const footer = `
    <div style="background:#1a365d;padding:20px;text-align:center;">
      <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} Flughafen-muenchen.TAXI · <a href="https://flughafen-muenchen.taxi" style="color:#f6c644;">flughafen-muenchen.taxi</a></p>
    </div>`;

  const headerSubtitle = lang === 'de'
    ? 'Ihr zuverlässiger Flughafentransfer'
    : lang === 'en' ? 'Your reliable airport transfer'
    : 'Güvenilir havalimanı transferiniz';

  let subject: string;
  let bodyHtml: string;

  if (lang === 'de') {
    subject = `Erinnerung: Ihre Fahrt morgen – ${booking.booking_number}`;
    bodyHtml = `
      <p style="font-size:16px;color:#333;">Guten Tag, <strong>${booking.name}</strong>,</p>
      <p style="font-size:15px;color:#555;line-height:1.6;">wir möchten Sie an Ihre ${isAirport ? 'Flughafen-Fahrt' : 'Fahrt'} <strong>morgen</strong> erinnern. Wir freuen uns, Sie pünktlich zu Ihrem Ziel zu bringen.</p>
      ${detailsTable({ bn: 'Buchungsnummer', date: 'Datum', time: 'Abfahrtszeit', pickup: 'Abholadresse', drop: 'Zieladresse', vehicle: 'Fahrzeug', pax: 'Passagiere', price: 'Gesamtpreis' }, noteDE, pickupDateStr)}
      ${contact}
      <p style="font-size:14px;color:#555;margin-top:25px;">Wir wünschen Ihnen eine angenehme Fahrt!<br><br>Mit freundlichen Grüßen,<br><strong>Ihr Flughafen-muenchen.TAXI Team</strong></p>`;
  } else if (lang === 'en') {
    subject = `Reminder: Your transfer tomorrow – ${booking.booking_number}`;
    bodyHtml = `
      <p style="font-size:16px;color:#333;">Dear <strong>${booking.name}</strong>,</p>
      <p style="font-size:15px;color:#555;line-height:1.6;">This is a friendly reminder about your ${isAirport ? 'airport transfer' : 'transfer'} <strong>tomorrow</strong>. We look forward to getting you there on time.</p>
      ${detailsTable({ bn: 'Booking Number', date: 'Date', time: 'Pickup Time', pickup: 'Pickup Address', drop: 'Destination', vehicle: 'Vehicle', pax: 'Passengers', price: 'Total Price' }, noteEN, pickupDateStrEN)}
      ${contact}
      <p style="font-size:14px;color:#555;margin-top:25px;">We wish you a pleasant journey!<br><br>Kind regards,<br><strong>Your Flughafen-muenchen.TAXI Team</strong></p>`;
  } else {
    subject = `Hatırlatma: Yarınki transferiniz – ${booking.booking_number}`;
    bodyHtml = `
      <p style="font-size:16px;color:#333;">Sayın <strong>${booking.name}</strong>,</p>
      <p style="font-size:15px;color:#555;line-height:1.6;"><strong>Yarınki</strong> ${isAirport ? 'havalimanı transferinizi' : 'transferinizi'} hatırlatmak istedik. Sizi zamanında ve konforlu şekilde hedefinize ulaştırmaktan mutluluk duyacağız.</p>
      ${detailsTable({ bn: 'Rezervasyon No', date: 'Tarih', time: 'Alış Saati', pickup: 'Alış Adresi', drop: 'Varış Adresi', vehicle: 'Araç', pax: 'Yolcu Sayısı', price: 'Toplam Tutar' }, noteTR, pickupDateStrTR)}
      ${contact}
      <p style="font-size:14px;color:#555;margin-top:25px;">İyi yolculuklar dileriz!<br><br>Saygılarımızla,<br><strong>Flughafen-muenchen.TAXI Ekibi</strong></p>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#1a365d;padding:30px;text-align:center;">
      <h1 style="color:#f6c644;margin:0;font-size:22px;">Flughafen-muenchen.TAXI</h1>
      <p style="color:#ffffff;margin:8px 0 0;font-size:14px;">${headerSubtitle}</p>
    </div>
    <div style="padding:30px;">
      ${bodyHtml}
    </div>
    ${footer}
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: booking.email,
    subject,
    html,
  });
}

export async function sendAllNotifications(booking: BookingNotificationData): Promise<void> {
  const results = await Promise.allSettled([
    sendAdminNotification(booking),
    sendCustomerConfirmation(booking),
    sendWhatsAppNotification(booking),
  ]);

  results.forEach((result, index) => {
    const names = ['Admin Email', 'Customer Email', 'WhatsApp (CallMeBot)'];
    if (result.status === 'rejected') {
      console.error(`Failed to send ${names[index]}:`, result.reason);
    } else {
      console.log(`${names[index]} sent successfully`);
    }
  });
}
