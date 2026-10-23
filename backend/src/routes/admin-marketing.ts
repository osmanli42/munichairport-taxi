// Admin → Marketing (neu): Kampagnenkalender, Empfänger mit Segmenten, Vorschau/Test,
// Versand mit optionalem persönlichem Gutschein-Link pro Empfänger, Abmeldungen, Verlauf.
// Gemountet unter /api/admin/marketing2 (die alten /api/admin/marketing/*-Routen bleiben).

import { Router, Response } from 'express';
import { Resend } from 'resend';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { berlinDateSql } from '../utils/berlinTime';
import { ownEmailSql, isOwnEmail } from '../utils/recipient';
import { unsubscribeUrl } from '../utils/marketingToken';
import { gutscheinUrl, newGutscheinCode, addDays } from '../services/gutschein';
import { customerCampaignEmail, campaignFooterHtml } from '../services/bookingEmailTemplates';
import { encodeNonAscii } from '../services/notifications';
import {
  marketingCalendar, marketingReminders, occasionOverrides, customOccasions, OFFER_TEXT,
  OccasionDefaults, CustomOccasion, Segment, Mode,
} from '../services/marketingCalendar';

const router = Router();
router.use(authenticateAdmin);

const LANGS = ['de', 'en', 'tr'] as const;
type Lang = typeof LANGS[number];
const FROM = 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEGMENTS: Segment[] = ['all', 'privat', 'business', 'stamm', 'business_stamm'];
const MODES: Mode[] = ['greeting', 'discount'];

async function setSetting(key: string, value: string): Promise<void> {
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [key, value, value]);
}

// ---- Kalender & Einstellungen ----------------------------------------------------------------

router.get('/calendar', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ ...(await marketingCalendar()), offer: OFFER_TEXT });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Kalender konnte nicht geladen werden' });
  }
});

router.get('/reminders', async (_req: AuthRequest, res: Response) => {
  try {
    const list = await marketingReminders();
    res.json({ count: list?.length || 0, items: list || [] });
  } catch {
    res.json({ count: 0, items: [] });
  }
});

/** Einstellungen eines Anlasses speichern (nur die geänderten Felder werden übernommen). */
router.put('/occasions/:id/settings', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id).slice(0, 60);
  const b = req.body || {};
  const o: Partial<OccasionDefaults> = {};
  if (typeof b.enabled === 'boolean') o.enabled = b.enabled;
  const int = (v: any, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : undefined; };
  const lead = int(b.leadDays, 0, 90); if (lead !== undefined) o.leadDays = lead;
  const after = int(b.afterDays, 0, 30); if (after !== undefined) o.afterDays = after;
  const valid = int(b.validDays, 1, 365); if (valid !== undefined) o.validDays = valid;
  const p = Number(b.percent); if (p >= 1 && p <= 30) o.percent = Math.round(p * 10) / 10;
  if (b.maxAmount === null || b.maxAmount === '') o.maxAmount = null;
  else if (Number(b.maxAmount) > 0 && Number(b.maxAmount) <= 500) o.maxAmount = Number(b.maxAmount);
  if (SEGMENTS.includes(b.segment)) o.segment = b.segment;
  if (MODES.includes(b.mode)) o.mode = b.mode;
  try {
    const all = await occasionOverrides();
    all[id] = { ...(all[id] || {}), ...o };
    await setSetting('marketing_occasion_settings', JSON.stringify(all));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Speichern fehlgeschlagen' });
  }
});

/** Einstellungen eines Anlasses auf den Vorschlag zurücksetzen. */
router.delete('/occasions/:id/settings', async (req: AuthRequest, res: Response) => {
  try {
    const all = await occasionOverrides();
    delete all[String(req.params.id)];
    await setSetting('marketing_occasion_settings', JSON.stringify(all));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Zurücksetzen fehlgeschlagen' });
  }
});

/** „Dieses Jahr überspringen“ — keine Erinnerung mehr für dieses Vorkommen. */
router.post('/occasions/:id/skip', async (req: AuthRequest, res: Response) => {
  const year = parseInt(req.body?.year, 10);
  if (!(year > 2000)) { res.status(400).json({ error: 'year fehlt' }); return; }
  await run(`INSERT INTO marketing_campaigns (occasion_id, occasion_year, status) VALUES (?, ?, 'skipped')`, [String(req.params.id).slice(0, 60), year]);
  res.json({ success: true });
});

