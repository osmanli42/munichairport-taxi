// Phone number parsing for the booking form (Europe + North America).
// Wraps libphonenumber-js so the frontend and backend agree on what "valid" means
// and on the stored E.164 form. Never throws — callers treat a failed parse as a
// warning, not a rejection, so a customer is never blocked from booking.

// '/max' metadata is required, not optional. With the default (min) metadata German
// mobile numbers accept almost any length, so '0151 4162 000' — a real customer typo
// with one digit missing — is reported valid, and getType() returns UNKNOWN for every
// German number. Max metadata catches the missing digit and separates mobile from
// landline, which is the whole point of this check.
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

export type PhoneFailReason = 'empty' | 'unparseable' | 'invalid';

export interface PhoneOk {
  ok: true;
  /** Canonical E.164, e.g. '+4915141620000'. Safe for wa.me links and Google Ads. */
  e164: string;
  /** Human-friendly international form, e.g. '+49 151 41620000'. */
  formatted: string;
  country?: string;
  /** libphonenumber type: 'MOBILE' | 'FIXED_LINE' | 'FIXED_LINE_OR_MOBILE' | ... */
  type?: string;
  /** False only when the type is known and is definitely not reachable on a mobile. */
  mobileLikely: boolean;
}

export interface PhoneFail {
  ok: false;
  reason: PhoneFailReason;
}

export type PhoneResult = PhoneOk | PhoneFail;

// Germany is the default because most customers type a local '0151...' with no
// country code. Anything starting with '+' resolves to its own country instead,
// which is what makes US/Canada and the rest of Europe work with no extra config.
export const DEFAULT_COUNTRY: CountryCode = 'DE';

// Types libphonenumber reports that cannot receive a WhatsApp message or an SMS.
// FIXED_LINE_OR_MOBILE stays "likely" — it's the honest answer for countries where
// the numbering plan genuinely doesn't separate the two.
const NON_MOBILE_TYPES = new Set(['FIXED_LINE', 'TOLL_FREE', 'PREMIUM_RATE', 'SHARED_COST', 'VOICEMAIL', 'PAGER']);

export function parsePhone(raw: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): PhoneResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(trimmed, country);
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
  if (!parsed) return { ok: false, reason: 'unparseable' };
  // isValid() is the check that catches a missing or extra digit — the actual
  // complaint that started this. isPossible() only checks length, so it is too weak.
  if (!parsed.isValid()) return { ok: false, reason: 'invalid' };

  const type = parsed.getType();
  return {
    ok: true,
    e164: parsed.number,
    formatted: parsed.formatInternational(),
    country: parsed.country,
    type,
    mobileLikely: !type || !NON_MOBILE_TYPES.has(type),
  };
}

/** E.164 when parseable, otherwise null. For columns that must stay canonical. */
export function toE164(raw: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const result = parsePhone(raw, country);
  return result.ok ? result.e164 : null;
}

/**
 * Human-readable grouping for emails and PDFs: '+4915141620000' -> '+49 1514 1620000'.
 * Bookings now store E.164, which is unambiguous but reads as one long digit run.
 * Falls back to the input unchanged so an unparseable number is still shown as given.
 * Use this for visible text only — `tel:` and `wa.me` hrefs need the compact form.
 */
export function formatPhoneDisplay(raw: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): string {
  const result = parsePhone(raw, country);
  return result.ok ? result.formatted : (raw ?? '').trim();
}
