// "✓ Endgültig bestätigen" from the admin's new-booking mail. GET only shows the booking
// and a button — mail scanners (Outlook Safe Links, Gmail) open links on their own, so the
// customer mail is sent only by the POST from that button.
import { Router, Request, Response } from 'express';
import { query } from '../db';
import { verifyBookingConfirmToken } from '../utils/bookingConfirmToken';
import { sendFinalConfirmation } from '../services/bookingConfirmed';

const router = Router();

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fmtWall = (s: unknown) => {
  const v = String(s || '').replace(' ', 'T');
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]} · ${m[4]}:${m[5]} Uhr` : v;
};
const fmtDt = (d: unknown) => {
  const x = d instanceof Date ? d : new Date(String(d));
  return isNaN(x.getTime()) ? '' : x.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function page(title: string, body: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<style>
  body{margin:0;background:#eef1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827}
  .wrap{max-width:460px;margin:0 auto;padding:20px 14px}
  .card{background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb}
  .head{background:#10223c;color:#fff;padding:18px 20px}
  .head small{color:#e3b33f;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:11px}
  .head h1{margin:6px 0 0;font-size:20px}
  .body{padding:18px 20px}
  .row{margin-bottom:12px}.row b{display:block;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
  .row span{font-size:15px}
  .btn{display:block;width:100%;box-sizing:border-box;padding:15px;border:0;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none}
  .go{background:#10b981;color:#fff}.alt{background:#fff;color:#10223c;border:1px solid #d1d5db;margin-top:10px}
  .note{font-size:13px;color:#6b7280;margin-top:10px;line-height:1.5}
  .ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.5;margin-bottom:14px}
  .warn{background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.5;margin-bottom:14px}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.5;margin-bottom:14px}
</style></head><body><div class="wrap"><div class="card">${body}</div></div></body></html>`;
}

async function loadBooking(bn: string): Promise<any | null> {
  const [b] = await query<any>(
    `SELECT booking_number, name, email, phone, pickup_address, dropoff_address, pickup_datetime, return_datetime,
            trip_type, price, status, language, confirmed_email_sent_at
       FROM bookings WHERE booking_number = ?`, [bn]);
  return b || null;
}

function summary(b: any): string {
  return `
    <div class="row"><b>Kunde</b><span>${esc(b.name)} · ${esc(b.email || 'keine E-Mail')}</span></div>
    <div class="row"><b>Abholung</b><span>${esc(fmtWall(b.pickup_datetime))}${b.trip_type === 'roundtrip' && b.return_datetime ? `<br>Rückfahrt: ${esc(fmtWall(b.return_datetime))}` : ''}</span></div>
    <div class="row"><b>Strecke</b><span>${esc(b.pickup_address)}<br>→ ${esc(b.dropoff_address)}</span></div>
    <div class="row"><b>Preis</b><span>${Number(b.price || 0).toFixed(2).replace('.', ',')} € · Sprache ${esc(String(b.language || 'de').toUpperCase())}</span></div>`;
}

function head(b: any, title: string): string {
  return `<div class="head"><small>${esc(b?.booking_number || 'Buchung')}</small><h1>${esc(title)}</h1></div>`;
}

// GET /api/booking-confirm/:token — booking + confirm button
router.get('/:token', async (req: Request, res: Response) => {
  try { await showPage(req, res); } catch (e: any) { fail(res, e); }
});

// Express 4 does not catch rejected async handlers — an error here would crash the process.
function fail(res: Response, e: any) {
  console.error('[booking-confirm]', e?.message || e);
  if (!res.headersSent) res.status(500).send(page('Fehler', `<div class="body"><div class="err">Technischer Fehler — bitte im Admin bestätigen.</div></div>`));
}

async function showPage(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const bn = verifyBookingConfirmToken(req.params.token);
  const b = bn ? await loadBooking(bn) : null;
  if (!b) { res.status(404).send(page('Link ungültig', `<div class="body"><div class="err">Dieser Link ist ungültig oder abgelaufen. Bitte im Admin bestätigen.</div></div>`)); return; }

  let state = '';
  let form = `<form method="post"><button class="btn go" type="submit">✓ Jetzt verbindlich bestätigen &amp; Kunden informieren</button></form>
    <div class="note">Der Kunde erhält die Mail „Buchung verbindlich bestätigt“ in seiner Sprache.</div>`;
  if (b.status === 'cancelled') {
    state = `<div class="err">Diese Buchung ist storniert — es wird keine Bestätigung gesendet.</div>`;
    form = '';
  } else if (!b.email) {
    state = `<div class="err">Für diese Buchung ist keine E-Mail-Adresse hinterlegt.</div>`;
    form = '';
  } else if (b.confirmed_email_sent_at) {
    state = `<div class="ok">✓ Bestätigung wurde bereits am ${esc(fmtDt(b.confirmed_email_sent_at))} an ${esc(b.email)} gesendet.</div>`;
    form = `<form method="post"><input type="hidden" name="force" value="1"><button class="btn alt" type="submit">Erneut senden</button></form>`;
  }
  res.send(page('Buchung bestätigen', `${head(b, 'Buchung endgültig bestätigen')}<div class="body">${state}${summary(b)}${form}</div>`));
}

// POST /api/booking-confirm/:token — actually confirms and mails the customer
router.post('/:token', async (req: Request, res: Response) => {
  try { await confirmNow(req, res); } catch (e: any) { fail(res, e); }
});

async function confirmNow(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const bn = verifyBookingConfirmToken(req.params.token);
  if (!bn) { res.status(404).send(page('Link ungültig', `<div class="body"><div class="err">Dieser Link ist ungültig oder abgelaufen.</div></div>`)); return; }
  const force = String((req.body && req.body.force) || '') === '1';
  const r = await sendFinalConfirmation({ bookingNumber: bn }, { force, by: 'mail-link' });
  const b = await loadBooking(bn);
  let msg: string;
  if (r.ok) msg = `<div class="ok">✓ Bestätigt. Die Mail „Buchung verbindlich bestätigt“ ist an <b>${esc(r.to)}</b> gegangen.</div>`;
  else if (r.reason === 'already_sent') msg = `<div class="warn">Bereits am ${esc(fmtDt(r.sent_at))} gesendet — nichts erneut verschickt.</div>`;
  else if (r.reason === 'cancelled') msg = `<div class="err">Die Buchung ist storniert — nichts gesendet.</div>`;
  else if (r.reason === 'no_email') msg = `<div class="err">Keine E-Mail-Adresse hinterlegt — nichts gesendet.</div>`;
  else msg = `<div class="err">Senden fehlgeschlagen${r.error ? `: ${esc(r.error)}` : ''}. Bitte im Admin erneut versuchen.</div>`;
  res.send(page(r.ok ? 'Bestätigung gesendet' : 'Buchung bestätigen', `${head(b, r.ok ? 'Bestätigung gesendet' : 'Buchung bestätigen')}<div class="body">${msg}${b ? summary(b) : ''}</div>`));
}

export default router;