router.delete('/occasions/:id/skip', async (req: AuthRequest, res: Response) => {
  const year = parseInt(String(req.query.year), 10);
  await run(`DELETE FROM marketing_campaigns WHERE occasion_id = ? AND occasion_year = ? AND status = 'skipped'`, [String(req.params.id), year]);
  res.json({ success: true });
});

router.put('/reminders-enabled', async (req: AuthRequest, res: Response) => {
  await setSetting('marketing_reminders_enabled', req.body?.enabled === false ? '0' : '1');
  res.json({ success: true });
});

/** Eigene, jährlich wiederkehrende Anlässe (z. B. Firmenjubiläum). */
router.post('/custom-occasions', async (req: AuthRequest, res: Response) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 80);
  const monthDay = String(b.monthDay || '');
  if (!name || !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(monthDay)) { res.status(400).json({ error: 'Name und Datum (MM-TT) nötig' }); return; }
  const c: CustomOccasion = {
    id: `custom-${Date.now().toString(36)}`, name, monthDay,
    leadDays: Math.min(60, Math.max(0, parseInt(b.leadDays ?? 7, 10) || 0)),
    segment: SEGMENTS.includes(b.segment) ? b.segment : 'all',
    mode: MODES.includes(b.mode) ? b.mode : 'greeting',
    percent: Number(b.percent) >= 1 && Number(b.percent) <= 30 ? Number(b.percent) : 10,
    subject: String(b.subject || '').slice(0, 200), message: String(b.message || '').slice(0, 4000),
  };
  const list = await customOccasions();
  list.push(c);
  await setSetting('marketing_custom_occasions', JSON.stringify(list));
  res.json({ success: true, id: c.id });
});

router.delete('/custom-occasions/:id', async (req: AuthRequest, res: Response) => {
  const list = (await customOccasions()).filter(c => c.id !== req.params.id);
  await setSetting('marketing_custom_occasions', JSON.stringify(list));
  res.json({ success: true });
});

// ---- Empfänger -----------------------------------------------------------------------------

router.get('/customers', async (_req: AuthRequest, res: Response) => {
  try {
    const customers = await query<any>(`
      SELECT LOWER(TRIM(b.email)) AS email,
             MAX(b.name) AS name,
             DATE_FORMAT(MAX(b.pickup_datetime), '%Y-%m-%d') AS lastBooking,
             COUNT(*) AS bookingCount,
             SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(b.language, 'de') ORDER BY b.created_at DESC), ',', 1) AS lang,
             MAX(CASE WHEN b.company_id IS NOT NULL OR b.rechnung_required = 1
                       OR b.payment_method IN ('rechnung', 'invoice', 'ueberweisung') THEN 1 ELSE 0 END) AS isBusiness
        FROM bookings b
       WHERE b.email LIKE '%@%' AND b.status <> 'cancelled' AND NOT ${ownEmailSql('b.email')}
       GROUP BY LOWER(TRIM(b.email))
       ORDER BY MAX(b.pickup_datetime) DESC`);
    const optouts = (await query<{ email: string }>('SELECT email FROM marketing_optout')).map(r => r.email);
    const out = new Set(optouts);
    res.json({
      customers: customers
        .filter(c => EMAIL_RE.test(c.email))
        .map(c => ({
          email: c.email, name: c.name || '', lastBooking: c.lastBooking, bookingCount: Number(c.bookingCount) || 0,
          lang: LANGS.includes(c.lang) ? c.lang : 'de', isBusiness: Number(c.isBusiness) === 1, optedOut: out.has(c.email),
        })),
      optouts,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Kunden konnten nicht geladen werden' });
  }
});

// Gespeicherte Auswahl „Eski site“-Kontakte (bleibt über Sitzungen und Geräte erhalten)
router.get('/picked', async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await query<{ email: string; name: string | null }>('SELECT email, name FROM marketing_picked ORDER BY created_at'));
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Auswahl konnte nicht geladen werden' });
  }
});

