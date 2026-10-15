// 1×1 open pixel in the customer's "Buchung eingegangen" mail and in our Stornierung mail
// (only when switched on in System → "E-Mail geöffnet melden"). The first open of each mail
// is stored on the booking and sent to the owner as a free CallMeBot WhatsApp — no Resend quota.
//
// Caveats shown in the System card: Apple Mail (Privacy Protection) loads images on its
// own right after delivery, so an early open may not be a real one; and in Germany open
// tracking legally needs the customer's consent (TTDSG §25).
import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { verifyMailOpenToken, MailOpenKind } from '../utils/bookingConfirmToken';
import { sendAdminWhatsApp } from '../services/notifications';

const router = Router();

// Transparent 1×1 GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** Who fetched the image — Gmail/Outlook proxy only on a real open, Apple maybe automatically. */
function mailClient(ua: string): string {
  if (/GoogleImageProxy/i.test(ua)) return 'Gmail';
  if (ua.trim() === 'Mozilla/5.0') return 'Apple Mail'; // Apple Mail Privacy Protection proxy
  if (/YahooMailProxy/i.test(ua)) return 'Yahoo';
  if (/Outlook|Microsoft Office|ms-office/i.test(ua)) return 'Outlook';
  if (/Thunderbird/i.test(ua)) return 'Thunderbird';
  if (/Android/i.test(ua)) return 'Android-Handy';
  if (/iPhone|iPad|Macintosh|AppleWebKit/i.test(ua) && !/Chrome|Firefox|Edg\//i.test(ua)) return 'Apple Mail';
  return 'anderes Programm';
}

// Mail security scanners fetch every image right after delivery, before the customer sees the
// mail (seen live: Gmail's scanner with a fake old Edge UA 4 s after sending, Microsoft Defender
// as desktop Chrome after 12 s). Those must neither send a WhatsApp nor use up the "first open".
const SCAN_WINDOW_SEC = 120;
function isScan(ua: string, ageSec: number | null): boolean {
  if (/GoogleImageProxy|YahooMailProxy/i.test(ua)) return false;            // proxy = real open
  if (!ua.trim() || /bot|crawl|spider|scan|preview|headless|python|curl|wget|java\//i.test(ua)) return true;
  if (/Edge\/1[2-8]\./.test(ua)) return true;                                // ancient Edge = Gmail scanner
  if (/iPhone|iPad|Android|Mobile/i.test(ua)) return false;                 // phone / tablet / mail app
  if (/Outlook|Microsoft Office|ms-office|Thunderbird/i.test(ua)) return false;
  if (ua.trim() === 'Mozilla/5.0') return false;                            // Apple proxy (flagged as evtl. automatisch)
  // Desktop browser right after sending = scanner; later it is webmail in a browser
  const desktopBrowser = /Windows NT|Macintosh|X11|Linux x86_64/i.test(ua) && /Chrome|Firefox|Edg\/|Safari/i.test(ua);
  return desktopBrowser && ageSec != null && ageSec < SCAN_WINDOW_SEC;
}

const fmtWall = (s: unknown) => {
  const m = String(s || '').replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}. ${m[4]}:${m[5]}` : '';
};

async function recordOpen(bn: string, kind: MailOpenKind, ua: string): Promise<void> {
  const [enabled] = await query<{ setting_value: string }>(
    "SELECT setting_value FROM settings WHERE setting_key = 'mail_open_tracking_enabled'");
  if (enabled?.setting_value !== '1') return;

  const [b] = await query<any>(
    `SELECT id, booking_number, name, pickup_datetime, status, confirmed_email_sent_at,
            TIMESTAMPDIFF(SECOND, ${kind === 'cancel' ? 'cancelled_at' : 'created_at'}, NOW()) AS age_sec
       FROM bookings WHERE booking_number = ?`, [bn]);
  if (!b) return;

  const ageSec = b.age_sec == null ? null : Number(b.age_sec);
  if (isScan(ua, ageSec)) {
    await run(`UPDATE bookings SET ${kind === 'cancel' ? 'cancel_mail_scan_count = cancel_mail_scan_count' : 'mail_scan_count = mail_scan_count'} + 1 WHERE id = ?`, [b.id]);
    return; // only counted — no WhatsApp, first open still free
  }

  const client = mailClient(ua);
  // Atomic "first open" — two parallel image loads must not both send a WhatsApp.
  let first;
  if (kind === 'cancel') {
    first = await run(
      'UPDATE bookings SET cancel_mail_opened_at = NOW(), cancel_mail_open_client = ? WHERE id = ? AND cancel_mail_opened_at IS NULL',
      [client, b.id]);
  } else {
    await run('UPDATE bookings SET mail_open_count = mail_open_count + 1 WHERE id = ?', [b.id]);
    first = await run(
      'UPDATE bookings SET mail_opened_at = NOW(), mail_open_client = ? WHERE id = ? AND mail_opened_at IS NULL',
      [client, b.id]);
  }
  if (first.affectedRows !== 1) return; // only the first open is reported

  // Apple fetches images by itself right after delivery — say so instead of claiming an open.
  // (Phones, Gmail/Outlook/Yahoo only fetch on a real open; early Apple/unknown may be a proxy.)
  const maybeAuto = ['Apple Mail', 'anderes Programm'].includes(client) && ageSec != null && ageSec < 180;
  const lines = kind === 'cancel'
    ? [
        `📭 Stornierungsmail geöffnet: ${b.name}`,
        `${b.booking_number} · Fahrt ${fmtWall(b.pickup_datetime)}`,
        `Programm: ${client}${maybeAuto ? ' (evtl. automatisch geladen)' : ''}`,
      ]
    : [
        `📬 Buchungsmail geöffnet: ${b.name}`,
        `${b.booking_number} · Fahrt ${fmtWall(b.pickup_datetime)}`,
        `Programm: ${client}${maybeAuto ? ' (evtl. automatisch geladen)' : ''}`,
        b.status === 'cancelled' ? 'Buchung ist storniert.'
          : b.confirmed_email_sent_at ? 'Endgültige Bestätigung wurde schon gesendet.'
          : 'Noch nicht endgültig bestätigt.',
      ];
  await sendAdminWhatsApp(lines.map((l) => encodeURIComponent(l)).join('%0A'));
}

// GET /api/mail-open/<token>.gif
router.get('/:file', (req: Request, res: Response) => {
  const token = String(req.params.file || '').replace(/\.gif$/i, '');
  const t = verifyMailOpenToken(token);
  if (t) {
    recordOpen(t.bn, t.kind, String(req.headers['user-agent'] || '').slice(0, 300))
      .catch((e) => console.error('[mail-open]', e?.message || e));
  }
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    // helmet sets same-origin by default; mail clients load this cross-origin
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.end(PIXEL);
});

export default router;
