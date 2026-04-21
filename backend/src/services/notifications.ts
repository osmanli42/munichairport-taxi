import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_fLtaXc2i_KSwkQA9PQduHyfhjq1m8B2Nn';
const FROM_EMAIL = process.env.SMTP_USER || 'info@flughafen-muenchen.taxi';
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
}

function getVehicleLabel(vehicle_type: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    kombi: { de: 'Kombi (1-3 Personen)', en: 'Kombi (1-3 persons)', tr: 'Kombi (1-3 kişi)' },
    van: { de: 'Van/Minibus (4-7 Personen)', en: 'Van/Minibus (4-7 persons)', tr: 'Van/Minibüs (4-7 kişi)' },
    grossraumtaxi: { de: 'Großraumtaxi (8+ Personen)', en: 'Large Taxi (8+ persons)', tr: 'Büyük Taksi (8+ kişi)' },
  };
  return labels[vehicle_type]?.[lang] || vehicle_type;
}

function formatPrice(price: number): string {
  const rounded = Math.ceil(price * 2) / 2;
  return rounded.toFixed(2);
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

// Admin notification email (always German)
export async function sendAdminNotification(booking: BookingNotificationData): Promise<void> {
  const vehicleLabel = getVehicleLabel(booking.vehicle_type, 'de');
  const formattedDate = formatDateTime(booking.pickup_datetime);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .badge { background: #f6c644; color: #1a365d; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px; }
    .content { padding: 24px; }
    .section { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .section h3 { margin: 0 0 12px; color: #1a365d; font-size: 16px; border-bottom: 2px solid #f6c644; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; }
    .label { color: #666; font-size: 14px; }
    .value { font-weight: bold; font-size: 14px; }
    .price { font-size: 28px; font-weight: bold; color: #1a365d; text-align: center; padding: 16px; background: #fff3cd; border-radius: 8px; margin: 16px 0; }
    .footer { text-align: center; padding: 16px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Flughafen-muenchen.TAXI</h1>
    <p style="margin:8px 0">Neue Buchungsanfrage</p>
    <span class="badge">Buchungsnummer: ${booking.booking_number}</span>
  </div>
  <div class="content">
    <div class="price">€${formatPrice(booking.price)}</div>
    ${booking.trip_type === 'roundtrip' && booking.oneway_price !== undefined ? `
    <div style="text-align:center;margin:-8px 0 16px;font-size:13px;color:#666;">
      <span style="text-decoration:line-through;color:#999;">€${formatPrice(booking.oneway_price * 2)}</span>
      &nbsp;→&nbsp;
      <span style="color:#16a34a;font-weight:bold;">${booking.roundtrip_discount ?? 0}% Hin- & Rückfahrt Rabatt</span>
    </div>` : ''}

    <div class="section">
      <h3>Fahrtdetails</h3>
      <div class="row"><span class="label">Abholung:</span><span class="value">${booking.pickup_address}</span></div>
      ${booking.zwischenstopp_address ? `<div class="row"><span class="label">📍 Zwischenstopp:</span><span class="value" style="color:#2563eb;font-weight:bold;">${booking.zwischenstopp_address}</span></div>` : ''}
      <div class="row"><span class="label">Ziel:</span><span class="value">${booking.dropoff_address}</span></div>
      <div class="row"><span class="label">Fahrttyp:</span><span class="value">${booking.trip_type === 'roundtrip' ? '⇄ Hin & Rückfahrt' : '→ Einfache Fahrt'}</span></div>
      <div class="row"><span class="label">Abfahrt:</span><span class="value">${formattedDate}</span></div>
      ${booking.return_datetime ? `<div class="row"><span class="label">Rückfahrt:</span><span class="value">${formatDateTime(booking.return_datetime)}</span></div>` : ''}
      <div class="row"><span class="label">Fahrzeug:</span><span class="value">${vehicleLabel}</span></div>
      <div class="row"><span class="label">Passagiere:</span><span class="value">${booking.passengers}</span></div>
      ${booking.distance_km ? `<div class="row"><span class="label">Strecke:</span><span class="value">${booking.distance_km.toFixed(1)} km</span></div>` : ''}
      ${booking.duration_minutes ? `<div class="row"><span class="label">Fahrtdauer:</span><span class="value">ca. ${booking.duration_minutes} Min.</span></div>` : ''}
      ${booking.trip_type === 'roundtrip' && booking.oneway_price !== undefined ? `
      <div class="row"><span class="label">Einfache Fahrt:</span><span class="value">€${formatPrice(booking.oneway_price)}</span></div>
      <div class="row"><span class="label">× 2 Hin & Rück:</span><span class="value">€${formatPrice(booking.oneway_price * 2)}</span></div>
      <div class="row"><span class="label">Rabatt:</span><span class="value" style="color:#16a34a;font-weight:bold;">−${booking.roundtrip_discount ?? 0}%</span></div>
      <div class="row"><span class="label"><strong>Endpreis:</strong></span><span class="value"><strong>€${formatPrice(booking.price)}</strong></span></div>` : ''}
      ${booking.anfahrt_cost ? `<div class="row"><span class="label">🚗 Anfahrtskosten:</span><span class="value">€${formatPrice(booking.anfahrt_cost)}</span></div>` : ''}
    </div>

    ${(booking.child_seat || (booking.fahrrad_count && booking.fahrrad_count > 0)) ? `
    <div class="section">
      <h3>Extras</h3>
      ${booking.child_seat ? `<div class="row"><span class="label">👶 Kindersitz:</span><span class="value">Ja (kostenlos)${booking.child_seat_details ? ' — ' + booking.child_seat_details : ''}</span></div>` : ''}
      ${booking.fahrrad_count && booking.fahrrad_count > 0 ? `<div class="row"><span class="label">🚲 Fahrrad:</span><span class="value">${booking.fahrrad_count}× (€${formatPrice(booking.fahrrad_price ?? 0)}/Stk.) = €${formatPrice(booking.fahrrad_total ?? 0)}</span></div>` : ''}
    </div>` : ''}

    <div class="section">
      <h3>Kundendaten</h3>
      <div class="row"><span class="label">Name:</span><span class="value">${booking.name}</span></div>
      <div class="row"><span class="label">Telefon:</span><span class="value"><a href="tel:${booking.phone}">${booking.phone}</a></span></div>
      <div class="row"><span class="label">E-Mail:</span><span class="value"><a href="mailto:${booking.email}">${booking.email}</a></span></div>
      ${booking.flight_number ? `<div class="row"><span class="label">Flugnummer:</span><span class="value">${booking.flight_number}</span></div>` : ''}
      ${booking.pickup_sign ? `<div class="row"><span class="label">🪧 Abholschild:</span><span class="value" style="color:#b45309;font-weight:bold;">${booking.pickup_sign}</span></div>` : ''}
      <div class="row"><span class="label">Gepäck:</span><span class="value">${booking.luggage_count} Stück</span></div>
      <div class="row"><span class="label">Zahlung:</span><span class="value">${booking.payment_method === 'cash' ? 'Bargeld' : 'Kartenzahlung'}</span></div>
      <div class="row"><span class="label">Sprache:</span><span class="value">${booking.language.toUpperCase()}</span></div>
    </div>

    ${booking.notes ? `
    <div class="section">
      <h3>Anmerkungen</h3>
      <p>${booking.notes}</p>
    </div>` : ''}
  </div>
  <div class="footer">
    Flughafen-muenchen.TAXI | Eisvogelweg 2, 85356 Freising | Tel: +49 151 41620000<br>
    Diese E-Mail wurde automatisch generiert.
  </div>
</body>
</html>
  `;

  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: ADMIN_EMAIL,
    subject: `[NEUE BUCHUNG] ${booking.booking_number} - ${formattedDate} - €${formatPrice(booking.price)}`,
    html,
  });
}

// Customer confirmation email
export async function sendCustomerConfirmation(booking: BookingNotificationData): Promise<void> {
  const lang = booking.language || 'de';
  const vehicleLabel = getVehicleLabel(booking.vehicle_type, lang);
  const formattedDate = formatDateTime(booking.pickup_datetime);

  const translations: Record<string, Record<string, string>> = {
    de: {
      subject: `Buchungsbestätigung ${booking.booking_number} - Flughafen-muenchen.TAXI`,
      title: 'Ihre Buchungsbestätigung',
      subtitle: 'Vielen Dank für Ihre Buchung!',
      intro: 'Wir haben Ihre Buchungsanfrage erhalten und werden uns in Kürze bei Ihnen melden.',
      tripDetails: 'Fahrtdetails',
      pickup: 'Abholung',
      destination: 'Ziel',
      datetime: 'Datum & Uhrzeit',
      vehicle: 'Fahrzeug',
      passengers: 'Passagiere',
      distance: 'Strecke',
      duration: 'Fahrtdauer',
      price: 'Gesamtpreis',
      payment: 'Zahlung',
      flightNumber: 'Flugnummer',
      pickupSign: 'Abholschild',
      childSeat: 'Kindersitz',
      luggage: 'Gepäck',
      notes: 'Anmerkungen',
      cash: 'Bargeld',
      card: 'Kartenzahlung',
      yes: 'Ja (kostenlos)',
      no: 'Nein',
      contact: 'Fragen? Kontaktieren Sie uns:',
      pieces: 'Stück',
      minutes: 'Min.',
      tripType: 'Fahrttyp',
      oneway: '→ Einfache Fahrt',
      roundtrip: '⇄ Hin- & Rückfahrt',
      returnTrip: 'Rückfahrt',
      greeting: 'Hallo',
      footer: 'Flughafen-muenchen.TAXI | Eisvogelweg 2, 85356 Freising',
    },
    en: {
      subject: `Booking Confirmation ${booking.booking_number} - Flughafen-muenchen.TAXI`,
      title: 'Your Booking Confirmation',
      subtitle: 'Thank you for your booking!',
      intro: 'We have received your booking request and will contact you shortly.',
      tripDetails: 'Trip Details',
      pickup: 'Pickup',
      destination: 'Destination',
      datetime: 'Date & Time',
      vehicle: 'Vehicle',
      passengers: 'Passengers',
      distance: 'Distance',
      duration: 'Duration',
      price: 'Total Price',
      payment: 'Payment',
      flightNumber: 'Flight Number',
      pickupSign: 'Pickup Sign',
      childSeat: 'Child Seat',
      luggage: 'Luggage',
      notes: 'Notes',
      cash: 'Cash',
      card: 'Card Payment',
      yes: 'Yes (free)',
      no: 'No',
      contact: 'Questions? Contact us:',
      pieces: 'pieces',
      minutes: 'min.',
      tripType: 'Trip type',
      oneway: '→ One way',
      roundtrip: '⇄ Round trip',
      returnTrip: 'Return',
      greeting: 'Hello',
      footer: 'Flughafen-muenchen.TAXI | Eisvogelweg 2, 85356 Freising',
    },
    tr: {
      subject: `Rezervasyon Onayı ${booking.booking_number} - Flughafen-muenchen.TAXI`,
      title: 'Rezervasyon Onayınız',
      subtitle: 'Rezervasyonunuz için teşekkürler!',
      intro: 'Rezervasyon talebinizi aldık, en kısa sürede sizinle iletişime geçeceğiz.',
      tripDetails: 'Yolculuk Detayları',
      pickup: 'Alış Noktası',
      destination: 'Hedef',
      datetime: 'Tarih & Saat',
      vehicle: 'Araç',
      passengers: 'Yolcular',
      distance: 'Mesafe',
      duration: 'Süre',
      price: 'Toplam Fiyat',
      payment: 'Ödeme',
      flightNumber: 'Uçuş Numarası',
      pickupSign: 'Karşılama Tabelası',
      childSeat: 'Çocuk Koltuğu',
      luggage: 'Bagaj',
      notes: 'Notlar',
      cash: 'Nakit',
      card: 'Kart Ödemesi',
      yes: 'Evet (ücretsiz)',
      no: 'Hayır',
      contact: 'Sorularınız için iletişime geçin:',
      pieces: 'parça',
      minutes: 'dk.',
      tripType: 'Yolculuk tipi',
      oneway: '→ Tek yön',
      roundtrip: '⇄ Gidiş-Dönüş',
      returnTrip: 'Dönüş',
      greeting: 'Merhaba',
      footer: 'Flughafen-muenchen.TAXI | Eisvogelweg 2, 85356 Freising',
    },
  };

  const t = translations[lang] || translations['de'];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1a365d; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .badge { background: #f6c644; color: #1a365d; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block; margin-top: 8px; }
    .content { padding: 24px; }
    .intro { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; }
    .section { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .section h3 { margin: 0 0 12px; color: #1a365d; font-size: 16px; border-bottom: 2px solid #f6c644; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .label { color: #666; font-size: 14px; }
    .value { font-weight: bold; font-size: 14px; text-align: right; max-width: 60%; }
    .price-box { font-size: 32px; font-weight: bold; color: #1a365d; text-align: center; padding: 20px; background: #fff3cd; border-radius: 8px; margin: 20px 0; border: 2px solid #f6c644; }
    .contact-box { background: #1a365d; color: white; border-radius: 8px; padding: 16px; text-align: center; margin-top: 20px; }
    .contact-box a { color: #f6c644; text-decoration: none; font-weight: bold; }
    .footer { text-align: center; padding: 16px; color: #999; font-size: 12px; border-top: 1px solid #eee; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Flughafen-muenchen.TAXI</h1>
    <p style="margin:8px 0 4px">${t.title}</p>
    <span class="badge">${booking.booking_number}</span>
  </div>
  <div class="content">
    <div class="intro">
      <strong>${t.greeting} ${booking.name},</strong><br><br>
      <strong>${t.subtitle}</strong><br>
      ${t.intro}
    </div>

    <div class="price-box">€${formatPrice(booking.price)}</div>
    ${booking.trip_type === 'roundtrip' && booking.oneway_price !== undefined ? `
    <div style="text-align:center;margin:-12px 0 16px;font-size:13px;color:#666;">
      <span style="text-decoration:line-through;color:#999;">€${formatPrice(booking.oneway_price * 2)}</span>
      &nbsp;→&nbsp;
      <span style="color:#16a34a;font-weight:bold;">${booking.roundtrip_discount ?? 0}% ${lang === 'de' ? 'Hin- & Rückfahrt Rabatt' : lang === 'tr' ? 'Gidiş-Dönüş İndirimi' : 'Round trip discount'}</span>
    </div>` : ''}

    <div class="section">
      <h3>${t.tripDetails}</h3>
      <div class="row"><span class="label">${t.pickup}:</span><span class="value">${booking.pickup_address}</span></div>
      ${booking.zwischenstopp_address ? `<div class="row"><span class="label">📍 ${lang === 'de' ? 'Zwischenstopp' : lang === 'tr' ? 'Ara Durak' : 'Intermediate Stop'}:</span><span class="value" style="color:#2563eb;font-weight:bold;">${booking.zwischenstopp_address}</span></div>` : ''}
      <div class="row"><span class="label">${t.destination}:</span><span class="value">${booking.dropoff_address}</span></div>
      <div class="row"><span class="label">${t.tripType}:</span><span class="value">${booking.trip_type === 'roundtrip' ? t.roundtrip : t.oneway}</span></div>
      <div class="row"><span class="label">${t.datetime}:</span><span class="value">${formattedDate}</span></div>
      ${booking.return_datetime ? `<div class="row"><span class="label">${t.returnTrip}:</span><span class="value">${formatDateTime(booking.return_datetime)}</span></div>` : ''}
      <div class="row"><span class="label">${t.vehicle}:</span><span class="value">${vehicleLabel}</span></div>
      <div class="row"><span class="label">${t.passengers}:</span><span class="value">${booking.passengers}</span></div>
      ${booking.distance_km ? `<div class="row"><span class="label">${t.distance}:</span><span class="value">${booking.distance_km.toFixed(1)} km</span></div>` : ''}
      ${booking.duration_minutes ? `<div class="row"><span class="label">${t.duration}:</span><span class="value">ca. ${booking.duration_minutes} ${t.minutes}</span></div>` : ''}
      ${booking.trip_type === 'roundtrip' && booking.oneway_price !== undefined ? `
      <div class="row"><span class="label">${lang === 'de' ? 'Einfache Fahrt' : lang === 'tr' ? 'Tek Yön' : 'One way'}:</span><span class="value">€${formatPrice(booking.oneway_price)}</span></div>
      <div class="row"><span class="label">× 2 ${lang === 'de' ? 'Hin & Rück' : lang === 'tr' ? 'Gidiş-Dönüş' : 'Round trip'}:</span><span class="value">€${formatPrice(booking.oneway_price * 2)}</span></div>
      <div class="row"><span class="label">${lang === 'de' ? 'Rabatt' : lang === 'tr' ? 'İndirim' : 'Discount'}:</span><span class="value" style="color:#16a34a;font-weight:bold;">−${booking.roundtrip_discount ?? 0}%</span></div>
      <div class="row"><span class="label"><strong>${lang === 'de' ? 'Endpreis' : lang === 'tr' ? 'Son Fiyat' : 'Final Price'}:</strong></span><span class="value"><strong>€${formatPrice(booking.price)}</strong></span></div>` : ''}
      ${booking.anfahrt_cost ? `<div class="row"><span class="label">🚗 ${lang === 'de' ? 'Anfahrtskosten' : lang === 'tr' ? 'Yaklaşım Ücreti' : 'Approach Fee'}:</span><span class="value">€${formatPrice(booking.anfahrt_cost)}</span></div>` : ''}
      <div class="row"><span class="label">${t.luggage}:</span><span class="value">${booking.luggage_count} ${t.pieces}</span></div>
      <div class="row"><span class="label">${t.payment}:</span><span class="value">${booking.payment_method === 'cash' ? t.cash : t.card}</span></div>
    </div>

    ${(booking.child_seat || (booking.fahrrad_count && booking.fahrrad_count > 0)) ? `
    <div class="section">
      <h3>Extras</h3>
      ${booking.child_seat ? `<div class="row"><span class="label">👶 ${t.childSeat}:</span><span class="value">${t.yes}${booking.child_seat_details ? ' — ' + booking.child_seat_details : ''}</span></div>` : ''}
      ${booking.fahrrad_count && booking.fahrrad_count > 0 ? `<div class="row"><span class="label">🚲 ${lang === 'de' ? 'Fahrrad' : lang === 'tr' ? 'Bisiklet' : 'Bicycle'}:</span><span class="value">${booking.fahrrad_count}× (€${formatPrice(booking.fahrrad_price ?? 0)}) = €${formatPrice(booking.fahrrad_total ?? 0)}</span></div>` : ''}
    </div>` : ''}

    <div class="section">
      <h3>${lang === 'de' ? 'Ihre Daten' : lang === 'tr' ? 'Bilgileriniz' : 'Your Details'}</h3>
      <div class="row"><span class="label">${lang === 'de' ? 'Name' : lang === 'tr' ? 'Ad Soyad' : 'Name'}:</span><span class="value">${booking.name}</span></div>
      <div class="row"><span class="label">${lang === 'de' ? 'Telefon' : lang === 'tr' ? 'Telefon' : 'Phone'}:</span><span class="value"><a href="tel:${booking.phone}" style="color:#1a365d;text-decoration:none;">${booking.phone}</a></span></div>
      <div class="row"><span class="label">${lang === 'de' ? 'E-Mail' : lang === 'tr' ? 'E-Posta' : 'Email'}:</span><span class="value">${booking.email}</span></div>
      ${booking.flight_number ? `<div class="row"><span class="label">${t.flightNumber}:</span><span class="value">${booking.flight_number}</span></div>` : ''}
      ${booking.pickup_sign ? `<div class="row"><span class="label">🪧 ${t.pickupSign}:</span><span class="value" style="color:#b45309;font-weight:bold;">${booking.pickup_sign}</span></div>` : ''}
      <div class="row"><span class="label">${t.payment}:</span><span class="value">${booking.payment_method === 'cash' ? t.cash : t.card}</span></div>
    </div>

    ${booking.notes ? `
    <div class="section">
      <h3>${t.notes}</h3>
      <p style="margin:0">${booking.notes}</p>
    </div>` : ''}

    <div class="contact-box">
      <p style="margin:0 0 8px">${t.contact}</p>
      <p style="margin:4px 0"><a href="tel:+4915141620000">📞 +49 151 41620000</a></p>
      <p style="margin:4px 0"><a href="https://wa.me/4915141620000">💬 WhatsApp</a></p>
      <p style="margin:4px 0"><a href="mailto:info@flughafen-muenchen.taxi">✉️ info@flughafen-muenchen.taxi</a></p>
    </div>
  </div>
  <div class="footer">
    ${t.footer}<br>
    www.flughafen-muenchen.taxi
  </div>
</body>
</html>
  `;

  const resend = new Resend(RESEND_API_KEY);
  await resend.emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: booking.email,
    subject: t.subject,
    html,
  });
}

async function sendTelegramNotification(booking: BookingNotificationData): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const formattedDate = formatDateTime(booking.pickup_datetime);
  const text = [
    `🚖 *NEUE BUCHUNG* — ${booking.booking_number}`,
    `💶 *€${formatPrice(booking.price)}* ${booking.trip_type === 'roundtrip' ? '(Hin & Rück)' : '(Einfach)'}`,
    ``,
    `📍 ${booking.pickup_address}`,
    `🏁 ${booking.dropoff_address}`,
    `📅 ${formattedDate}`,
    `👥 ${booking.passengers} Pax · ${booking.vehicle_type}`,
    booking.flight_number ? `✈️ ${booking.flight_number}` : '',
    ``,
    `👤 ${booking.name}`,
    `📞 [${booking.phone}](tel:${booking.phone})`,
    `💬 [WhatsApp](https://wa.me/${booking.phone.replace(/\D/g, '')})`,
  ].filter(Boolean).join('\n');

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
  });
}

export async function sendAllNotifications(booking: BookingNotificationData): Promise<void> {
  const results = await Promise.allSettled([
    sendAdminNotification(booking),
    sendCustomerConfirmation(booking),
    sendTelegramNotification(booking),
  ]);

  results.forEach((result, index) => {
    const names = ['Admin Email', 'Customer Email', 'Telegram'];
    if (result.status === 'rejected') {
      console.error(`Failed to send ${names[index]}:`, result.reason);
    } else {
      console.log(`${names[index]} sent successfully`);
    }
  });
}
