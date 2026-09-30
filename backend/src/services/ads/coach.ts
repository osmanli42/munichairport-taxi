// Ads coach: concrete, prioritised to-dos from our own data + the uploaded Google Ads reports —
// the checks a good Google Ads consultant runs every week. Only suggestions: nothing is changed in
// the Google Ads account. Status (done / ignored) is kept per task key; a key changes when the
// underlying data changes (new report upload), so a done task can come back with new evidence.

import crypto from 'crypto';
import { query, run } from '../../db';
import { audience, campaigns, cockpit, keywords, searchTerms, settings, trackingCheck } from './analytics';
import { latestImport } from './imports';
import { exportStatus } from './offline';

export const FINAL_URL_SUFFIX = 'kw={keyword}&mt={matchtype}&adg={adgroupid}&net={network}&cr={creative}';

export type CoachTask = {
  key: string;
  category: 'tracking' | 'data' | 'negatives' | 'keywords' | 'budget' | 'bidding' | 'landing' | 'quality' | 'conversions';
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  impact: number | null; // € per month (estimate)
  steps: string[];
  copy?: string; // text to paste into Google Ads
  status: 'open' | 'done' | 'ignored';
  blockedByLearning?: boolean;
};

const h = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const eur = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: n < 100 ? 2 : 0 })} €`;
const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;

/** Latest strategy change still inside its learning window (14 days). */
export async function learningGuard() {
  const [r] = await query<any>(`SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, campaign, note FROM ads_changelog
    WHERE learning = 1 AND day >= CURDATE() - INTERVAL 14 DAY ORDER BY day DESC LIMIT 1`);
  if (!r) return null;
  const until = new Date(new Date(`${r.day}T00:00:00Z`).getTime() + 14 * 86400_000).toISOString().slice(0, 10);
  return { day: r.day, campaign: r.campaign, note: r.note, until };
}

export async function buildCoach(days = 30) {
  const [cfg, cock, camp, kw, st, aud, trk, guard, offline, lastCampImport] = await Promise.all([
    settings(), cockpit(days), campaigns(days), keywords(days), searchTerms(), audience(days), trackingCheck(), learningGuard(), exportStatus(), latestImport('campaigns'),
  ]);
  const tasks: Omit<CoachTask, 'status'>[] = [];
  const monthFactor = 30 / days;
  const target = cfg.targetCpa;

  // 1) Tracking: which keyword brought the click.
  if (trk.clicks7d > 0 && trk.tagged7d === 0) {
    tasks.push({
      key: 'tracking:suffix', category: 'tracking', priority: 'high',
      title: 'Final-URL-Suffix ekle — hangi kelimenin rezervasyon getirdiğini görmek için',
      detail: `Son 7 günde ${trk.clicks7d} reklam tıklaması geldi ama hiçbiri kelime bilgisi taşımıyor. Suffix eklenince her tıklamada kelime, eşleme tipi ve ağ kaydedilir; kelime başına GERÇEK rezervasyon ve ciro görünür. Öğrenmeyi sıfırlamaz.`,
      impact: null,
      steps: ['Google Ads → Verwaltung (Admin) → Kontoeinstellungen', 'Tracking → „Final-URL-Suffix“', 'Aşağıdaki satırı yapıştır → Speichern', 'Birkaç tıklama sonra „Veri & Bağlantı“ sekmesinde yeşil tik görünür'],
      copy: FINAL_URL_SUFFIX,
    });
  }

  // 2) Fresh report data.
  const campAge = lastCampImport ? (Date.now() - new Date(lastCampImport.created_at).getTime()) / 86400_000 : null;
  if (campAge == null || campAge > 7) {
    tasks.push({
      key: `data:campaigns:${lastCampImport?.id || 0}`, category: 'data', priority: campAge == null ? 'high' : 'medium',
      title: campAge == null ? 'İlk Google Ads raporlarını yükle' : `Kampanya raporu ${Math.floor(campAge)} gündür güncellenmedi`,
      detail: 'Harcama, CPC, gösterim payı ve Google\'ın saydığı conversion\'lar raporlardan gelir. Haftada bir Kampagnen + Suchbegriffe + Keywords CSV\'lerini yükle.',
      impact: null,
      steps: ['Google Ads → Kampagnen → sağ üstte Zeitraum: Letzte 30 Tage', 'Segment → Zeit → Tag (günlük satırlar için)', 'Herunterladen (⬇) → CSV', 'Aynısını Suchbegriffe ve Keywords sayfalarında yap', 'Panel → Google Ads → Veri & Bağlantı → CSV yükle'],
    });
  }

  // 3) Negative keywords from search terms.
  if (st.report) {
    const already = (t: any) => /ausgeschlossen|excluded/i.test(t.added || '');
    const waste = st.terms.filter((t) => !already(t) && t.conversions === 0 && t.cost > 0 && (t.irrelevant || t.cost >= target * 1.5));
    const grams = st.ngrams.filter((g) => g.conversions === 0 && g.cost >= target * 2 && g.gram.length > 2 && !/^(taxi|flughafen|münchen|munich|airport|muc)$/.test(g.gram));
    if (waste.length || grams.length) {
      const cost = waste.reduce((a, t) => a + t.cost, 0);
      const lines = [
        ...waste.slice(0, 40).map((t) => `[${t.term}]`),
        ...grams.slice(0, 10).map((g) => `"${g.gram}"`),
      ];
      tasks.push({
        key: `neg:${st.report.id}:${h(lines.join('|'))}`, category: 'negatives', priority: cost >= target * 2 ? 'high' : 'medium',
        title: `${waste.length} arama terimini negatif yap — ${eur(cost)} rezervasyonsuz harcama`,
        detail: `Rapor dönemi ${st.report.period_from || '?'} – ${st.report.period_to || '?'}: bu terimler para harcadı ama hiç conversion getirmedi${waste.some((t) => t.irrelevant) ? ' (bazıları taksi rezervasyonuyla ilgisiz: iş ilanı, numara, toplu taşıma, rakip…)' : ''}. Kelime grupları: ${grams.slice(0, 5).map((g) => `„${g.gram}“ (${eur(g.cost)})`).join(', ') || '—'}.`,
        impact: Math.round(cost * monthFactor),
        steps: ['Google Ads → Keywords → Auszuschließende Keywords → + (Plus)', 'Kampagne(ler)i seç', 'Aşağıdaki listeyi yapıştır ([ ] = genau passend, " " = passende Wortgruppe)', 'Speichern — önce listeyi gözden geçir, gerçekten alakasız olanları bırak'],
        copy: lines.join('\n'),
      });
    }

    // 4) New keywords: converting search terms that are not keywords yet.
    const kwSet = new Set(kw.keywords.map((k: any) => k.keyword));
    const winners = st.terms.filter((t) => t.conversions >= 1 && !kwSet.has(t.term) && !/hinzugefügt|added/i.test(t.added || '') && !t.irrelevant)
      .sort((a, b) => b.conversions - a.conversions).slice(0, 15);
    if (winners.length) {
      tasks.push({
        key: `newkw:${st.report.id}:${h(winners.map((w) => w.term).join('|'))}`, category: 'keywords', priority: 'medium',
        title: `Rezervasyon getiren ${winners.length} arama terimini kelime olarak ekle`,
        detail: `Bu aramalar conversion getirdi ama henüz kendi kelimeleri yok: ${winners.slice(0, 5).map((w) => `„${w.term}“ (${w.conversions} conv.)`).join(', ')}. Genau passend eklemek kontrolü ve kaliteyi artırır.`,
        impact: null,
        steps: ['Google Ads → Kampagne → Anzeigengruppe → Keywords → +', 'Aşağıdaki listeyi yapıştır', 'Speichern'],
        copy: winners.map((w) => `[${w.term}]`).join('\n'),
      });
    }
  }

  // 5) Keywords that spend without bookings / low quality.
  const losers = kw.keywords.filter((k: any) => k.cost >= target * 3 && !k.bookings && !k.googleConv && !/pausiert|paused|entfernt|removed/i.test(k.status || '')).slice(0, 8);
  if (losers.length) {
    tasks.push({
      key: `kwpause:${h(losers.map((k: any) => k.keyword).join('|'))}`, category: 'keywords', priority: 'medium',
      title: `${losers.length} kelime ${eur(losers.reduce((a: number, k: any) => a + k.cost, 0))} harcadı, rezervasyon yok`,
      detail: losers.map((k: any) => `„${k.keyword}“ ${k.matchType || ''}: ${eur(k.cost)}, ${k.reportClicks} tık`).join(' · '),
      impact: Math.round(losers.reduce((a: number, k: any) => a + k.cost, 0) * monthFactor),
      steps: ['Google Ads → Keywords', 'Kelimeyi bul → Status → Pausiert (ya da genau passend\'e daralt)', 'Ziel-CPA kampanyasında önce 1 hafta gözle; hepsini birden durdurma'],
    });
  }
  const lowQs = kw.keywords.filter((k: any) => k.quality != null && k.quality <= 4 && k.cost > 0).slice(0, 8);
  if (lowQs.length) {
    tasks.push({
      key: `qs:${h(lowQs.map((k: any) => k.keyword + k.quality).join('|'))}`, category: 'quality', priority: 'low',
      title: `${lowQs.length} kelimenin Qualitätsfaktor'u düşük (≤ 4) — tık başı daha pahalı ödüyorsun`,
      detail: lowQs.map((k: any) => `„${k.keyword}“ QF ${k.quality}`).join(' · ') + '. Reklam metninde kelimenin geçmesi ve açılış sayfasının aramayla eşleşmesi QF\'yi yükseltir.',
      impact: null,
      steps: ['Google Ads → Keywords → Spalten: Qualitätsfaktor, Erwartete CTR, Anzeigenrelevanz, Nutzererfahrung mit der Landingpage', 'Zayıf bileşene göre: başlığa kelimeyi ekle / uygun şehir sayfasını final URL yap'],
    });
  }

  // 6) Campaign budget / pause decisions.
  for (const c of camp.campaigns) {
    if (c.verdict === 'scale') {
      const extra = c.bookings * ((c.lost_budget || 0) / 100) / Math.max(0.01, 1 - (c.lost_budget || 0) / 100);
      tasks.push({
        key: `scale:${c.id || c.name}:${Math.round(c.lost_budget || 0)}`, category: 'budget', priority: 'high',
        title: `„${c.name}“ bütçe yüzünden gösterim kaybediyor — CPA hedefin altında`,
        detail: `CPA ${c.cpa ? eur(c.cpa) : '—'} (hedef ${eur(target)}), bütçe nedeniyle kaybedilen gösterim payı ${pct((c.lost_budget || 0) / 100)}. Bütçeyi %20 artırmak ayda yaklaşık ${Math.round(extra * monthFactor)} ek rezervasyon getirebilir.`,
        impact: Math.round(extra * monthFactor * (cock.current.bookings ? cock.current.revenue / cock.current.bookings : 0)),
        steps: ['Google Ads → Kampagnen → Budget ✎', 'Tagesbudget +%20 (tek seferde en fazla %20–30)', 'Değişiklik günlüğüne kaydet'],
      });
    } else if (c.verdict === 'pause') {
      tasks.push({
        key: `pause:${c.id || c.name}:${Math.round(c.cost)}`, category: 'budget', priority: 'high',
        title: `„${c.name}“ ${eur(c.cost)} harcadı, hiç rezervasyon yok`,
        detail: `${c.clicks} reklam ziyareti, 0 rezervasyon. Kampanyayı durdur ya da hedeflemesini/kelimelerini daralt; bütçeyi iyi çalışan kampanyaya kaydır.`,
        impact: Math.round(c.cost * monthFactor),
        steps: ['Google Ads → Kampagnen → Status → Pausiert', 'ya da: Suchbegriffe raporuna bakıp alakasız trafiği negatifle'],
      });
    }
  }

  // 7) CPA vs target.
  const cpa = cock.current.cpa;
  if (cpa != null && cock.current.bookings >= 3 && cpa > target * 1.3) {
    tasks.push({
      key: `cpa:${cock.range.to}`, category: 'bidding', priority: 'high',
      title: `CPA ${eur(cpa)} — hedef ${eur(target)}'nun %${Math.round((cpa / target - 1) * 100)} üstünde`,
      detail: `Son ${days} günde ${eur(cock.current.cost)} harcama, ${cock.current.bookings} rezervasyon. Önce negatif kelimeler ve kârsız kelimeler temizlenmeli; teklif stratejisini değiştirmek son çare.`,
      impact: Math.round((cpa - target) * cock.current.bookings * monthFactor),
      steps: ['Koç listesindeki negatif kelime görevini uygula', 'Suchbegriffe raporunda tekrar kontrol et', 'Öğrenme dönemi bitmeden Ziel-CPA değiştirme'],
    });
  }

  // 8) Bid adjustments (device / weekday / time block) — informative with Smart Bidding.
  const adj = [
    ...aud.devices.filter((d: any) => d.adjust != null && Math.abs(d.adjust) >= 15).map((d: any) => `Gerät ${d.name}: ${d.adjust > 0 ? '+' : ''}${d.adjust} % (Conv.-Rate ${pct(d.cvr)})`),
    ...aud.blocks.filter((b: any) => b.adjust != null && Math.abs(b.adjust) >= 20).map((b: any) => `${String(b.from).padStart(2, '0')}–${String(b.to).padStart(2, '0')} Uhr: ${b.adjust > 0 ? '+' : ''}${b.adjust} %`),
    ...aud.weekdays.filter((w: any) => w.adjust != null && Math.abs(w.adjust) >= 20).map((w: any) => `${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][w.weekday]}: ${w.adjust > 0 ? '+' : ''}${w.adjust} %`),
  ];
  if (adj.length) {
    tasks.push({
      key: `adj:${h(adj.join('|'))}`, category: 'bidding', priority: 'low',
      title: 'Cihaz / saat / gün bazında dönüşüm farkı var',
      detail: `Hesap ortalamasına göre önerilen teklif ayarı: ${adj.join(' · ')}. Not: Ziel-CPA / Conversions maximieren kullanan kampanyalarda Google bu ayarları (−100 % hariç) dikkate almaz; bu tablo manuel CPC kampanyaları ve bütçe/zamanlama kararları içindir.`,
      impact: null,
      steps: ['Google Ads → Kampagne → Geräte / Werbezeitplaner', 'Sadece manuel CPC kampanyada Gebotsanpassung gir', 'Ziel-CPA kampanyasında çok kötü saatleri (0 rezervasyon, çok tık) Werbezeitplaner ile kapatmayı düşün'],
    });
  }

  // 9) Landing pages that underperform.
  const weakLp = aud.landings.filter((l: any) => l.clicks >= 30 && aud.baseCvr > 0 && l.cvr < aud.baseCvr * 0.5);
  for (const l of weakLp.slice(0, 3)) {
    tasks.push({
      key: `lp:${h(l.name)}:${l.clicks}`, category: 'landing', priority: 'medium',
      title: `Açılış sayfası ${l.name} zayıf dönüştürüyor (%${Math.round(l.cvr * 1000) / 10} vs ort. %${Math.round(aud.baseCvr * 1000) / 10})`,
      detail: `${l.clicks} reklam ziyareti, ${l.bookings} rezervasyon. Final URL'i ana sayfaya (arama çubuğu hemen görünür) ya da ilgili şehir sayfasına çevirmeyi dene.`,
      impact: null,
      steps: ['Google Ads → Anzeigen → ilgili reklam → Finale URL', 'Değişikliği günlüğe kaydet, 2 hafta sonra karşılaştır'],
    });
  }

  // 10) Google's conversion count vs real bookings (tracking health).
  if (cock.current.reportDays >= 7 && (cock.current.googleConv >= 5 || cock.current.bookings >= 5)) {
    const g = cock.current.googleConv;
    const b = cock.current.bookings;
    const diff = Math.abs(g - b) / Math.max(g, b);
    if (diff > 0.3) {
      tasks.push({
        key: `conv:${cock.range.to}:${Math.round(g)}:${b}`, category: 'conversions', priority: 'high',
        title: `Google ${Math.round(g)} conversion sayıyor, gerçek reklam rezervasyonu ${b}`,
        detail: g > b
          ? 'Google gerçekte olandan fazla conversion görüyor (çift sayım, iptaller veya ikincil conversion\'ların primär olması). Ziel-CPA bu yanlış sayıya göre teklif verir.'
          : 'Google conversion\'ların bir kısmını görmüyor (gclid kaybı, çerez reddi, Enhanced Conversions). Algoritma daha az veriyle öğreniyor.',
        impact: null,
        steps: ['Google Ads → Ziele → Conversions → Zusammenfassung', 'Sadece „Buchung“ Primär olmalı; diğerleri Sekundär', 'Offline conversion dosyasını yükleyerek gerçek ciroyu ekle'],
      });
    }
  }

  // 11) Offline conversions.
  if (offline.pending > 0) {
    const age = offline.last ? (Date.now() - new Date(offline.last.created_at).getTime()) / 86400_000 : null;
    if (age == null || age >= 7) {
      tasks.push({
        key: `offline:${offline.last?.created_at || 'never'}`, category: 'conversions', priority: age == null ? 'medium' : 'low',
        title: `${offline.pending} gerçek rezervasyonu (${eur(offline.pendingValue)}) Google Ads'e bildir`,
        detail: 'Tamamlanmış fahrtların gclid + gerçek ciro dosyası hazır. Sekundär conversion olarak yüklenir → teklifleri etkilemez, sadece Google\'da gerçek ciroyu görürsün; veri oturunca primär yapılabilir.',
        impact: null,
        steps: offline.exports ? ['Veri & Bağlantı → „Offline conversion dosyası“ → İndir', 'Google Ads → Ziele → Uploads → + → Datei auswählen → Hochladen'] : ['İlk sefer: Google Ads → Ziele → Conversions → + Neue Conversion-Aktion → Import → „Andere Datenquellen oder CRMs“ → „Conversions aus Klicks verfolgen“', `Ad: „${cfg.conversionName}“, Wert: „Für jede Conversion unterschiedliche Werte“, Zählweise: „Eine“, Aktion: **Sekundär**`, 'Veri & Bağlantı → dosyayı indir → Ziele → Uploads → Hochladen'],
      });
    }
  }

  // 12) Budget pacing.
  const pc = cock.pacing;
  if (pc.budget && pc.projected != null) {
    if (pc.projected > pc.budget * 1.1) {
      tasks.push({
        key: `pace:${pc.month}:over`, category: 'budget', priority: 'medium',
        title: `Ay sonu harcama tahmini ${eur(pc.projected)} — aylık bütçe ${eur(pc.budget)}`,
        detail: `${pc.month} içinde şimdiye kadar ${eur(pc.spent)} harcandı (${pc.coveredDays}/${pc.daysInMonth} gün). Günlük bütçeyi ~${eur(Math.max(0, (pc.budget - pc.spent) / Math.max(1, pc.daysInMonth - pc.coveredDays)))}'ya çek ya da hedefi güncelle.`,
        impact: Math.round(pc.projected - pc.budget),
        steps: ['Google Ads → Kampagnen → Budget', 'Ya da panelde Ayarlar → aylık bütçe'],
      });
    }
  }

  // Status + learning guard.
  const statusRows = await query<any>(`SELECT task_key, status FROM ads_coach_tasks`);
  const status = new Map<string, string>(statusRows.map((r) => [r.task_key, r.status]));
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const touchesStrategy = new Set(['bidding', 'budget']);
  const list: CoachTask[] = tasks.map((t) => ({
    ...t,
    status: (status.get(t.key) as CoachTask['status']) || 'open',
    blockedByLearning: !!guard && touchesStrategy.has(t.category),
  })).sort((a, b) => rank[a.priority] - rank[b.priority] || (b.impact || 0) - (a.impact || 0));
  return { guard, tasks: list, finalUrlSuffix: FINAL_URL_SUFFIX };
}

