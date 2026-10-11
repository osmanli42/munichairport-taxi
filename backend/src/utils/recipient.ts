// Rides imported from the Google Calendar carry our own address (freisingtaxi@gmail.com) as the
// "customer" e-mail. Every customer-facing mail for such a booking (reminder, confirmation,
// cancellation, live-tracking link, invoice) must reach the admin inbox only — never that Gmail
// account. customerRecipient() swaps an own (or empty) address for the admin address.

const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const OWN_ADDRESS = /^freisingtaxi@gmail\.com$|@flughafen-muenchen\.taxi$|@flughafen-muenchen-taxi\.de$|@taxifreising\.de$/i;

export function isOwnEmail(email: string | undefined | null): boolean {
  return OWN_ADDRESS.test(String(email || '').trim());
}

// Dieselbe Liste als SQL-Bedingung (z. B. damit Kalender-Fahrten mit unserer eigenen Adresse
// nicht als „ein Stammkunde“ zusammengezählt werden). `col` ist ein fester Spaltenname.
export function ownEmailSql(col: string): string {
  return `(LOWER(${col}) = 'freisingtaxi@gmail.com' OR LOWER(${col}) LIKE '%@flughafen-muenchen.taxi'`
    + ` OR LOWER(${col}) LIKE '%@flughafen-muenchen-taxi.de' OR LOWER(${col}) LIKE '%@taxifreising.de')`;
}
// Unsere Büronummer — steht bei manuell erfassten Fahrten manchmal statt der Kundennummer
export const OWN_PHONE_E164 = '+4915141620000';

export function customerRecipient(email: string | undefined | null): string {
  const admin = process.env.ADMIN_EMAIL || FROM_EMAIL;
  const e = String(email || '').trim();
  return !e || OWN_ADDRESS.test(e) ? admin : e;
}
