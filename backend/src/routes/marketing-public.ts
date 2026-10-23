// Öffentliche Abmeldung von Marketing-Mails. GET zeigt nur eine Bestätigungsseite (Link-Scanner
// von Outlook & Co. sollen niemanden versehentlich abmelden); POST meldet ab — auch der
// One-Click-Abmeldeknopf von Gmail/Apple Mail (List-Unsubscribe-Post) schickt einen POST.
import { Router, Request, Response } from 'express';
import { run } from '../db';
import { verifyUnsubscribeToken } from '../utils/marketingToken';

const router = Router();

const T: Record<string, { title: string; ask: string; btn: string; done: string; doneText: string; invalid: string }> = {
  de: { title: 'E-Mail-Abmeldung', ask: 'Möchten Sie keine Angebote und Grüße mehr per E-Mail an {e} erhalten?', btn: 'Ja, abmelden', done: 'Sie sind abgemeldet', doneText: 'Sie erhalten keine Werbe-E-Mails mehr von uns. Buchungsbestätigungen zu Ihren Fahrten bekommen Sie weiterhin.', invalid: 'Dieser Abmeldelink ist ungültig.' },
  en: { title: 'Unsubscribe', ask: 'Do you no longer want to receive offers and greetings by e-mail at {e}?', btn: 'Yes, unsubscribe', done: 'You are unsubscribed', doneText: 'You will no longer receive marketing e-mails from us. You will still get booking confirmations for your rides.', invalid: 'This unsubscribe link is not valid.' },
  tr: { title: 'E-posta aboneliğinden çıkış', ask: '{e} adresine artık kampanya ve tebrik e-postası almak istemiyor musunuz?', btn: 'Evet, çık', done: 'Abonelikten çıktınız', doneText: 'Artık bizden kampanya e-postası almayacaksınız. Yolculuklarınızın rezervasyon onaylarını almaya devam edeceksiniz.', invalid: 'Bu çıkış linki geçersiz.' },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function page(lang: string, title: string, body: string): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Flughafen-München.TAXI</title></head>
<body style="margin:0;background:#eef1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:480px;margin:40px auto;padding:0 16px">
<div style="background:#0f2747;border-radius:18px 18px 0 0;padding:20px"><img src="https://flughafen-muenchen.taxi/images/logo-wide-400.webp" width="200" alt="Flughafen-München.TAXI" style="display:block;max-width:200px;height:auto"></div>
<div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 18px 18px;padding:24px">${body}</div>
</div></body></html>`;
}

router.get('/unsubscribe/:token', (req: Request, res: Response) => {
  const v = verifyUnsubscribeToken(String(req.params.token || ''));
  const t = T[v?.lang || 'de'];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!v) { res.status(400).send(page('de', t.title, `<p>${t.invalid}</p>`)); return; }
  res.send(page(v.lang, t.title, `
    <h1 style="font-size:20px;margin:0 0 10px">${esc(t.title)}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px">${esc(t.ask.replace('{e}', v.email))}</p>
    <form method="post"><button type="submit" style="background:#0f2747;color:#fff;border:0;border-radius:12px;padding:13px 22px;font-size:15px;font-weight:700;cursor:pointer">${esc(t.btn)}</button></form>`));
});

router.post('/unsubscribe/:token', async (req: Request, res: Response) => {
  const v = verifyUnsubscribeToken(String(req.params.token || ''));
  const t = T[v?.lang || 'de'];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!v) { res.status(400).send(page('de', t.title, `<p>${t.invalid}</p>`)); return; }
  try {
    await run(
      `INSERT INTO marketing_optout (email, campaign_id, source) VALUES (?, ?, 'link')
       ON DUPLICATE KEY UPDATE email = email`,
      [v.email, v.campaignId]
    );
  } catch (e) {
    console.error('Marketing unsubscribe error:', e);
    res.status(500).send(page(v.lang, t.title, '<p>Fehler – bitte schreiben Sie uns an info@flughafen-muenchen.taxi.</p>'));
    return;
  }
  res.send(page(v.lang, t.done, `
    <h1 style="font-size:20px;margin:0 0 10px">✓ ${esc(t.done)}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0">${esc(t.doneText)}</p>`));
});

export default router;
