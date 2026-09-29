// E-mails of the live-tracking feature: the customer is told when the driver sets off and
// when they are waiting (each at most once per ride — see driverTracking.onStageReached),
// or gets the tracking link on demand; the office gets the alerts it opted into.

import { Resend } from 'resend';
import type { AlertKind, L3, MeetingPointKey } from './driverTracking';

const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;
const COMPANY_PHONE = '+49 151 41620000';
const COMPANY_PHONE_TEL = '+4915141620000';
const COMPANY_WHATSAPP = '4915141620000';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtPickup(dt: string, lang: 'de' | 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(dt || ''));
  if (!m) return String(dt || '');
  return lang === 'en' ? `${m[3]}/${m[2]}/${m[1]}, ${m[4]}:${m[5]}` : `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]} Uhr`;
}

function plateHtml(plate: string): string {
  return `<span style="display:inline-block;border:2px solid #111827;border-radius:4px;background:#fff;font-family:'Courier New',monospace;font-weight:bold;font-size:15px;letter-spacing:1px;color:#111827;overflow:hidden;vertical-align:middle">`
    + `<span style="display:inline-block;background:#1e40af;color:#fff;font-size:10px;padding:5px 4px;vertical-align:top">D</span>`
    + `<span style="display:inline-block;padding:3px 8px">${esc(plate)}</span></span>`;
}

