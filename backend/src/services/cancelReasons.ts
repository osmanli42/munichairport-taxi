// Preset reasons the admin picks when cancelling.
//
// Booking cancellation: the reason replaces the generic intro of the customer's cancellation
// mail ("Ihre Buchung wurde erfolgreich storniert…" sounds wrong when WE cancel because we are
// fully booked). Texts in all three mail languages.
//
// Invoice storno: printed as "Grund" on the Stornorechnung (de/en, the invoice languages).

export type MailLang = 'de' | 'en' | 'tr';

export const BOOKING_CANCEL_REASONS: Record<string, Record<MailLang, string>> = {
  customer_request: {
    de: 'Ihre Buchung wurde wie gewünscht storniert.',
    en: 'Your booking has been cancelled as requested.',
    tr: 'Rezervasyonunuz talebiniz üzerine iptal edildi.',
  },
  fully_booked: {
    de: 'Leider müssen wir Ihre Buchung stornieren: Zu Ihrem Wunschtermin sind alle unsere Fahrzeuge bereits ausgebucht. Wir bitten vielmals um Entschuldigung.',
    en: 'Unfortunately we have to cancel your booking: all our vehicles are already fully booked at your requested time. We sincerely apologise.',
    tr: 'Maalesef rezervasyonunuzu iptal etmek zorundayız: İstediğiniz saatte tüm araçlarımız dolu. Yaşanan aksaklık için özür dileriz.',
  },
  no_payment: {
    de: 'Ihre Buchung wurde storniert, da die Zahlung nicht rechtzeitig bei uns eingegangen ist.',
    en: 'Your booking has been cancelled because we did not receive the payment in time.',
    tr: 'Ödeme zamanında bize ulaşmadığı için rezervasyonunuz iptal edildi.',
  },
  duplicate: {
    de: 'Diese Buchung wurde storniert, da sie doppelt bei uns eingegangen ist. Ihre andere Buchung bleibt selbstverständlich bestehen.',
    en: 'This booking has been cancelled because we received it twice. Your other booking remains valid, of course.',
    tr: 'Bu rezervasyon bize iki kez ulaştığı için iptal edildi. Diğer rezervasyonunuz elbette geçerlidir.',
  },
  flight_changed: {
    de: 'Ihre Buchung wurde storniert, da Ihr Flug geändert bzw. annulliert wurde.',
    en: 'Your booking has been cancelled because your flight was changed or cancelled.',
    tr: 'Uçuşunuz değiştiği veya iptal edildiği için rezervasyonunuz iptal edildi.',
  },
  unreachable: {
    de: 'Leider konnten wir Sie zur Bestätigung Ihrer Fahrt nicht erreichen. Ihre Buchung wurde daher storniert – melden Sie sich gerne jederzeit bei uns.',
    en: 'Unfortunately we could not reach you to confirm your ride, so your booking has been cancelled – feel free to contact us at any time.',
    tr: 'Yolculuğunuzu teyit etmek için size ulaşamadık, bu nedenle rezervasyonunuz iptal edildi – dilediğiniz zaman bize ulaşabilirsiniz.',
  },
  other: {
    de: 'Ihre Buchung wurde storniert.',
    en: 'Your booking has been cancelled.',
    tr: 'Rezervasyonunuz iptal edildi.',
  },
};

export function isBookingCancelReason(key: unknown): key is string {
  return typeof key === 'string' && key in BOOKING_CANCEL_REASONS;
}

export const INVOICE_STORNO_REASONS: Record<string, Record<'de' | 'en', string>> = {
  customer_request: { de: 'Stornierung auf Wunsch des Kunden', en: 'Cancelled at the customer’s request' },
  ride_not_done: { de: 'Fahrt wurde nicht durchgeführt', en: 'The ride did not take place' },
  fully_booked: { de: 'Fahrt wegen Ausbuchung storniert', en: 'Ride cancelled – fully booked' },
  wrong_invoice: { de: 'Rechnung fehlerhaft (Empfänger, Betrag oder Steuersatz)', en: 'Invoice incorrect (recipient, amount or VAT rate)' },
  duplicate: { de: 'Doppelt berechnet', en: 'Charged twice' },
  reissue: { de: 'Ersetzt durch eine berichtigte Rechnung', en: 'Replaced by a corrected invoice' },
};

/** Reason text for a Stornorechnung: preset in the invoice language, plus any free text. */
export function stornoReasonText(key: unknown, free: unknown, lang: 'de' | 'en'): string | null {
  const preset = typeof key === 'string' && INVOICE_STORNO_REASONS[key] ? INVOICE_STORNO_REASONS[key][lang] : '';
  const extra = typeof free === 'string' ? free.trim().slice(0, 500) : '';
  const text = [preset, extra].filter(Boolean).join(' – ');
  return text || null;
}
