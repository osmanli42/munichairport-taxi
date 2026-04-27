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
  promo_code?: string;
  discount_amount?: number;
  base_total?: number;
}

function buildPriceBlock(booking: BookingNotificationData, lang: string): string {
  if (!booking.promo_code || !booking.discount_amount || !booking.base_total) {
    return `<div class="price">€${formatPrice(booking.price)}</div>`;
  }
  const labels: Record<string, Record<string, string>> = {
    de: { base: 'Grundpreis', code: 'Rabattcode', total: 'Gesamtpreis' },
    en: { base: 'Base price', code: 'Promo code', total: 'Total price' },
    tr: { base: 'Temel fiyat', code: 'Promosyon kodu', total: 'Toplam' },
  };
  const l = labels[lang] ?? labels['de'];
  return `
    <div class="price">€${formatPrice(booking.price)}</div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#374151;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span>${l.base}:</span><span>€${formatPrice(booking.base_total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#16a34a;margin-bottom:6px;">
        <span>🎉 ${l.code} ${booking.promo_code}:</span><span>−€${formatPrice(booking.discount_amount)}</span>
      </div>
      <div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;">
        <span>${l.total}:</span><span>€${formatPrice(booking.price)}</span>
      </div>
    </div>`;
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
    `Tel: ${booking.phone}`,
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
