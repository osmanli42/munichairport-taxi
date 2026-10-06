// New design for the booking mails (customer confirmation DE/EN/TR + admin notification).
// Table layout with inline styles — what Gmail, Apple Mail and Outlook render the same way —
// in the site's colours (navy + gold), readable on a phone first.
//
// Same data and the same price rounding as notifications.ts; only the presentation changes.

import type { BookingNotificationData } from './notifications';
import { formatPhoneDisplay } from '../utils/phone';

const SITE = 'https://flughafen-muenchen.taxi';
const PHONE = '+49 151 41620000';
const PHONE_LINK = 'tel:+4915141620000';
const WHATSAPP = 'https://wa.me/4915141620000';
const MAIL = 'info@flughafen-muenchen.taxi';

const C = {
  navy: '#0f2747', navy2: '#1a365d', gold: '#c99a2e', goldSoft: '#fdf6e3',
  text: '#111827', muted: '#6b7280', line: '#e5e7eb', soft: '#f6f7f9', green: '#047857',
};

type Lang = 'de' | 'en' | 'tr';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Same rounding as notifications.ts (up to the next 0.50 €), German number format.
function money(price: number): string {
  const rounded = Math.ceil(price * 2) / 2;
  return `${rounded.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const WEEKDAYS: Record<Lang, string[]> = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
};

/** 'YYYY-MM-DDTHH:mm' (Berlin wall clock) → { day: 'Mi, 07.10.2026', time: '06:30' } */
function when(s: string | undefined, lang: Lang): { day: string; time: string } {
  const v = String(s || '').replace(' ', 'T');
  const d = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { day: v, time: '' };
  const wd = WEEKDAYS[lang][new Date(`${d}T12:00:00Z`).getUTCDay()];
  return { day: `${wd}, ${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`, time: v.slice(11, 16) };
}

const isAirport = (a: string) => /flughafen|airport|terminal|\bMUC\b/i.test(a || '');

const VEHICLE: Record<string, { img: string; label: Record<Lang, string> }> = {
  kombi: { img: 'kombi', label: { de: 'Kombi · bis 4 Personen', en: 'Estate car · up to 4 people', tr: 'Kombi · 4 kişiye kadar' } },
  van: { img: 'van', label: { de: 'Van · bis 7 Personen', en: 'Van · up to 7 people', tr: 'Van · 7 kişiye kadar' } },
  grossraumtaxi: { img: 'grossraumtaxi', label: { de: 'Großraumtaxi · bis 8 Personen', en: 'Large taxi · up to 8 people', tr: 'Büyük taksi · 8 kişiye kadar' } },
};

const PAYMENT: Record<string, Record<Lang, string>> = {
  cash: { de: 'Bar beim Fahrer', en: 'Cash to the driver', tr: 'Şoföre nakit' },
  card: { de: 'Kreditkarte', en: 'Credit card', tr: 'Kredi kartı' },
  rechnung: { de: 'Auf Rechnung', en: 'By invoice', tr: 'Faturalı' },
  invoice: { de: 'Auf Rechnung', en: 'By invoice', tr: 'Faturalı' },
  ueberweisung: { de: 'Überweisung', en: 'Bank transfer', tr: 'Havale' },
};
const payLabel = (m: string, l: Lang) => PAYMENT[m]?.[l] || PAYMENT.cash[l];

const T: Record<Lang, Record<string, string>> = {
  de: {
    subject: 'Buchung eingegangen', status: 'Buchung eingegangen', hello: 'Hallo',
    intro: 'vielen Dank für Ihre Buchung! Wir haben Ihre Anfrage erhalten und melden uns in Kürze bei Ihnen.',
    bookingNo: 'Buchungsnummer', outbound: 'Hinfahrt', ret: 'Rückfahrt', trip: 'Ihre Fahrt',
    pickup: 'Abholung', stop: 'Zwischenstopp', dropoff: 'Ziel', approx: 'ca.', min: 'Min.',
    price: 'Preis', total: 'Gesamtpreis', oneway: 'Einfache Fahrt', twice: '× 2 (Hin & Rück)',
    rtDiscount: 'Rabatt Hin- & Rückfahrt', approach: 'Anfahrt', bike: 'Fahrrad', base: 'Grundpreis', promo: 'Rabattcode',
    payment: 'Zahlung', cardHint: 'Die Karte wird am Tag vor der Fahrt belastet.', fixed: 'Festpreis — der Preis steht bei der Buchung fest.',
    details: 'Details', passengers: 'Personen', luggage: 'Gepäck', vehicle: 'Fahrzeug', flight: 'Flugnummer',
    sign: 'Abholschild', child: 'Kindersitz', childYes: 'Ja, kostenlos', notes: 'Ihre Anmerkungen', pieces: 'Stück',
    next: 'So geht es weiter',
    step1: 'Wir prüfen Ihre Buchung und melden uns bei Rückfragen.',
    step2: 'Am Vortag bekommen Sie eine Erinnerung per E-Mail.',
    stepAirport: 'Abholung am Flughafen: So finden Sie Ihren Fahrer',
    stepHome: 'Bitte seien Sie zur Abholzeit bereit und telefonisch erreichbar.',
    manage: 'Buchung ansehen / stornieren', call: 'Anrufen', write: 'WhatsApp',
    night: 'Nachtfahrt: Bitte rufen Sie uns sicherheitshalber zusätzlich kurz an, damit Ihr Fahrer ganz sicher bereitsteht.',
    questions: 'Fragen? Wir sind rund um die Uhr erreichbar.',
  },
  en: {
    subject: 'Booking received', status: 'Booking received', hello: 'Hello',
    intro: 'thank you for your booking! We have received your request and will get back to you shortly.',
    bookingNo: 'Booking number', outbound: 'Outbound', ret: 'Return', trip: 'Your trip',
    pickup: 'Pickup', stop: 'Stop', dropoff: 'Destination', approx: 'approx.', min: 'min',
    price: 'Price', total: 'Total', oneway: 'One way', twice: '× 2 (round trip)',
    rtDiscount: 'Round-trip discount', approach: 'Approach fee', bike: 'Bicycle', base: 'Base price', promo: 'Promo code',
    payment: 'Payment', cardHint: 'Your card is charged the day before the ride.', fixed: 'Fixed price — agreed when you book.',
    details: 'Details', passengers: 'Passengers', luggage: 'Luggage', vehicle: 'Vehicle', flight: 'Flight number',
    sign: 'Name sign', child: 'Child seat', childYes: 'Yes, free of charge', notes: 'Your notes', pieces: 'pcs',
    next: 'What happens next',
    step1: 'We check your booking and get in touch if anything is unclear.',
    step2: 'You get a reminder by e-mail the day before.',
    stepAirport: 'Airport pickup: how to find your driver',
    stepHome: 'Please be ready at the pickup time and reachable by phone.',
    manage: 'View / cancel booking', call: 'Call', write: 'WhatsApp',
    night: 'Night ride: please also give us a quick call, just to be sure your driver is ready.',
    questions: 'Questions? We are available around the clock.',
  },
  tr: {
    subject: 'Rezervasyon alındı', status: 'Rezervasyon alındı', hello: 'Merhaba',
    intro: 'rezervasyonunuz için teşekkürler! Talebinizi aldık, en kısa sürede size dönüş yapacağız.',
    bookingNo: 'Rezervasyon numarası', outbound: 'Gidiş', ret: 'Dönüş', trip: 'Yolculuğunuz',
    pickup: 'Alış', stop: 'Ara durak', dropoff: 'Varış', approx: 'yakl.', min: 'dk',
    price: 'Fiyat', total: 'Toplam', oneway: 'Tek yön', twice: '× 2 (gidiş-dönüş)',
    rtDiscount: 'Gidiş-dönüş indirimi', approach: 'Yaklaşım ücreti', bike: 'Bisiklet', base: 'Temel fiyat', promo: 'Promosyon kodu',
    payment: 'Ödeme', cardHint: 'Kartınızdan yolculuktan bir gün önce çekilir.', fixed: 'Sabit fiyat — rezervasyonda belirlenir.',
    details: 'Detaylar', passengers: 'Yolcu', luggage: 'Bagaj', vehicle: 'Araç', flight: 'Uçuş numarası',
    sign: 'Karşılama tabelası', child: 'Çocuk koltuğu', childYes: 'Evet, ücretsiz', notes: 'Notlarınız', pieces: 'adet',
    next: 'Bundan sonra',
    step1: 'Rezervasyonunuzu kontrol ediyoruz; sorumuz olursa size ulaşırız.',
    step2: 'Yolculuktan bir gün önce e-posta ile hatırlatma alırsınız.',
    stepAirport: 'Havalimanında alış: şoförünüzü nasıl bulursunuz',
    stepHome: 'Lütfen alış saatinde hazır ve telefonla ulaşılabilir olun.',
    manage: 'Rezervasyonu gör / iptal et', call: 'Ara', write: 'WhatsApp',
    night: 'Gece yolculuğu: Şoförünüzün kesin hazır olması için lütfen bizi ayrıca kısaca arayın.',
    questions: 'Sorularınız mı var? 7/24 ulaşabilirsiniz.',
  },
};

const localePath = (lang: Lang, path: string) => `${SITE}${lang === 'de' ? '' : `/${lang}`}${path}`;

// ---- building blocks ------------------------------------------------------------------

function button(href: string, label: string, primary = true): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:11px 16px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;${
    primary ? `background:${C.navy};color:#fff` : `background:#fff;color:${C.navy};border:1px solid ${C.line}`}">${label}</a>`;
}

function route(b: BookingNotificationData, t: Record<string, string>, reverse = false): string {
  const from = reverse ? b.dropoff_address : b.pickup_address;
  const to = reverse ? b.pickup_address : b.dropoff_address;
  const point = (color: string, label: string, addr: string, last = false) => `
    <tr>
      <td width="22" style="vertical-align:top;padding-top:3px">
        <div style="width:12px;height:12px;border-radius:50%;background:${color};margin:0 auto"></div>
        ${last ? '' : `<div style="width:2px;height:30px;background:${C.line};margin:3px auto 0"></div>`}
      </td>
      <td style="vertical-align:top;padding:0 0 ${last ? 0 : 10}px 8px">
        <div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:.05em">${label}</div>
        <div style="font-size:14px;color:${C.text};font-weight:600;line-height:1.35">${isAirport(addr) ? '✈️ ' : ''}${esc(addr)}</div>
      </td>
    </tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0">
    ${point(C.navy, t.pickup, from)}
    ${b.zwischenstopp_address && !reverse ? point('#2563eb', t.stop, b.zwischenstopp_address) : ''}
    ${point(C.gold, t.dropoff, to, true)}
  </table>`;
}

function infoRows(rows: Array<[string, string] | null>): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${
    rows.filter((r): r is [string, string] => !!r).map(([k, v]) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid ${C.line};color:${C.muted};vertical-align:top">${k}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid ${C.line};color:${C.text};font-weight:600;text-align:right;vertical-align:top">${v}</td>
      </tr>`).join('')
  }</table>`;
}

function card(inner: string, extra = ''): string {
  return `<tr><td style="padding:0 20px 14px">
    <div style="border:1px solid ${C.line};border-radius:14px;padding:16px 18px;background:#fff;${extra}">${inner}</div>
  </td></tr>`;
}

const heading = (s: string) => `<div style="font-size:13px;font-weight:700;color:${C.navy};text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">${s}</div>`;

function priceRows(b: BookingNotificationData, t: Record<string, string>, forAdmin: boolean): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (b.trip_type === 'roundtrip' && b.oneway_price !== undefined) {
    rows.push([t.oneway, money(b.oneway_price)]);
    rows.push([t.twice, money(b.oneway_price * 2)]);
    rows.push([t.rtDiscount, `<span style="color:${C.green}">−${b.roundtrip_discount ?? 0} %</span>`]);
  }
  if (b.anfahrt_cost) rows.push([t.approach, money(b.anfahrt_cost)]);
  if (b.fahrrad_count && b.fahrrad_count > 0) rows.push([`${t.bike} ${b.fahrrad_count}×`, money(b.fahrrad_total ?? 0)]);
  const showAuto = !!(b.auto_discount_name && b.auto_discount_amount && b.base_total && (forAdmin || b.auto_discount_show_in_email));
  const showPromo = !!(b.promo_code && b.discount_amount && b.base_total);
  if (showAuto || showPromo) {
    rows.push([t.base, money(b.base_total! - (showAuto ? 0 : (b.auto_discount_amount || 0)))]);
    if (showAuto) rows.push([esc(b.auto_discount_name), `<span style="color:${C.green}">−${money(b.auto_discount_amount!)}</span>`]);
    if (showPromo) rows.push([`${t.promo} ${esc(b.promo_code)}`, `<span style="color:${C.green}">−${money(b.discount_amount!)}</span>`]);
  }
  return rows;
}

// ---- customer ---------------------------------------------------------------------------

export function customerConfirmationEmail(b: BookingNotificationData): { subject: string; html: string } {
  const lang: Lang = (['de', 'en', 'tr'].includes(b.language) ? b.language : 'de') as Lang;
  const t = T[lang];
  const out = when(b.pickup_datetime, lang);
  const back = b.return_datetime ? when(b.return_datetime, lang) : null;
  const vehicle = VEHICLE[b.vehicle_type] || VEHICLE.kombi;
  const airportPickup = isAirport(b.pickup_address) || (!!back && isAirport(b.dropoff_address));
  const firstName = String(b.name || '').trim();

  const dateBlock = (label: string, w: { day: string; time: string }) => `
    <td style="vertical-align:top;padding-right:12px">
      <div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:.05em">${label}</div>
      <div style="font-size:15px;color:${C.text};font-weight:600;margin-top:2px">${esc(w.day)}</div>
      <div style="font-size:26px;color:${C.navy};font-weight:800;line-height:1.1">${esc(w.time)}</div>
    </td>`;

  const prices = priceRows(b, t, false);
  const html = `
<div style="background:#eef1f5;padding:20px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid ${C.line}">
  <tr><td style="background:${C.navy};padding:22px 20px 20px">
    <img src="${SITE}/images/logo-wide-400.webp" width="200" alt="Flughafen-München.TAXI" style="display:block;border:0;max-width:200px;height:auto">
    <div style="margin-top:18px">
      <span style="display:inline-block;background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">✓ ${t.status}</span>
    </div>
    <div style="font-size:22px;color:#fff;font-weight:700;margin-top:10px">${t.hello} ${esc(firstName)},</div>
    <div style="font-size:14px;color:#cbd5e1;margin-top:6px;line-height:1.5">${t.intro}</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:12px">${t.bookingNo}: <span style="color:${C.gold};font-weight:700;letter-spacing:.03em">${esc(b.booking_number)}</span></div>
  </td></tr>

  <tr><td style="height:16px"></td></tr>

  ${b.night_confirm ? card(`<div style="font-size:14px;color:#92400e;line-height:1.5">🌙 ${t.night}</div>
    <div style="margin-top:10px">${button(PHONE_LINK, `📞 ${PHONE}`)}</div>`, `background:#fffbeb;border-color:#fcd34d`) : ''}

  ${card(`
    ${heading(t.trip)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
      ${dateBlock(back ? t.outbound : t.pickup, out)}
      ${back ? dateBlock(t.ret, back) : ''}
    </tr></table>
    ${route(b, t)}
    ${b.distance_km || b.duration_minutes ? `<div style="margin-top:12px;font-size:12px;color:${C.muted}">
      ${b.distance_km ? `${Number(b.distance_km).toFixed(1).replace('.', ',')} km` : ''}${b.distance_km && b.duration_minutes ? ' · ' : ''}${b.duration_minutes ? `${t.approx} ${b.duration_minutes} ${t.min}` : ''}
    </div>` : ''}
  `)}

  ${card(`
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle">
        <div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:.05em">${t.vehicle}</div>
        <div style="font-size:15px;color:${C.text};font-weight:700;margin-top:2px">${vehicle.label[lang]}</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px">👤 ${b.passengers} ${t.passengers} · 🧳 ${b.luggage_count} ${t.pieces}</div>
      </td>
      <td width="150" style="vertical-align:middle;text-align:right">
        <img src="${SITE}/images/${vehicle.img}.webp" width="150" alt="" style="display:block;border:0;width:150px;height:auto;border-radius:10px;margin-left:auto">
      </td>
    </tr></table>
  `)}

  ${card(`
    ${heading(t.price)}
    ${prices.length ? infoRows(prices) : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:${prices.length ? 12 : 0}px"><tr>
      <td style="font-size:15px;color:${C.text};font-weight:700">${t.total}</td>
      <td style="text-align:right;font-size:28px;color:${C.navy};font-weight:800;white-space:nowrap">${money(b.price)}</td>
    </tr></table>
    <div style="margin-top:10px;font-size:13px;color:${C.text}">
      ${t.payment}: <b>${payLabel(b.payment_method, lang)}</b>
      ${b.payment_method === 'card' && !b.company_name ? `<div style="color:${C.muted};font-size:12px;margin-top:3px">${t.cardHint}</div>` : ''}
    </div>
    <div style="margin-top:8px;font-size:12px;color:${C.green}">✓ ${t.fixed}</div>
  `, `background:${C.goldSoft};border-color:#f1e2b8`)}

  ${b.flight_number || b.pickup_sign || b.child_seat || b.notes ? card(`
    ${heading(t.details)}
    ${infoRows([
      b.flight_number ? [t.flight, esc(b.flight_number)] : null,
      b.pickup_sign ? [t.sign, esc(b.pickup_sign)] : null,
      b.child_seat ? [t.child, `${t.childYes}${b.child_seat_details ? ` — ${esc(b.child_seat_details)}` : ''}`] : null,
    ])}
    ${b.notes ? `<div style="margin-top:10px;font-size:13px;color:${C.muted}">${t.notes}:</div>
      <div style="font-size:14px;color:${C.text};margin-top:3px;line-height:1.5">${esc(b.notes)}</div>` : ''}
  `) : ''}

  ${card(`
    ${heading(t.next)}
    ${[t.step1, t.step2].map((s, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>
        <td width="26" style="vertical-align:top"><div style="width:20px;height:20px;border-radius:50%;background:${C.navy};color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:20px">${i + 1}</div></td>
        <td style="font-size:14px;color:${C.text};line-height:1.45">${s}</td>
      </tr></table>`).join('')}
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="26" style="vertical-align:top"><div style="width:20px;height:20px;border-radius:50%;background:${C.navy};color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:20px">3</div></td>
      <td style="font-size:14px;color:${C.text};line-height:1.45">${airportPickup
        ? `<a href="${localePath(lang, '/treffpunkt-flughafen-muenchen')}" style="color:${C.navy2};font-weight:600">${t.stepAirport} →</a>`
        : t.stepHome}</td>
    </tr></table>
    <div style="margin-top:14px">${button(localePath(lang, '/buchung-verwalten'), t.manage, false)}</div>
  `)}

  <tr><td style="padding:6px 20px 22px">
    <div style="background:${C.navy};border-radius:14px;padding:18px">
      <div style="font-size:14px;color:#fff;font-weight:600">${t.questions}</div>
      <div style="margin-top:10px">
        <a href="${PHONE_LINK}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 14px;border-radius:10px;background:${C.gold};color:${C.navy};font-size:14px;font-weight:700;text-decoration:none">📞 ${t.call}</a>
        <a href="${WHATSAPP}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 14px;border-radius:10px;background:#25d366;color:#fff;font-size:14px;font-weight:700;text-decoration:none">💬 ${t.write}</a>
      </div>
      <div style="font-size:12px;color:#cbd5e1;margin-top:10px">${PHONE} · <a href="mailto:${MAIL}" style="color:#cbd5e1">${MAIL}</a></div>
    </div>
  </td></tr>

  <tr><td style="padding:0 20px 22px;text-align:center;font-size:11px;color:#9ca3af;line-height:1.6">
    Flughafen-München.TAXI · Eisvogelweg 2 · 85356 Freising<br>
    <a href="${SITE}${lang === 'de' ? '' : `/${lang}`}" style="color:#9ca3af">flughafen-muenchen.taxi</a>
  </td></tr>
</table>
</div>`;

  const subject = `✅ ${t.subject}: ${out.day} ${out.time} · ${b.booking_number}`;
  return { subject, html };
}

// ---- admin ------------------------------------------------------------------------------

export function adminNotificationEmail(b: BookingNotificationData): { subject: string; html: string } {
  const t = T.de;
  const out = when(b.pickup_datetime, 'de');
  const back = b.return_datetime ? when(b.return_datetime, 'de') : null;
  const vehicle = VEHICLE[b.vehicle_type] || VEHICLE.kombi;
  const phoneDigits = String(b.phone || '').replace(/[^\d]/g, '');
  const maps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(b.pickup_address)}&destination=${encodeURIComponent(b.dropoff_address)}${
    b.zwischenstopp_address ? `&waypoints=${encodeURIComponent(b.zwischenstopp_address)}` : ''}`;

  const flags: string[] = [];
  if (b.night_confirm) flags.push('🌙 Nachtbuchung — Kunde soll zusätzlich anrufen');
  if (b.company_name) flags.push(`🏢 Firmenkunde: ${esc(b.company_name)}`);
  if (b.flight_number && b.flight_validated !== '1') flags.push(`✈️ Flug ${esc(b.flight_number)} nicht verifiziert`);
  if (b.child_seat) flags.push(`👶 Kindersitz${b.child_seat_details ? `: ${esc(b.child_seat_details)}` : ''}`);
  if (b.fahrrad_count && b.fahrrad_count > 0) flags.push(`🚲 ${b.fahrrad_count}× Fahrrad`);
  if (b.pickup_sign) flags.push(`🪧 Abholschild: ${esc(b.pickup_sign)}`);

  const payColor: Record<string, [string, string]> = {
    cash: ['#ecfdf5', '#047857'], card: ['#eff6ff', '#1d4ed8'], rechnung: ['#f5f3ff', '#6d28d9'],
    invoice: ['#f5f3ff', '#6d28d9'], ueberweisung: ['#fff7ed', '#c2410c'],
  };
  const [pb, pf] = payColor[b.payment_method] || payColor.cash;
  const prices = priceRows(b, t, true);

  const html = `
<div style="background:#eef1f5;padding:16px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${C.line}">
  <tr><td style="background:${C.navy};padding:18px 20px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-size:12px;color:${C.gold};font-weight:700;letter-spacing:.08em;text-transform:uppercase">🚕 Neue Buchung · ${esc(b.booking_number)}</div>
        <div style="font-size:15px;color:#cbd5e1;margin-top:6px">${esc(out.day)}</div>
        <div style="font-size:28px;color:#fff;font-weight:800;line-height:1.1">${esc(out.time)}</div>
        ${back ? `<div style="font-size:14px;color:#cbd5e1;margin-top:2px">⇄ Rückfahrt ${esc(back.day)} · ${esc(back.time)}</div>` : ''}
      </td>
      <td style="text-align:right;vertical-align:top;white-space:nowrap">
        <div style="font-size:24px;color:#fff;font-weight:800">${money(b.price)}</div>
        <span style="display:inline-block;margin-top:4px;background:${pb};color:${pf};font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px">${payLabel(b.payment_method, 'de')}</span>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:14px 20px 4px">
    ${button(`tel:${b.phone}`, '📞 Anrufen')}
    ${phoneDigits ? button(`https://wa.me/${phoneDigits}`, '💬 WhatsApp', false) : ''}
    ${button(maps, '🗺️ Route', false)}
    ${button(`${SITE}/admin`, 'Admin öffnen', false)}
  </td></tr>

  ${flags.length ? `<tr><td style="padding:10px 20px 0">
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:10px 14px;font-size:13px;color:#92400e;line-height:1.7">${flags.join('<br>')}</div>
  </td></tr>` : ''}

  <tr><td style="height:12px"></td></tr>

  ${card(`
    ${heading('Fahrt')}
    ${route(b, t)}
    <div style="margin-top:12px;font-size:12px;color:${C.muted}">
      ${vehicle.label.de} · 👤 ${b.passengers} · 🧳 ${b.luggage_count}${b.distance_km ? ` · ${Number(b.distance_km).toFixed(1).replace('.', ',')} km` : ''}${b.duration_minutes ? ` · ca. ${b.duration_minutes} Min.` : ''}
    </div>
  `)}

  ${card(`
    ${heading('Kunde')}
    ${infoRows([
      ['Name', esc(b.name)],
      ['Telefon', `<a href="tel:${esc(b.phone)}" style="color:${C.navy2}">${esc(formatPhoneDisplay(b.phone))}</a>`],
      ['E-Mail', `<a href="mailto:${esc(b.email)}" style="color:${C.navy2}">${esc(b.email)}</a>`],
      b.flight_number ? ['Flug', `${esc(b.flight_number)} ${b.flight_validated === '1' ? `<span style="color:${C.green}">✓ ${esc(b.flight_info || 'bestätigt')}</span>` : '<span style="color:#b45309">⚠ nicht verifiziert</span>'}`] : null,
      ['Sprache', esc(String(b.language || 'de').toUpperCase())],
    ])}
    ${b.notes ? `<div style="margin-top:10px;background:${C.soft};border-radius:10px;padding:10px 12px;font-size:14px;color:${C.text};line-height:1.5"><b>Anmerkung:</b> ${esc(b.notes)}</div>` : ''}
  `)}

  ${card(`
    ${heading('Preis')}
    ${prices.length ? infoRows(prices) : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:${prices.length ? 10 : 0}px"><tr>
      <td style="font-size:15px;font-weight:700;color:${C.text}">Endpreis</td>
      <td style="text-align:right;font-size:22px;font-weight:800;color:${C.navy}">${money(b.price)}</td>
    </tr></table>
  `)}

  <tr><td style="padding:4px 20px 18px;font-size:11px;color:#9ca3af;text-align:center">Automatisch erstellt · flughafen-muenchen.taxi</td></tr>
</table>
</div>`;

  const subject = `🚕 Neue Buchung · ${out.day} ${out.time} · ${money(b.price)} · ${payLabel(b.payment_method, 'de')} · ${b.name}`;
  return { subject, html };
}
