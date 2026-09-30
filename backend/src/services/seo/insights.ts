// Turns everything the SEO tab knows into a short, ranked to-do list — and mails the
// important changes (alert category 'seo').

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { query, run } from '../../db';
import { shouldSendAlert } from '../alertCenter';
import { ISSUE_LABELS } from './audit';
import { queryTable, pageTable, trackedKeywords, expectedCtr, pathOf, gscTotals } from './analytics';
import { latestVitals } from './vitals';
import { gscStatus } from './gsc';

export const SEO_TRACKER_DIR = path.join(__dirname, '../../../../frontend/scripts/seo-tracker/data');
export const DEFAULT_KEYWORDS = ['flughafen münchen taxi', 'taxi münchen flughafen', 'munich airport taxi', 'flughafen taxi münchen festpreis'];

export type Task = {
  key: string;
  kind: 'setup' | 'technical' | 'keyword' | 'ctr' | 'content' | 'speed' | 'competitor';
  title: string;
  detail: string;
  urls?: string[];
  impact: number;          // 0–100, for sorting
  status: 'open' | 'done' | 'ignored';
  updated_at?: string | null;
};

const key = (...p: string[]) => crypto.createHash('sha1').update(p.join('|')).digest('hex');
const fmt = (n: number, d = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: d });

export async function trackedKeywordList(): Promise<string[]> {
  const [r] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = 'seo_tracked_keywords'`);
  try {
    const list = r ? JSON.parse(r.setting_value) : DEFAULT_KEYWORDS;
    return Array.isArray(list) && list.length ? list.map(String) : DEFAULT_KEYWORDS;
  } catch {
    return DEFAULT_KEYWORDS;
  }
}

function latestDeepsearch(): any | null {
  try {
    const files = fs.readdirSync(SEO_TRACKER_DIR).filter((f) => /^deepsearch-.*\.json$/.test(f)).sort();
    if (!files.length) return null;
    return JSON.parse(fs.readFileSync(path.join(SEO_TRACKER_DIR, files[files.length - 1]), 'utf8'));
  } catch {
    return null;
  }
}

export async function buildTasks(): Promise<Task[]> {
  const tasks: Omit<Task, 'status'>[] = [];
  const gsc = await gscStatus();

  if (!gsc.connected) {
    tasks.push({
      key: key('setup', 'gsc'), kind: 'setup', impact: 100,
      title: 'Google Search Console bağla',
      detail: gsc.error_kind === 'api_disabled'
        ? 'Google Cloud\'da "Google Search Console API" etkin değil. SEO → Bağlantı sekmesindeki linkten etkinleştir.'
        : `Search Console → Ayarlar → Kullanıcılar ve izinler → ${gsc.email || 'servis hesabı'} ekle (Kısıtlı). Tıklama, gösterim ve gerçek pozisyon verisi buradan gelir.`,
    });
  }

  // Technical: open audit issues grouped by type; single-page errors are listed with URLs.
  const issues = await query<any>(`SELECT url, type, severity, detail FROM seo_audit_issues WHERE resolved_at IS NULL`);
  const byType = new Map<string, any[]>();
  for (const i of issues) byType.set(i.type, [...(byType.get(i.type) || []), i]);
  const sevWeight: Record<string, number> = { error: 90, warning: 55, notice: 25 };
  for (const [type, list] of Array.from(byType.entries())) {
    const sev = list[0].severity;
    tasks.push({
      key: key('audit', type), kind: 'technical',
      impact: Math.min(99, sevWeight[sev] + Math.min(9, list.length)),
      title: `${ISSUE_LABELS[type] || type} — ${list.length} sayfa`,
      detail: list.slice(0, 3).map((i) => `${pathOf(i.url)}${i.detail ? `: ${i.detail}` : ''}`).join(' · '),
      urls: list.slice(0, 20).map((i) => i.url),
    });
  }

  if (gsc.connected) {
    const q = await queryTable(28);
    for (const r of q.striking.slice(0, 6)) {
      tasks.push({
        key: key('striking', r.query), kind: 'keyword',
        impact: Math.min(85, 40 + Math.round(Math.log10(r.impressions + 1) * 12)),
        title: `„${r.query}“ ${fmt(r.position)}. sırada — ilk 3'e taşı`,
        detail: `${fmt(r.impressions, 0)} gösterim, ${r.clicks} tıklama (28 gün). ${r.page ? `Sayfa ${pathOf(r.page)}: ` : ''}kelimeyi title/H2'de kullan, bu konuda bir bölüm veya SSS ekle, ilgili sayfalardan iç link ver.`,
        urls: r.page ? [r.page] : undefined,
      });
    }
    for (const r of q.ctrOpp.slice(0, 5)) {
      tasks.push({
        key: key('ctr', r.query), kind: 'ctr',
        impact: Math.min(80, 35 + Math.round(Math.log10((r.missed || 0) + 1) * 20)),
        title: `„${r.query}“ için tıklama oranı düşük (%${fmt(r.ctr * 100)})`,
        detail: `${fmt(r.position)}. sırada, beklenen ~%${fmt(expectedCtr(r.position) * 100, 0)} — ayda ~${r.missed} tıklama kaçıyor. ${r.page ? pathOf(r.page) + ': ' : ''}title ve meta açıklamayı daha çekici yaz (fiyat, "Festpreis", "24/7", ⭐ puan).`,
        urls: r.page ? [r.page] : undefined,
      });
    }
    const p = await pageTable(28);
    for (const d of p.decay.slice(0, 4)) {
      tasks.push({
        key: key('decay', d.path), kind: 'content', impact: 60,
        title: `${d.path} tıklama kaybediyor (${Math.round(d.change * 100)} %)`,
        detail: `${d.prev_clicks} → ${d.clicks} tıklama (28 gün vs önceki 28). İçeriği güncelle (tarih, fiyatlar, yeni bölüm), Search Console'da sorgularını kontrol et.`,
      });
    }
  }

  for (const v of await latestVitals()) {
    const lcp = v.field_lcp_ms ?? v.lcp_ms;
    if ((lcp && lcp > 2500) || (v.field_cls ?? v.cls ?? 0) > 0.1 || (v.score != null && v.score < 60)) {
      tasks.push({
        key: key('speed', v.url), kind: 'speed', impact: 58,
        title: `${pathOf(v.url)} mobilde yavaş (skor ${v.score ?? '—'})`,
        detail: `LCP ${lcp ? fmt(lcp / 1000) + ' sn' : '—'}, CLS ${fmt(Number(v.field_cls ?? v.cls ?? 0), 2)}. Büyük görselleri küçült/önceliklendir, kaymayı önlemek için boyut ver.`,
        urls: [v.url],
      });
    }
  }

  const ds = latestDeepsearch();
  for (const plan of (ds?.plans || []).slice(0, 4)) {
    const gaps = (plan.gaps || []).filter((g: any) => g.action && g.action !== 'OK');
    if (!gaps.length) continue;
    tasks.push({
      key: key('competitor', plan.keyword, gaps.map((g: any) => g.criterion).join(',')), kind: 'competitor', impact: 45,
      title: `„${plan.keyword}“: 1. sıradaki rakipten eksikler`,
      detail: gaps.map((g: any) => `${g.criterion}: ${g.action}`).join(' · '),
      urls: plan.ourUrl ? [plan.ourUrl] : undefined,
    });
  }

  const states = await query<any>(`SELECT task_key, status, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_at FROM seo_tasks`);
  const stateMap = new Map(states.map((s) => [s.task_key, s]));
  return tasks
    .map((t) => ({ ...t, status: (stateMap.get(t.key)?.status || 'open') as Task['status'], updated_at: stateMap.get(t.key)?.updated_at || null }))
    .sort((a, b) => b.impact - a.impact);
}

