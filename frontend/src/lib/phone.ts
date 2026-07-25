// Phone number parsing for the booking form (Europe + North America).
// Mirror of backend/src/utils/phone.ts — the two must agree on what "valid" means
// and on the stored E.164 form. Keep them in sync when either changes.
// Never throws: a failed parse is a warning, never a reason to block a booking.

// '/max' metadata is required, not optional — see backend/src/utils/phone.ts for why.
// Short version: with min metadata '0151 4162 000' (one digit missing) parses as valid
// and every German number reports type UNKNOWN.
import { parsePhoneNumberFromString, AsYouType, getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max';

export type PhoneFailReason = 'empty' | 'unparseable' | 'invalid';

export interface PhoneOk {
  ok: true;
  /** Canonical E.164, e.g. '+4915141620000'. Safe for wa.me links and Google Ads. */
  e164: string;
  /** Human-friendly international form, e.g. '+49 151 41620000'. */
  formatted: string;
  country?: string;
  type?: string;
  mobileLikely: boolean;
}

export interface PhoneFail {
  ok: false;
  reason: PhoneFailReason;
}

export type PhoneResult = PhoneOk | PhoneFail;

export const DEFAULT_COUNTRY: CountryCode = 'DE';

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

export function toE164(raw: string | null | undefined, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const result = parsePhone(raw, country);
  return result.ok ? result.e164 : null;
}

/**
 * Digits for a wa.me link. wa.me needs a full international number with no '+' and
 * no leading zeros — a stored '0151 4162 0000' becomes 'wa.me/015141620000', which
 * WhatsApp refuses to open. Parsing first recovers the country code; the raw-digit
 * strip stays as the fallback so a link is never worse than it is today.
 */
export function waNumber(raw: string | null | undefined): string {
  const e164 = toE164(raw);
  if (e164) return e164.replace(/\D/g, '');
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * What to send to the API. E.164 when the number is valid; otherwise the dial code
 * the user picked joined to the digits they typed. The fallback matters because an
 * invalid number is still submitted (we warn, we don't block) and the office needs
 * the country context to call the customer back.
 */
export function toSubmitValue(national: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const result = parsePhone(national, country);
  if (result.ok) return result.e164;
  // Drop the trunk prefix before joining: '+49' + '0151…' would be nonsense.
  const digits = national.replace(/[^\d]/g, '').replace(/^0+/, '');
  if (!digits) return '';
  try {
    return `+${getCountryCallingCode(country)}${digits}`;
  } catch {
    return national.trim();
  }
}

/**
 * Groups the national part the way the selected country writes it, as the user types:
 * DE '15141620000' -> '1514 1620000', US '2025550187' -> '202 555 0187'.
 *
 * Formats via the international form and strips the dial code back off, because
 * AsYouType(country) only groups digits when the national trunk prefix ('0') is
 * present — and with the dial code shown in its own control, users don't type it.
 * Returns the input untouched if it can't format, so typing never fights the user.
 */
export function formatNational(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  try {
    // A leading zero is the national trunk prefix in most of Europe. AsYouType(country)
    // understands it natively ('015141620000' -> '01514 1620000'), and parsePhone reads
    // that form back correctly, so a customer who types the 0 out of habit is fine.
    if (digits.startsWith('0')) return new AsYouType(country).input(digits) || digits;

    // No trunk prefix: format through the international form and strip the dial code
    // back off, because AsYouType(country) won't group bare national digits.
    const callingCode = `+${getCountryCallingCode(country)}`;
    const grouped = new AsYouType().input(callingCode + digits);
    return grouped.slice(callingCode.length).trim() || digits;
  } catch {
    return raw;
  }
}

/**
 * Handles a pasted or typed international number ('+1 202 555 0187') by splitting it
 * into the country and the national remainder, so the selector can jump to the right
 * country instead of leaving a '+' stuck in a field that already shows a dial code.
 * Returns null when `raw` isn't international or the country can't be determined.
 */
export function splitInternational(raw: string): { country: CountryCode; national: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null;
  const normalized = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
  try {
    const parsed = parsePhoneNumberFromString(normalized);
    if (!parsed?.country) return null;
    return { country: parsed.country, national: formatNational(parsed.nationalNumber, parsed.country) };
  } catch {
    return null;
  }
}

// Deliberately no flag icons here. components/FlagIcon.tsx covers only de/en/tr and
// exists specifically because emoji flags "render inconsistently across platforms and
// look unprofessional" — a selector needs ~240 countries, so neither option holds up.
// Dial code + localised country name is consistent everywhere and reads cleanly.
export interface CountryOption {
  code: CountryCode;
  callingCode: string;
  name: string;
}

/**
 * Country list for the selector, localised via Intl.DisplayNames.
 * Priority countries surface first because they cover most airport-transfer
 * customers; the rest follow alphabetically by localised name.
 */
const PRIORITY: CountryCode[] = ['DE', 'AT', 'CH', 'US', 'GB', 'TR', 'FR', 'IT', 'NL', 'ES'];

export function getCountryOptions(locale: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }

  const build = (code: CountryCode): CountryOption => ({
    code,
    callingCode: `+${getCountryCallingCode(code)}`,
    name: names?.of(code) ?? code,
  });

  const rest = getCountries()
    .filter(c => !PRIORITY.includes(c))
    .map(build)
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return [...PRIORITY.map(build), ...rest];
}
