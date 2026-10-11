// Rides imported from the Google Calendar carry our own address (freisingtaxi@gmail.com) as the
// "customer" e-mail. Every customer-facing mail for such a booking (reminder, confirmation,
// cancellation, live-tracking link, invoice) must reach the admin inbox only — never that Gmail
// account. customerRecipient() swaps an own (or empty) address for the admin address.

const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const OWN_ADDRESS = /^freisingtaxi@gmail\.com$|@flughafen-muenchen\.taxi$|@flughafen-muenchen-taxi\.de$|@taxifreising\.de$/i;

export function customerRecipient(email: string | undefined | null): string {
  const admin = process.env.ADMIN_EMAIL || FROM_EMAIL;
  const e = String(email || '').trim();
  return !e || OWN_ADDRESS.test(e) ? admin : e;
}