export async function setTaskStatus(key: string, status: string, title: string) {
  if (!['open', 'done', 'ignored'].includes(status)) throw new Error('bad status');
  if (status === 'open') { await run(`DELETE FROM ads_coach_tasks WHERE task_key = ?`, [key.slice(0, 191)]); return; }
  await run(`INSERT INTO ads_coach_tasks (task_key, status, title, updated_at) VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE status = VALUES(status), title = VALUES(title), updated_at = NOW()`, [key.slice(0, 191), status, title.slice(0, 500)]);
}

/** Weekly report upload due (Monday Berlin → no campaign report uploaded this week). */
export async function adsReminder() {
  const cfg = await settings();
  const last = await latestImport('campaigns');
  const lastAt = last ? new Date(last.created_at) : null;
  const now = new Date();
  const berlinToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
  const wd = (new Date(`${berlinToday}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const mondayStart = new Date(new Date(`${berlinToday}T00:00:00Z`).getTime() - wd * 86400_000 - 2 * 3600_000); // ≈ Berlin midnight (safe side)
  const uploadedThisWeek = !!lastAt && lastAt >= mondayStart;
  return { enabled: cfg.reminder, due: cfg.reminder && !uploadedThisWeek, lastUpload: last?.created_at || null };
}

/** High-priority problems for the 6-hourly ads alert mail (services/adsAlertJob.ts). */
export async function coachAlerts(): Promise<{ title: string; detail: string }[]> {
  const out: { title: string; detail: string }[] = [];
  const [cfg, week, trk] = await Promise.all([settings(), cockpit(7), trackingCheck()]);
  const c = week.current;
  if (c.hasSpend && c.bookings === 0 && c.cost >= cfg.targetCpa * 3) {
    out.push({ title: `7 günde ${eur(c.cost)} harcama, hiç reklam rezervasyonu yok`, detail: 'Site/rezervasyon formu çalışıyor mu, conversion tracking doğru mu kontrol et; sonra arama terimlerine bak.' });
  } else if (c.cpa != null && c.bookings >= 2 && c.cpa > cfg.targetCpa * 1.5) {
    out.push({ title: `Son 7 gün CPA ${eur(c.cpa)} — hedef ${eur(cfg.targetCpa)}`, detail: `${eur(c.cost)} harcama, ${c.bookings} rezervasyon. Koç sekmesindeki negatif kelime / kelime görevlerine bak.` });
  }
  if (trk.lastTagged && trk.lastClick && new Date(trk.lastClick).getTime() - new Date(trk.lastTagged).getTime() > 48 * 3600_000) {
    out.push({ title: 'Final-URL-Suffix çalışmıyor', detail: `Son kelime bilgili tıklama ${new Date(trk.lastTagged).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}; sonrasındaki tıklamalarda kelime yok. Google Ads → Kontoeinstellungen → Tracking kontrol et.` });
  }
  return out;
}