function layout(title: string, inner: string, lang: 'de' | 'en'): string {
  const help = lang === 'en' ? 'Questions? We are here for you:' : 'Fragen? Wir sind für Sie da:';
  const why = lang === 'en'
    ? 'You are receiving this e-mail because you booked a ride with us.'
    : 'Sie erhalten diese E-Mail, weil Sie bei uns eine Fahrt gebucht haben.';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
        <tr><td style="background:#1a365d;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px;">Flughafen-muenchen.TAXI</h1>
        </td></tr>
        <tr><td style="padding:30px 32px 8px;">${inner}</td></tr>
        <tr><td style="padding:16px 32px 24px;">
          <div style="background:#1a365d;border-radius:8px;padding:16px;text-align:center;">
            <p style="margin:0 0 6px;color:#ffffff;font-size:13px;">${help}</p>
            <p style="margin:4px 0;"><a href="tel:${COMPANY_PHONE_TEL}" style="color:#f6c644;text-decoration:none;font-weight:bold;">📞 ${COMPANY_PHONE}</a>
            &nbsp;·&nbsp;<a href="https://wa.me/${COMPANY_WHATSAPP}" style="color:#f6c644;text-decoration:none;font-weight:bold;">💬 WhatsApp</a></p>
          </div>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:14px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;">Flughafen-muenchen.TAXI · Eisvogelweg 2, 85356 Freising</p>
          <p style="margin:6px 0 0;color:#9ca3af;font-size:10px;">${why}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<div style="text-align:center;margin:26px 0 8px;">
    <a href="${esc(href)}" style="display:inline-block;background:#f6c644;color:#1a365d;padding:14px 30px;border-radius:8px;font-weight:bold;font-size:16px;text-decoration:none;">${esc(label)}</a>
  </div>`;
}

export interface CustomerMailInput {
  booking: any;
  trackUrl: string;
  etaMinutes: number | null;
  meetingPoint: { key: MeetingPointKey | 'airport'; label: L3; text: L3 } | null;
}

export async function sendTrackingCustomerEmail(kind: 'link' | 'enroute' | 'arrived', input: CustomerMailInput): Promise<void> {
  const b = input.booking;
  if (!b?.email) return;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn(`[tracking] RESEND_API_KEY not set — ${kind} mail to ${b.email} skipped`);
    return;
  }
  const { subject, html } = buildTrackingCustomerEmail(kind, input);
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `Flughafen München Taxi <${FROM_EMAIL}>`,
    to: b.email,
    subject,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

export function buildTrackingCustomerEmail(kind: 'link' | 'enroute' | 'arrived', input: CustomerMailInput): { subject: string; html: string } {
  const b = input.booking;
  const lang: 'de' | 'en' = b.language === 'en' ? 'en' : 'de';
  const en = lang === 'en';
  const driver = b.driver_name ? esc(b.driver_name) : (en ? 'Your driver' : 'Ihr Fahrer');
  const salutation = b.name ? (en ? `Hello ${esc(b.name)},` : `Hallo ${esc(b.name)},`) : (en ? 'Hello,' : 'Guten Tag,');

  let subject = '';
  let headline = '';
  let lead = '';
  if (kind === 'enroute') {
    subject = en ? `🚕 Your driver is on the way – ${b.booking_number}` : `🚕 Ihr Fahrer ist unterwegs – ${b.booking_number}`;
    headline = en ? 'Your driver is on the way' : 'Ihr Fahrer ist unterwegs';
    lead = input.etaMinutes != null
      ? (en ? `${driver} is on the way to you and will arrive in about <b>${input.etaMinutes} minutes</b>.`
            : `${driver} ist auf dem Weg zu Ihnen und in ca. <b>${input.etaMinutes} Minuten</b> da.`)
      : (en ? `${driver} is on the way to you.` : `${driver} ist auf dem Weg zu Ihnen.`);
  } else if (kind === 'arrived') {
    subject = en ? `✅ Your driver has arrived – ${b.booking_number}` : `✅ Ihr Fahrer ist da – ${b.booking_number}`;
    headline = en ? 'Your driver has arrived' : 'Ihr Fahrer ist da';
    lead = en ? `${driver} has arrived at the pickup point and is waiting for you.` : `${driver} ist am Abholort angekommen und wartet auf Sie.`;
  } else {
    subject = en ? `📍 Track your ride live – ${b.booking_number}` : `📍 Ihre Fahrt live verfolgen – ${b.booking_number}`;
    headline = en ? 'Follow your driver live' : 'Ihren Fahrer live verfolgen';
    lead = en
      ? `On the day of your ride you can follow your driver on the map — pickup ${esc(fmtPickup(b.pickup_datetime, lang))}.`
      : `Am Tag Ihrer Fahrt sehen Sie Ihren Fahrer live auf der Karte — Abholung ${esc(fmtPickup(b.pickup_datetime, lang))}.`;
  }

  const vehicle = (b.driver_model || b.driver_plate) && kind !== 'link'
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px">${en ? 'Vehicle' : 'Fahrzeug'}</td>
         <td style="padding:6px 0;font-size:14px;color:#111827">${esc(b.driver_model || '')} ${b.driver_plate ? plateHtml(b.driver_plate) : ''}</td></tr>`
    : '';
  const driverRow = b.driver_name && kind !== 'link'
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px">${en ? 'Driver' : 'Fahrer'}</td>
         <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:bold">${esc(b.driver_name)}${b.driver_phone
           ? ` &nbsp;<a href="tel:${esc(String(b.driver_phone).replace(/\s+/g, ''))}" style="color:#1a365d;font-weight:normal">📞 ${esc(b.driver_phone)}</a>` : ''}</td></tr>`
    : '';
  const pickupRow = `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:110px">${en ? 'Pickup' : 'Abholung'}</td>
      <td style="padding:6px 0;font-size:14px;color:#111827">${esc(fmtPickup(b.pickup_datetime, lang))}<br>${esc(b.pickup_address)}</td></tr>`;

  const mp = input.meetingPoint;
  const sign = b.pickup_sign || b.name;
  const meeting = mp && kind !== 'link'
    ? `<div style="margin-top:18px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;">
         <div style="font-weight:bold;color:#92400e;font-size:14px;margin-bottom:4px">📍 ${en ? 'Meeting point' : 'Treffpunkt'}: ${esc(mp.label[lang])}</div>
         <div style="color:#78350f;font-size:13px;line-height:1.5">${esc(mp.text[lang])}${sign
           ? `<br>${en ? 'Name on the sign' : 'Name auf dem Schild'}: <b>${esc(sign)}</b>` : ''}</div>
       </div>`
    : '';

  const inner = `
    <p style="margin:0 0 6px;color:#374151;font-size:15px;">${salutation}</p>
    <h2 style="margin:0 0 10px;color:#1a365d;font-size:22px;">${headline}</h2>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.55;">${lead}</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
      ${driverRow}${vehicle}${pickupRow}
    </table>
    ${meeting}
    ${button(input.trackUrl, en ? 'Track ride live' : 'Fahrt live verfolgen')}
    <p style="margin:6px 0 0;text-align:center;color:#9ca3af;font-size:11px;">${en ? 'Booking' : 'Buchung'} ${esc(b.booking_number)}</p>`;

  return { subject, html: layout(subject, inner, lang) };
}

const ADMIN_LABEL: Record<AlertKind, string> = {
  enroute: '🚕 Fahrer ist losgefahren',
  arrived: '📍 Fahrer ist am Abholort',
  onboard: '🧳 Fahrgast an Bord',
  completed: '🏁 Fahrt beendet',
  gps_lost: '⚠️ GPS-Signal verloren',
};

export async function sendTrackingAdminEmail(kind: AlertKind, b: any, detail: string, to: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  const subject = `[Tracking] ${ADMIN_LABEL[kind]} – ${b.booking_number}`;
  const rows = [
    ['Buchung', b.booking_number],
    ['Abholung', `${fmtPickup(b.pickup_datetime, 'de')} · ${b.pickup_address}`],
    ['Ziel', b.dropoff_address],
    ['Kunde', `${b.name || ''} ${b.phone ? `· ${b.phone}` : ''}`],
    ['Fahrer', `${b.driver_name || '—'} ${b.driver_phone ? `· ${b.driver_phone}` : ''}`],
    ['Info', detail],
  ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px">${esc(k)}</td><td style="padding:4px 0;font-size:13px;color:#111827">${esc(v)}</td></tr>`).join('');
  const inner = `<h2 style="margin:0 0 12px;color:#1a365d;font-size:20px;">${esc(ADMIN_LABEL[kind])}</h2>
    <table cellpadding="0" cellspacing="0">${rows}</table>
    ${button('https://flughafen-muenchen.taxi/admin', 'Admin öffnen')}`;
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `Tracking <${FROM_EMAIL}>`,
    to: to || ADMIN_EMAIL,
    subject,
    html: layout(subject, inner, 'de'),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
