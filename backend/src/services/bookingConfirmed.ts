// Customer mail data for a stored booking (same breakdown as the mail sent at booking
// time) and the "endgültige Bestätigung" mail sent when the admin confirms the booking —
// from the button in the new-booking mail (routes/booking-confirm.ts) or the admin panel.
import { query, run } from '../db';
import { Resend } from 'resend';
import { BookingNotificationData } from './notifications';
import { customerConfirmationEmail } from './bookingEmailTemplates';
import { customerRecipient } from '../utils/recipient';

export async function buildCustomerMailData(booking: any): Promise<BookingNotificationData> {
  // Discounts as booked, so the mail shows the same breakdown as the first confirmation:
  // the stored price is after discount, base_total is the price before it.
  const promoAmount = Number(booking.discount_amount) || 0;
  const autoAmount = Number(booking.auto_discount_amount) || 0;
  let autoName: string | undefined;
  let autoShow = false;
  if (autoAmount > 0) {
    const [rule] = booking.auto_discount_id
      ? await query<{ name: string }>('SELECT name FROM auto_discounts WHERE id = ?', [booking.auto_discount_id])
      : [];
    autoName = rule?.name;
    const [showRow] = await query<{ setting_value: string }>(
      "SELECT setting_value FROM settings WHERE setting_key = 'auto_discount_show_in_email'");
    autoShow = showRow?.setting_value === '1';
  }

  const [company] = booking.company_id
    ? await query<{ company_name: string }>('SELECT company_name FROM companies WHERE id = ?', [booking.company_id])
    : [];
  const companyName = company?.company_name || undefined;

  const [priceRow] = await query<{ fahrrad_price: number; child_seat_price: number }>(
    'SELECT fahrrad_price, child_seat_price FROM prices WHERE vehicle_type = ?',
    [booking.vehicle_type]
  );
  const fahrradCount = booking.fahrrad_count || 0;
  const fahrradUnitPrice = priceRow?.fahrrad_price ?? 0;

  return {
    booking_number: booking.booking_number,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    pickup_address: booking.pickup_address,
    dropoff_address: booking.dropoff_address,
    pickup_datetime: booking.pickup_datetime,
    vehicle_type: booking.vehicle_type,
    passengers: booking.passengers,
    price: booking.price,
    payment_method: booking.payment_method,
    language: booking.language || 'de',
    child_seat: !!booking.child_seat,
    child_seat_details: booking.child_seat_details || undefined,
    luggage_count: booking.luggage_count || 0,
    flight_number: booking.flight_number || undefined,
    pickup_sign: booking.pickup_sign || undefined,
    notes: booking.notes || undefined,
    distance_km: booking.distance_km || undefined,
    duration_minutes: booking.duration_minutes || undefined,
    trip_type: booking.trip_type || undefined,
    return_datetime: booking.return_datetime || undefined,
    fahrrad_count: fahrradCount,
    fahrrad_price: fahrradCount > 0 ? fahrradUnitPrice : undefined,
    fahrrad_total: fahrradCount > 0 ? fahrradCount * fahrradUnitPrice : undefined,
    anfahrt_cost: booking.anfahrt_cost || undefined,
    zwischenstopp_address: booking.zwischenstopp_address || undefined,
    promo_code: booking.promo_code || undefined,
    discount_amount: promoAmount > 0 ? promoAmount : undefined,
    base_total: promoAmount > 0 || autoAmount > 0 ? Number(booking.price) + promoAmount + autoAmount : undefined,
    auto_discount_name: autoName,
    auto_discount_amount: autoAmount > 0 ? autoAmount : undefined,
    auto_discount_show_in_email: autoShow,
    company_name: companyName,
    rechnung_adresse: booking.rechnung_required ? booking.rechnung_adresse || undefined : undefined,
    night_confirm: false,
  };
}

export type FinalConfirmResult =
  | { ok: true; sent_at: string; to: string }
  | { ok: false; reason: 'not_found' | 'cancelled' | 'no_email' | 'already_sent' | 'send_failed'; sent_at?: string | null; error?: string };

/**
 * Marks the booking confirmed (if still "new") and mails the customer the binding
 * confirmation. Sends once per booking unless `force` (explicit re-send).
 */
export async function sendFinalConfirmation(
  where: { id?: number; bookingNumber?: string },
  opts: { force?: boolean; by?: string } = {},
): Promise<FinalConfirmResult> {
  const [booking] = where.id
    ? await query<any>('SELECT * FROM bookings WHERE id = ?', [where.id])
    : await query<any>('SELECT * FROM bookings WHERE booking_number = ?', [where.bookingNumber || '']);
  if (!booking) return { ok: false, reason: 'not_found' };
  if (booking.status === 'cancelled') return { ok: false, reason: 'cancelled' };
  if (!booking.email) return { ok: false, reason: 'no_email' };
  if (booking.confirmed_email_sent_at && !opts.force) {
    return { ok: false, reason: 'already_sent', sent_at: booking.confirmed_email_sent_at };
  }

  try {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt');
    const { subject, html } = customerConfirmationEmail(await buildCustomerMailData(booking), 'confirmed');
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
      to: customerRecipient(booking.email),
      subject,
      html,
    });
    if (error) throw new Error(error.message);
  } catch (e: any) {
    console.error(`[final-confirm] ${booking.booking_number}:`, e?.message || e);
    return { ok: false, reason: 'send_failed', error: String(e?.message || e) };
  }

  await run(
    `UPDATE bookings SET confirmed_email_sent_at = NOW(), status = IF(status = 'new', 'confirmed', status) WHERE id = ?`,
    [booking.id]
  );
  console.log(`[final-confirm] ${booking.booking_number} → ${booking.email} (by ${opts.by || '?'})`);
  const [row] = await query<any>('SELECT confirmed_email_sent_at FROM bookings WHERE id = ?', [booking.id]);
  return { ok: true, sent_at: row?.confirmed_email_sent_at, to: booking.email };
}
