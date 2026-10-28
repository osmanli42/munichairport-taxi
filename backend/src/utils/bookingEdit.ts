// Kunden-Änderung in „Buchung verwalten“ (routes/bookings.ts → POST /manage/update).
// Rein, ohne DB/Zeitzone: Abholzeiten sind Münchner Wanduhr-Strings ohne Zeitzone und
// werden wie in utils/nightWindow.ts als „Wanduhr“-Millisekunden (Münchner Zeit, als wäre
// sie UTC) verglichen.

/** Änderungen sind bis so viele Stunden vor der Abholung möglich (Admin: booking_edit_hours). */
export const BOOKING_EDIT_DEFAULT_HOURS = 6;

/** Neue Abholzeit höchstens so weit in der Zukunft. */
export const BOOKING_EDIT_MAX_DAYS_AHEAD = 365;

/** 'YYYY-MM-DDTHH:MM[:SS]' (auch mit Leerzeichen) → gespeicherte Form 'YYYY-MM-DDTHH:MM:00'; ungültig → null */
export function normalizePickup(v: unknown): string | null {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = [+m[1], +m[2], +m[3], +m[4], +m[5]];
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00`;
}

/** Wanduhr-Millisekunden einer gespeicherten Abholzeit; ungültig → NaN */
export function wallMs(v: unknown): number {
  const n = normalizePickup(v);
  if (!n) return NaN;
  return Date.UTC(+n.slice(0, 4), +n.slice(5, 7) - 1, +n.slice(8, 10), +n.slice(11, 13), +n.slice(14, 16));
}

/** Ganze Zahl 0–999 aus Zahl oder Ziffern-String (kein "2.5", "-1", "abc"); sonst null */
export function toWholeNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 999 ? v : null;
  if (typeof v === 'string' && /^\d{1,3}$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

/** Frist in Stunden aus der Einstellung; leer/ungültig → Standard. */
export function editHoursFrom(v: string | undefined | null): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : BOOKING_EDIT_DEFAULT_HOURS;
}

export type CapacityCheck = { ok: true } | { ok: false; field: 'passengers' | 'luggage_count'; max: number };

/** Prüft die gewünschten Werte gegen die Fahrzeugkapazität (Admin → Preise: Max. Personen / Max. Koffer). */
export function checkCapacity(
  want: { passengers?: number; luggage_count?: number },
  max: { passengers: number; luggage: number },
): CapacityCheck {
  if (want.passengers !== undefined && want.passengers > max.passengers) return { ok: false, field: 'passengers', max: max.passengers };
  if (want.luggage_count !== undefined && want.luggage_count > max.luggage) return { ok: false, field: 'luggage_count', max: max.luggage };
  return { ok: true };
}

/**
 * true, wenn die Regel von Fahrtdatum/-uhrzeit abhängt. Ein Kunde mit so einem Rabatt
 * (z. B. „Ruhiger Tag“) darf die Fahrt nicht selbst auf einen anderen Tag verlegen und den
 * Rabatt mitnehmen — dann nur telefonisch.
 */
export function ruleDependsOnTripTime(rule: {
  trip_time_from?: number | null; trip_time_to?: number | null; weekday_mask?: string | null;
  start_date?: unknown; end_date?: unknown; max_days_ahead?: number | null; demand_pace_max?: number | null;
  gap_window_minutes?: number | null; leer_radius_km?: number | null; trip_date_max_uses?: number | null;
}): boolean {
  return rule.trip_time_from != null || rule.trip_time_to != null
    || (rule.weekday_mask != null && String(rule.weekday_mask).trim() !== '')
    || rule.start_date != null || rule.end_date != null
    || rule.max_days_ahead != null || rule.demand_pace_max != null
    || rule.gap_window_minutes != null || rule.leer_radius_km != null
    || rule.trip_date_max_uses != null;
}