export async function setTaskStatus(taskKey: string, status: string, title?: string) {
  if (!/^[0-9a-f]{40}$/.test(taskKey) || !['open', 'done', 'ignored'].includes(status)) throw new Error('bad task');
  await run(`INSERT INTO seo_tasks (task_key, status, title, updated_at) VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`, [taskKey, status, (title || '').slice(0, 500)]);
}

// ---- Alerts ---------------------------------------------------------------------------------

async function mail(subject: string, lines: string[]) {
  if (!process.env.RESEND_API_KEY || process.env.NODE_ENV !== 'production') return;
  const from = 'info@flughafen-muenchen.taxi';
  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: `Munich Airport Taxi SEO <${from}>`,
    to: process.env.ADMIN_EMAIL || from,
    subject: `🔎 ${subject}`,
    html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb">
      <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #2a66aa">
        <h1 style="margin:0 0 12px;font-size:18px">${subject}</h1>
        <ul style="padding-left:18px;color:#333;font-size:14px;line-height:1.6">${lines.map((l) => `<li>${l.replace(/</g, '&lt;')}</li>`).join('')}</ul>
        <p><a href="https://flughafen-muenchen.taxi/admin" style="background:#1a365d;color:#fff;padding:9px 14px;border-radius:8px;text-decoration:none;font-size:14px">SEO-Tab öffnen</a></p>
        <p style="color:#888;font-size:12px">Abschaltbar: Admin → System → E-Mail-Warnungen → „SEO“.</p>
      </div></div>`,
  }).catch((e) => console.error('[seo/alert]', e?.message || e));
}

/** After a Search Console sync: ranking drops of tracked keywords, organic click drop. */
export async function checkSeoAlerts() {
  const lines: string[] = [];
  for (const k of await trackedKeywords(await trackedKeywordList())) {
    if (k.position != null && k.prev_position != null && k.position - k.prev_position >= 5) {
      lines.push(`„${k.keyword}“: Ø Position ${fmt(k.prev_position)} → ${fmt(k.position)} (7 Tage)`);
    }
  }
  const t = await gscTotals(7);
  if (t.previous.clicks >= 20 && t.current.clicks < t.previous.clicks * 0.7) {
    lines.push(`Organische Klicks: ${t.previous.clicks} → ${t.current.clicks} (${Math.round((t.current.clicks / t.previous.clicks - 1) * 100)} %, 7 Tage)`);
  }
  if (lines.length && (await shouldSendAlert('seo', `seo:rank:${new Date().toISOString().slice(0, 10)}`, 20))) {
    await mail('SEO: Rankings oder Klicks gefallen', lines);
  }
}

/** After an audit: new errors (page down, noindex, broken links). */
export async function checkAuditAlerts(since: Date) {
  const rows = await query<any>(`SELECT url, type, detail FROM seo_audit_issues WHERE resolved_at IS NULL AND severity = 'error' AND first_seen >= ?`, [since]);
  if (!rows.length) return;
  if (await shouldSendAlert('seo', `seo:audit:${since.toISOString().slice(0, 10)}`, 20)) {
    await mail(`SEO: ${rows.length} neue technische Fehler`, rows.slice(0, 20).map((r) => `${ISSUE_LABELS[r.type] || r.type}: ${pathOf(r.url)} ${r.detail || ''}`));
  }
}