router.put('/picked', async (req: AuthRequest, res: Response) => {
  const add: Array<{ email: string; name?: string }> = Array.isArray(req.body?.add) ? req.body.add : [];
  const remove: string[] = Array.isArray(req.body?.remove) ? req.body.remove : [];
  try {
    const rows = add.map(r => ({ email: String(r?.email || '').trim().toLowerCase(), name: String(r?.name || '').trim().slice(0, 120) }))
      .filter(r => EMAIL_RE.test(r.email) && r.email.length <= 190);
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      await run(`INSERT INTO marketing_picked (email, name) VALUES ${chunk.map(() => '(?, ?)').join(',')}
                 ON DUPLICATE KEY UPDATE name = COALESCE(NULLIF(VALUES(name), ''), name)`,
        chunk.flatMap(r => [r.email, r.name || null]));
    }
    const rem = remove.map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
    for (let i = 0; i < rem.length; i += 500) {
      const chunk = rem.slice(i, i + 500);
      await run(`DELETE FROM marketing_picked WHERE email IN (${chunk.map(() => '?').join(',')})`, chunk);
    }
    const [c] = await query<{ n: number }>('SELECT COUNT(*) AS n FROM marketing_picked');
    res.json({ success: true, count: Number(c?.n) || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Auswahl konnte nicht gespeichert werden' });
  }
});

router.delete('/picked', async (_req: AuthRequest, res: Response) => {
  await run('DELETE FROM marketing_picked');
  res.json({ success: true });
});

// ---- Mail bauen ------------------------------------------------------------------------------

interface LangText { subject: string; message: string; badge?: string; buttonText?: string; buttonUrl?: string }
interface Discount { percent: number; endDate: string; maxAmount: number | null }

function parseTexts(b: any): Partial<Record<Lang, LangText>> {
  const out: Partial<Record<Lang, LangText>> = {};
  for (const l of LANGS) {
    const t = b?.texts?.[l];
    if (!t) continue;
    const subject = String(t.subject || '').trim().slice(0, 255);
    const message = String(t.message || '').slice(0, 8000);
    if (!subject && !message) continue;
    out[l] = {
      subject, message,
      badge: String(t.badge || '').slice(0, 80) || undefined,
      buttonText: String(t.buttonText || '').slice(0, 80) || undefined,
      buttonUrl: /^https?:\/\//.test(String(t.buttonUrl || '')) ? String(t.buttonUrl).slice(0, 500) : undefined,
    };
  }
  return out;
}

function parseDiscount(b: any): { discount: Discount | null; error?: string } {
  const d = b?.discount;
  if (!d) return { discount: null };
  const percent = Math.round(Number(d.percent) * 10) / 10;
  if (!(percent >= 1 && percent <= 30)) return { discount: null, error: 'Rabatt muss zwischen 1 und 30 % liegen' };
  const today = berlinDateSql(0);
  let endDate: string;
  if (d.endDate) {
    endDate = String(d.endDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < today) return { discount: null, error: 'Gültig-bis-Datum ungültig' };
  } else {
    const days = parseInt(d.validDays ?? 30, 10);
    if (!(days >= 1 && days <= 365)) return { discount: null, error: 'Gültigkeit 1–365 Tage' };
    endDate = addDays(today, days);
  }
  const max = Number(d.maxAmount);
  return { discount: { percent, endDate, maxAmount: max > 0 && max <= 500 ? max : null } };
}

function buildMail(opts: { lang: Lang; text: LangText; isHtml: boolean; html?: string; name?: string; email: string;
  campaignId: number | null; coupon?: { code: string; d: Discount } | null }): { subject: string; html: string; unsub: string } {
  const unsub = unsubscribeUrl(opts.email, opts.campaignId, opts.lang);
  if (opts.isHtml && opts.html) {
    const body = String(opts.html).replace(/\{isim\}|\{name\}/gi, opts.name || '');
    return { subject: opts.text.subject, html: encodeNonAscii(body + campaignFooterHtml(opts.lang, unsub)), unsub };
  }
  const { subject, html } = customerCampaignEmail({
    lang: opts.lang, name: opts.name, subject: opts.text.subject, message: opts.text.message, badge: opts.text.badge,
    buttonText: opts.text.buttonText, buttonUrl: opts.text.buttonUrl, unsubscribeUrl: unsub,
    coupon: opts.coupon ? { percent: opts.coupon.d.percent, endDate: opts.coupon.d.endDate, maxAmount: opts.coupon.d.maxAmount, url: gutscheinUrl(opts.coupon.code, opts.lang) } : null,
  });
  return { subject, html, unsub };
}

const pickLang = (texts: Partial<Record<Lang, LangText>>, want: string): Lang =>
  (LANGS.includes(want as Lang) && texts[want as Lang]) ? want as Lang : texts.de ? 'de' : (Object.keys(texts)[0] as Lang);

router.post('/preview', (req: AuthRequest, res: Response) => {
  const texts = parseTexts(req.body);
  const { discount, error } = parseDiscount(req.body);
  if (error) { res.status(400).json({ error }); return; }
  if (!Object.keys(texts).length && !req.body?.html) { res.status(400).json({ error: 'Text fehlt' }); return; }
  const lang = pickLang(texts, req.body?.lang);
  const text = texts[lang] || { subject: String(req.body?.subject || ''), message: '' };
  const m = buildMail({ lang, text, isHtml: !!req.body?.isHtml, html: req.body?.html, name: String(req.body?.name || 'Max Mustermann'),
    email: 'vorschau@example.com', campaignId: null, coupon: discount ? { code: 'GS-MUSTER00', d: discount } : null });
  res.json({ subject: m.subject, html: m.html });
});

/** Testversand an die Admin-Adresse (ohne echten Gutschein-Code). */
router.post('/test', async (req: AuthRequest, res: Response) => {
  const texts = parseTexts(req.body);
  const { discount, error } = parseDiscount(req.body);
  if (error) { res.status(400).json({ error }); return; }
  if (!process.env.RESEND_API_KEY) { res.status(400).json({ error: 'RESEND_API_KEY fehlt – E-Mail kann nicht gesendet werden' }); return; }
  const lang = pickLang(texts, req.body?.lang);
  const text = texts[lang];
  if (!text && !req.body?.html) { res.status(400).json({ error: 'Text fehlt' }); return; }
  const to = process.env.ADMIN_EMAIL || 'info@flughafen-muenchen.taxi';
  const m = buildMail({ lang, text: text || { subject: String(req.body?.subject || ''), message: '' }, isHtml: !!req.body?.isHtml, html: req.body?.html,
    name: 'Max Mustermann', email: to, campaignId: null, coupon: discount ? { code: 'GS-MUSTER00', d: discount } : null });
  const { error: sendErr } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: FROM, to, subject: `[TEST] ${m.subject}`, html: m.html });
  if (sendErr) { res.status(500).json({ error: sendErr.message }); return; }
  res.json({ success: true, to });
});

