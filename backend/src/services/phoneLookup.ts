// Twilio Lookup v2 — line type intelligence for booking phone numbers.
//
// Answers the one question libphonenumber cannot: is this number reachable on a
// mobile, or is it a landline / VoIP number where a WhatsApp message or SMS will
// never arrive? Costs $0.008 per request, so it runs exactly once per booking,
// server-side, after the row is already inserted — never on keystrokes, and never
// from a public endpoint that could be hammered to run up the bill.
//
// Ships inert: with no TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN set, every call
// returns null and nothing is charged, logged, or delayed. Setting the two env
// vars is the only step needed to switch it on.

import { query, run } from '../db';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

export function isLookupConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

// A phone number's line type doesn't change on a booking-to-booking timescale, and
// repeat customers are common, so caching straightforwardly avoids repeat charges.
const cache = new Map<string, { type: string | null; ts: number }>();
const CACHE_TTL = 30 * 24 * 3600_000; // 30 days
const CACHE_MAX = 500;

function setCache(key: string, type: string | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { type, ts: Date.now() });
}

/**
 * Returns Twilio's line type ('mobile' | 'landline' | 'nonFixedVoip' | 'tollFree' | …),
 * or null when the lookup is unconfigured, rate-limited, or failed. Never throws.
 */
export async function lookupLineType(e164: string): Promise<string | null> {
  if (!isLookupConfigured() || !e164) return null;

  const cached = cache.get(e164);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.type;

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    });

    // 404 means Twilio has no record of the number — a real signal worth caching,
    // distinct from "we couldn't ask".
    if (response.status === 404) {
      setCache(e164, 'notFound');
      return 'notFound';
    }
    if (!response.ok) return null;

    const data = await response.json() as { line_type_intelligence?: { type?: string | null } };
    const type = data.line_type_intelligence?.type ?? null;
    setCache(e164, type);
    return type;
  } catch (error) {
    console.error('Phone lookup error:', error);
    return null;
  }
}

/**
 * Fire-and-forget enrichment for a freshly created booking. Runs after the booking
 * row exists so a slow or failing Twilio call can never delay or block a customer's
 * confirmation. Skipped entirely when the admin toggle is off.
 */
export async function enrichBookingLineType(bookingId: number, e164: string | null): Promise<void> {
  if (!e164 || !isLookupConfigured()) return;

  try {
    const rows = await query<{ setting_value: string }>(
      "SELECT setting_value FROM settings WHERE setting_key = 'phone_validation_enabled'"
    );
    if ((rows[0]?.setting_value ?? '1') !== '1') return;

    const type = await lookupLineType(e164);
    if (type) await run('UPDATE bookings SET phone_line_type = ? WHERE id = ?', [type, bookingId]);
  } catch (error) {
    console.error('Phone enrichment error:', error);
  }
}