// ---- Versand -----------------------------------------------------------------------------------

/**
 * Versand: Empfänger bereinigen (doppelt, ungültig, eigene Adressen, Abgemeldete), Kampagne
 * anlegen, bei Rabatt pro Empfänger einen eigenen Einmal-Gutschein erzeugen, in 100er-Batches
 * senden (mit List-Unsubscribe-Header). MARKETING_DRY_RUN=1 (nur lokal): nichts wird gesendet.
 */
router.post('/send', async (req: AuthRequest, res: Response) => {
  const b = req.body || {};
  const texts = parseTexts(b);
  const isHtml = !!b.isHtml;
  const { discount, error } = parseDiscount(b);
  if (error) { res.status(400).json({ error }); return; }
  if (!Object.keys(texts).length || (isHtml && !b.html)) { res.status(400).json({ error: 'Betreff und Text fehlen' }); return; }
  for (const t of Object.values(texts)) if (!t!.subject) { res.status(400).json({ error: 'Betreff fehlt' }); return; }
  const dryRun = process.env.MARKETING_DRY_RUN === '1';
  if (!dryRun && !process.env.RESEND_API_KEY) { res.status(400).json({ error: 'RESEND_API_KEY fehlt – E-Mail kann nicht gesendet werden' }); return; }
  if (!Array.isArray(b.recipients) || !b.recipients.length) { res.status(400).json({ error: 'Keine Empfänger' }); return; }
  if (b.recipients.length > 20000) { res.status(400).json({ error: 'Zu viele Empfänger (max. 20.000)' }); return; }

  const optouts = new Set((await query<{ email: string }>('SELECT email FROM marketing_optout')).map(r => r.email));
  const seen = new Set<string>();
  let skippedOptout = 0;
  const recipients: Array<{ email: string; name: string; lang: Lang }> = [];
  for (const r of b.recipients) {
    const email = String(r?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email) || isOwnEmail(email)) continue;
    seen.add(email);
    if (optouts.has(email)) { skippedOptout++; continue; }
    const lang = b.langMode && LANGS.includes(b.langMode) ? b.langMode : pickLang(texts, r?.lang);
    recipients.push({ email, name: String(r?.name || '').trim().slice(0, 120), lang: texts[lang as Lang] ? lang : pickLang(texts, 'de') });
  }
  if (!recipients.length) { res.status(400).json({ error: 'Keine gültigen Empfänger (alle abgemeldet oder ungültig)' }); return; }

  const occasionId = b.occasion_id ? String(b.occasion_id).slice(0, 60) : null;
  const occasionYear = occasionId ? parseInt(b.occasion_year, 10) || +berlinDateSql(0).slice(0, 4) : null;
  const langCount: Record<string, number> = {};
  for (const r of recipients) langCount[r.lang] = (langCount[r.lang] || 0) + 1;
  const firstText = texts[pickLang(texts, 'de')]!;
  const c = await run(
    `INSERT INTO marketing_campaigns (occasion_id, occasion_year, status, subject, recipients, discount_percent, discount_max, discount_until, langs)
     VALUES (?, ?, 'sending', ?, ?, ?, ?, ?, ?)`,
    [occasionId, occasionYear, firstText.subject, recipients.length, discount?.percent ?? null, discount?.maxAmount ?? null, discount?.endDate ?? null,
      Object.entries(langCount).map(([l, n]) => `${l}:${n}`).join(',')]
  );
  const campaignId = c.insertId;

  try {
    // Empfängerliste speichern (für „hat danach gebucht“ im Verlauf)
    for (let i = 0; i < recipients.length; i += 500) {
      const chunk = recipients.slice(i, i + 500);
      await run(`INSERT IGNORE INTO marketing_campaign_recipients (campaign_id, email) VALUES ${chunk.map(() => '(?, ?)').join(',')}`,
        chunk.flatMap(r => [campaignId, r.email]));
    }

    // Persönliche Einmal-Gutscheine
    const codes = new Map<string, string>();
    if (discount) {
      const today = berlinDateSql(0);
      for (let i = 0; i < recipients.length; i += 200) {
        const chunk = recipients.slice(i, i + 200);
        for (let attempt = 0; ; attempt++) {
          const rows = chunk.map(r => ({ r, code: newGutscheinCode() }));
          try {
            await run(
              `INSERT INTO promotions (code, type, value, start_date, end_date, max_uses, kombinierbar, show_banner, active,
                                       personal, recipient_name, recipient_email, recipient_lang, reason, campaign_id, max_amount)
               VALUES ${rows.map(() => `(?, 'percent', ?, ?, ?, 1, 1, 0, 1, 1, ?, ?, ?, 'kampagne', ?, ?)`).join(',')}`,
              rows.flatMap(({ r, code }) => [code, discount.percent, today, discount.endDate, r.name || null, r.email, r.lang, campaignId, discount.maxAmount])
            );
            for (const { r, code } of rows) codes.set(r.email, code);
            break;
          } catch (e: any) {
            if (!String(e.message).includes('Duplicate') || attempt >= 4) throw e;
          }
        }
      }
    }

    // Versand
    const resend = dryRun ? null : new Resend(process.env.RESEND_API_KEY);
    let sent = 0, failed = 0;
    const errors: Array<{ email: string; error: string }> = [];
    for (let i = 0; i < recipients.length; i += 100) {
      if (i > 0 && !dryRun) await new Promise(r => setTimeout(r, 500));
      const batch = recipients.slice(i, i + 100);
      const payload = batch.map(r => {
        const code = codes.get(r.email);
        const m = buildMail({ lang: r.lang, text: texts[r.lang]!, isHtml, html: b.html, name: r.name, email: r.email, campaignId,
          coupon: code && discount ? { code, d: discount } : null });
        return {
          from: FROM, to: r.email, subject: m.subject, html: m.html, replyTo: 'info@flughafen-muenchen.taxi',
          headers: { 'List-Unsubscribe': `<${m.unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        };
      });
      if (dryRun) { sent += batch.length; continue; }
      try {
        const response = await (resend!.batch as any).send(payload);
        if (response?.error) throw new Error(response.error.message || 'Batch error');
        sent += batch.length;
      } catch (err: any) {
        console.warn('Marketing batch failed, sending one by one:', err?.message);
        for (const p of payload) {
          try {
            const { error: e1 } = await resend!.emails.send(p as any);
            if (e1) throw new Error(e1.message);
            sent++;
          } catch (e2: any) {
            failed++;
            errors.push({ email: p.to, error: e2?.message || 'Send failed' });
          }
        }
      }
    }
    await run(`UPDATE marketing_campaigns SET status = 'sent', sent = ?, failed = ? WHERE id = ?`, [sent, failed, campaignId]);
    res.json({ success: true, campaignId, sent, failed, skippedOptout, errors: errors.slice(0, 20), codes: codes.size, dryRun });
  } catch (e: any) {
    console.error('Marketing send error:', e);
    await run(`UPDATE marketing_campaigns SET status = 'sent', failed = recipients - sent WHERE id = ?`, [campaignId]).catch(() => {});
    res.status(500).json({ error: e.message || 'Versand fehlgeschlagen', campaignId });
  }
});

// ---- Verlauf -----------------------------------------------------------------------------------

router.get('/campaigns', async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query<any>(`SELECT * FROM marketing_campaigns WHERE status <> 'skipped' ORDER BY created_at DESC LIMIT 60`);
    const ids = rows.map(r => r.id);
    const ph = ids.map(() => '?').join(',');
    const redeemed = ids.length ? await query<any>(`
      SELECT p.campaign_id, COUNT(b.id) AS n, COALESCE(SUM(b.discount_amount), 0) AS discount, COALESCE(SUM(b.price), 0) AS revenue
        FROM promotions p JOIN bookings b ON b.promo_code = p.code AND b.status <> 'cancelled'
       WHERE p.campaign_id IN (${ph}) GROUP BY p.campaign_id`, ids) : [];
    // Empfänger, die innerhalb von 30 Tagen nach dem Versand gebucht haben (mit oder ohne Gutschein)
    const booked = ids.length ? await query<any>(`
      SELECT c.id AS campaign_id, COUNT(DISTINCT b.id) AS n, COALESCE(SUM(b.price), 0) AS revenue
        FROM marketing_campaigns c
        JOIN marketing_campaign_recipients r ON r.campaign_id = c.id
        JOIN bookings b ON LOWER(TRIM(b.email)) COLLATE utf8mb4_unicode_ci = r.email COLLATE utf8mb4_unicode_ci AND b.status <> 'cancelled'
                       AND b.created_at >= c.created_at AND b.created_at < c.created_at + INTERVAL 30 DAY
       WHERE c.id IN (${ph}) GROUP BY c.id`, ids) : [];
    const unsub = ids.length ? await query<any>(`SELECT campaign_id, COUNT(*) AS n FROM marketing_optout WHERE campaign_id IN (${ph}) GROUP BY campaign_id`, ids) : [];
    const by = (list: any[], id: number) => list.find(x => x.campaign_id === id);
    res.json(rows.map(r => ({
      id: r.id, occasion_id: r.occasion_id, occasion_year: r.occasion_year, status: r.status, subject: r.subject,
      recipients: r.recipients, sent: r.sent, failed: r.failed, langs: r.langs, created_at: r.created_at,
      discount: r.discount_percent != null ? { percent: Number(r.discount_percent), maxAmount: r.discount_max != null ? Number(r.discount_max) : null, until: r.discount_until } : null,
      redeemed: { count: Number(by(redeemed, r.id)?.n) || 0, discount: Number(by(redeemed, r.id)?.discount) || 0, revenue: Number(by(redeemed, r.id)?.revenue) || 0 },
      booked: { count: Number(by(booked, r.id)?.n) || 0, revenue: Number(by(booked, r.id)?.revenue) || 0 },
      unsubscribed: Number(by(unsub, r.id)?.n) || 0,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Verlauf konnte nicht geladen werden' });
  }
});

export default router;
